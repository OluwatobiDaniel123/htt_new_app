import "dotenv/config";
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryTypes } from "sequelize";
import { postgresColumnTypeMatches, type PostgresColumnType } from "./schemaTypes.js";
import { env } from "../config/env.js";
import { sequelize, models, coachingApprenticeApplication } from "../models/index.js";
import { seedAdminAccount } from "../services/adminSeedService.js";

const migrationDirectory = resolve(process.cwd(), "migrations");
const seederDirectory = resolve(process.cwd(), "seeders");
const require = createRequire(import.meta.url);
const seeders = [
  "20261029000000-seed-rbac.cjs",
  "20261029000001-phase4-academy-permissions.cjs",
  "20261029000002-phase5-finance-permissions.cjs",
  "20261029000003-phase6-notification-permissions.cjs",
  "20261030000000-phase7-safeguarding-permissions.cjs",
  "20261102000000-coaching-apprentice-permission.cjs",
];

const fail = (message: string): never => {
  throw new Error(message);
};

const catalogString = (value: unknown, context: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    return fail(`Schema verification failed while reading ${context}: PostgreSQL returned an empty or non-string name.`);
  }
  return value;
};

const tableNameOf = (model: { getTableName: () => unknown }, context: string) => {
  const value = model.getTableName();
  const name = typeof value === "string"
    ? value
    : typeof value === "object" && value !== null && "tableName" in value
      ? value.tableName
      : undefined;
  return catalogString(name, `${context} table name`);
};

const sequelizeTypeSql = (type: unknown, context: string) => {
  if (typeof type !== "object" || type === null || !("toSql" in type) || typeof type.toSql !== "function") {
    return fail(`Schema verification failed for ${context}: Sequelize did not expose a SQL column type.`);
  }
  return type.toSql();
};

const migrationOrigin = (migrationNames: string[], sql: string[], ...terms: string[]) => {
  const lowerTerms = terms.map((term) => term.toLowerCase());
  const origins = migrationNames.filter((_name, index) => lowerTerms.every((term) => sql[index]!.toLowerCase().includes(term)));
  return origins.length ? origins.join(", ") : "migration postcondition";
};

const assertProductionConfiguration = () => {
  if (env.NODE_ENV !== "production") fail("This command is restricted to NODE_ENV=production.");
  if (!env.DATABASE_URL) fail("DATABASE_URL must be set; host-based development connections are not accepted.");
  if (!env.SEED_ADMIN_NAME || !env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    fail("Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD in the Render service environment.");
  }
};

const migrationFiles = async () => (await readdir(migrationDirectory))
  .filter((name) => name.endsWith(".cjs"))
  .sort();

const requiredTables = (migrationNames: string[], migrationSql: string[]) => {
  const tables = new Set<string>();
  for (const text of migrationSql) {
    for (const match of text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]*)/gi)) {
      tables.add(match[1]!.toLowerCase());
    }
  }
  if (migrationNames.includes("20261030000000-base44-migration-ledger.cjs")) tables.add("data_migration_ledger");
  return tables;
};

const tableConstraintRequirements = (migrationSql: string[]) => {
  const requirements = new Map<string, { c: number; f: number; u: number }>();
  for (const text of migrationSql) {
    for (const match of text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*;/gi)) {
      const table = match[1]!.toLowerCase();
      const body = match[2]!;
      requirements.set(table, {
        c: [...body.matchAll(/\bCHECK\s*\(/gi)].length,
        f: [...body.matchAll(/\bREFERENCES\s+/gi)].length,
        u: [...body.matchAll(/\bUNIQUE\b/gi)].length,
      });
    }
  }
  return requirements;
};

const verifySchema = async (migrationNames: string[]) => {
  const sql = await Promise.all(migrationNames.map((name) => readFile(resolve(migrationDirectory, name), "utf8")));
  const tables = requiredTables(migrationNames, sql);
  const expectedModels = [...Object.values(models), coachingApprenticeApplication];
  for (const model of expectedModels) tables.add(tableNameOf(model, "Sequelize model").toLowerCase());

  const catalogTables = await sequelize.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
    { type: QueryTypes.SELECT },
  );
  const existingTables = new Set(catalogTables.map((row) => catalogString(row.table_name, "information_schema.tables.table_name").toLowerCase()));
  const missingTables = [...tables].filter((table) => !existingTables.has(table));
  if (missingTables.length) fail(`Schema verification failed; missing existing tables: ${missingTables.map((table) => `${table} (migration: ${migrationOrigin(migrationNames, sql, table)})`).join(", ")}. No migrations or seeders were run.`);

  const columnsByTable = new Map<string, Map<string, PostgresColumnType>>();
  const catalogColumns = await sequelize.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    character_maximum_length: number | null;
    numeric_precision: number | null;
    numeric_scale: number | null;
  }>(
    `SELECT table_name, column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale
     FROM information_schema.columns WHERE table_schema = current_schema()`,
    { type: QueryTypes.SELECT },
  );
  for (const row of catalogColumns) {
    const table = catalogString(row.table_name, "information_schema.columns.table_name").toLowerCase();
    const column = catalogString(row.column_name, `${table} information_schema column name`).toLowerCase();
    const columns = columnsByTable.get(table) ?? new Map<string, PostgresColumnType>();
    columns.set(column, row);
    columnsByTable.set(table, columns);
  }

  const missingColumns: string[] = [];
  const mismatchedTypes: string[] = [];
  for (const model of expectedModels) {
    const tableName = tableNameOf(model, "Sequelize model");
    const expectedTable = tableName.toLowerCase();
    const columns = columnsByTable.get(expectedTable) ?? new Map<string, PostgresColumnType>();
    for (const [attribute, definition] of Object.entries(model.rawAttributes)) {
      const column = (definition.field ?? attribute).toLowerCase();
      const actual = columns.get(column);
      const context = `${tableName}.${column}`;
      const origin = migrationOrigin(migrationNames, sql, tableName.toLowerCase(), column);
      if (!actual) {
        missingColumns.push(`${context} (migration: ${origin})`);
        continue;
      }
      const expectedType = sequelizeTypeSql(definition.type, context);
      if (!postgresColumnTypeMatches(expectedType, actual)) {
        mismatchedTypes.push(`${context}: expected Sequelize ${expectedType}, found PostgreSQL ${actual.data_type} (${actual.udt_name}${actual.character_maximum_length ? `, length ${actual.character_maximum_length}` : ""}${actual.numeric_precision !== null ? `, precision ${actual.numeric_precision}, scale ${actual.numeric_scale}` : ""}) (migration: ${origin})`);
      }
    }
  }
  const ledgerColumns = ["source_system", "source_entity", "source_id", "target_entity", "target_id", "source_checksum", "imported_at", "created_at", "updated_at"];
  if (tables.has("data_migration_ledger")) {
    const ledger = columnsByTable.get("data_migration_ledger") ?? new Map<string, PostgresColumnType>();
    for (const column of ledgerColumns) if (!ledger.has(column)) missingColumns.push(`data_migration_ledger.${column} (migration: 20261030000000-base44-migration-ledger.cjs)`);
  }
  if (missingColumns.length) fail(`Schema verification failed; missing existing columns: ${missingColumns.join(", ")}. No migrations or seeders were run.`);
  if (mismatchedTypes.length) fail(`Schema verification failed; PostgreSQL column types differ from Sequelize model types: ${mismatchedTypes.join("; ")}. No migrations or seeders were run.`);

  const expectedIndexes = new Set<string>();
  const expectedConstraints = new Set<string>();
  for (const text of sql) {
    for (const match of text.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]*)/gi)) {
      expectedIndexes.add(match[1]!.toLowerCase());
    }
    for (const match of text.matchAll(/ADD\s+CONSTRAINT\s+["']?([a-z_][a-z0-9_]*)/gi)) {
      expectedConstraints.add(match[1]!.toLowerCase());
    }
  }
  if (migrationNames.includes("20261030000000-base44-migration-ledger.cjs")) {
    expectedConstraints.add("uq_data_migration_source_identity");
  }
  const indexRows = await sequelize.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()",
    { type: QueryTypes.SELECT },
  );
  const existingIndexes = new Set(indexRows.map((row) => catalogString(row.indexname, "pg_indexes.indexname").toLowerCase()));
  const missingIndexes = [...expectedIndexes].filter((name) => !existingIndexes.has(name));
  if (missingIndexes.length) fail(`Schema verification failed; missing migration indexes: ${missingIndexes.map((name) => `${name} (migration: ${migrationOrigin(migrationNames, sql, name)})`).join(", ")}. No migrations or seeders were run.`);
  if (expectedConstraints.size) {
    const constraintRows = await sequelize.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE connamespace = current_schema()::regnamespace",
      { type: QueryTypes.SELECT },
    );
    const existingConstraints = new Set(constraintRows.map((row) => catalogString(row.conname, "pg_constraint.conname").toLowerCase()));
    const missingConstraints = [...expectedConstraints].filter((name) => !existingConstraints.has(name));
    if (missingConstraints.length) fail(`Schema verification failed; missing migration constraints: ${missingConstraints.map((name) => `${name} (migration: ${migrationOrigin(migrationNames, sql, name)})`).join(", ")}. No migrations or seeders were run.`);
  }

  const constraintRequirements = tableConstraintRequirements(sql);
  if (constraintRequirements.size) {
    const constraintCounts = await sequelize.query<{ table_name: string; contype: string; count: number }>(
      `SELECT relation.relname AS table_name, constraint_row.contype, count(*)::int AS count
       FROM pg_constraint AS constraint_row
       JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
       JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = current_schema() AND constraint_row.contype IN ('c', 'f', 'u')
       GROUP BY relation.relname, constraint_row.contype`,
      { type: QueryTypes.SELECT },
    );
    const actual = new Map<string, { c: number; f: number; u: number }>();
    for (const row of constraintCounts) {
      const table = catalogString(row.table_name, "pg_constraint relation name").toLowerCase();
      const counts = actual.get(table) ?? { c: 0, f: 0, u: 0 };
      counts[row.contype as "c" | "f" | "u"] = row.count;
      actual.set(table, counts);
    }
    const missing: string[] = [];
    for (const [table, required] of constraintRequirements) {
      const present = actual.get(table) ?? { c: 0, f: 0, u: 0 };
      for (const kind of ["c", "f", "u"] as const) {
        if (present[kind] < required[kind]) missing.push(`${table} (${required[kind] - present[kind]} ${kind} constraint(s))`);
      }
    }
    if (missing.length) fail(`Schema verification failed; migration table constraints are missing: ${missing.map((item) => `${item} (migration: ${migrationOrigin(migrationNames, sql, item.split(" ")[0]!.toLowerCase())})`).join(", ")}. No migrations or seeders were run.`);
  }
};

const reconcileMigrationHistory = async (migrationNames: string[]) => {
  const existence = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(format('%I.%I', current_schema(), 'SequelizeMeta')) IS NOT NULL AS exists`,
    { type: QueryTypes.SELECT },
  );
  const metaExists = existence[0]?.exists === true;
  const recorded: string[] = metaExists
    ? (await sequelize.query<{ name: string }>('SELECT name FROM "SequelizeMeta" ORDER BY name', { type: QueryTypes.SELECT })).map((row) => row.name)
    : [];
  const known = new Set(migrationNames);
  const unknown = recorded.filter((name) => !known.has(name));
  if (unknown.length) fail(`SequelizeMeta contains migration names absent from this deploy: ${unknown.join(", ")}. No migration history was changed.`);

  const missing = migrationNames.filter((name) => !recorded.includes(name));
  console.info(`Migration history: ${metaExists ? `${recorded.length} recorded` : "SequelizeMeta is absent"}; ${missing.length} file(s) require schema reconciliation.`);
  if (!missing.length) return;

  await verifySchema(migrationNames);
  if (!metaExists) {
    await sequelize.query('CREATE TABLE "SequelizeMeta" ("name" varchar(255) NOT NULL PRIMARY KEY)');
  }
  for (const name of missing) {
    await sequelize.query('INSERT INTO "SequelizeMeta" ("name") VALUES (:name) ON CONFLICT ("name") DO NOTHING', { replacements: { name } });
  }
  console.info(`Schema postconditions verified for ${migrationNames.length} migration files; missing SequelizeMeta entries were reconciled. Migration up functions were not executed.`);
};

const runSeeders = async () => {
  const queryInterface = sequelize.getQueryInterface();
  for (const name of seeders) {
    const seederPath = resolve(seederDirectory, name);
    const seeder = require(seederPath) as { up: (qi: typeof queryInterface) => Promise<void> };
    await seeder.up(queryInterface);
    console.info(`Seed data verified: ${name}`);
  }
};

try {
  assertProductionConfiguration();
  await sequelize.authenticate();
  const migrations = await migrationFiles();
  const seederHistory = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(format('%I.%I', current_schema(), 'SequelizeData')) IS NOT NULL AS exists`,
    { type: QueryTypes.SELECT },
  );
  if (seederHistory[0]?.exists) {
    const rows = await sequelize.query<{ count: number }>('SELECT count(*)::int AS count FROM "SequelizeData"', { type: QueryTypes.SELECT });
    console.info(`Seeder history: SequelizeData exists with ${rows[0]?.count ?? 0} row(s), but this project does not configure Sequelize seeder storage; those rows are not treated as seeder history.`);
  } else {
    console.info("Seeder history: not configured; Sequelize CLI does not persist seeder history.");
  }
  await reconcileMigrationHistory(migrations);
  await runSeeders();
  const result = await seedAdminAccount({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
  });
  console.info(result.created ? `Production Super Admin created for ${result.email}.` : `Production Super Admin already exists for ${result.email}; no account changes made.`);
  console.info("Production database setup completed.");
} catch (error) {
  console.error(error instanceof Error ? `Production database setup failed: ${error.message}` : "Production database setup failed.");
  process.exitCode = 1;
} finally {
  await sequelize.close();
}

