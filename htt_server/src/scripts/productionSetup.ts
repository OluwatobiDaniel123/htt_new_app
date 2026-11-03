import "dotenv/config";
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryTypes } from "sequelize";
import { catalogString, migrationConstraintRequirements, namedConstraintFailureMessage, postgresColumnTypeMatches, PRODUCTION_SCHEMA, readCatalogField, type PostgresColumnType } from "./schemaTypes.js";
import { env } from "../config/env.js";
import { sequelize, models, coachingApprenticeApplication } from "../models/index.js";
import { seedAdminAccount } from "../services/adminSeedService.js";

const migrationDirectory = resolve(process.cwd(), "migrations");
const seederDirectory = resolve(process.cwd(), "seeders");
const require = createRequire(import.meta.url);
const paymentTables = new Set(["payments", "payment_allocations", "payment_events", "refunds"]);
const paymentIndexes = new Set([
  "idx_payments_status_created",
  "idx_payments_player",
  "idx_payment_allocations_registration",
  "idx_payment_events_payment",
  "idx_payments_registration_created",
  "idx_payments_programme_centre_created",
  "idx_payments_paid_at",
  "idx_refunds_payment_status",
  "idx_refunds_created",
]);
const deferredPaymentMigrations = new Set([
  "20261029000000-create-initial-schema.cjs",
  "20261029000003-phase5-finance.cjs",
  "20261104000000-reconcile-production-payment-and-player-types.cjs",
]);
const paymentOnlySchemaMigrations = new Set([
  "20261029000003-phase5-finance.cjs",
  "20261104000000-reconcile-production-payment-and-player-types.cjs",
]);
const schemaName = PRODUCTION_SCHEMA;
const seeders = [
  "20261029000000-seed-rbac.cjs",
  "20261029000001-phase4-academy-permissions.cjs",
  "20261029000003-phase6-notification-permissions.cjs",
  "20261030000000-phase7-safeguarding-permissions.cjs",
  "20261102000000-coaching-apprentice-permission.cjs",
];

const fail = (message: string): never => {
  throw new Error(message);
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
  for (const table of paymentTables) tables.delete(table);
  return tables;
};

const verifySchema = async (migrationNames: string[]) => {
  const sql = await Promise.all(migrationNames.map((name) => readFile(resolve(migrationDirectory, name), "utf8")));
  const tables = requiredTables(migrationNames, sql);
  const expectedModels = [...Object.values(models), coachingApprenticeApplication]
    .filter((model) => !paymentTables.has(tableNameOf(model, "Sequelize model").toLowerCase()));
  for (const model of expectedModels) tables.add(tableNameOf(model, "Sequelize model").toLowerCase());

  const catalogTables = await sequelize.query<Record<string, unknown> | unknown[]>(
    `SELECT tables.table_name AS "tableName"
     FROM information_schema.tables AS tables
     WHERE tables.table_schema = :schema AND tables.table_type = 'BASE TABLE'`,
    { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
  );
  const existingTables = new Set(catalogTables.map((row) => catalogString(
    readCatalogField(row, ["tableName", "table_name"], "information_schema.tables table lookup"),
    "information_schema.tables.table_name",
  ).toLowerCase()));
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
     FROM information_schema.columns WHERE table_schema = :schema`,
    { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
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
      const allowWiderSchoolColumn = expectedTable === "players" && column === "school";
      if (!postgresColumnTypeMatches(expectedType, actual, { allowWiderCharacterLength: allowWiderSchoolColumn })) {
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
  for (const [index, text] of sql.entries()) {
    if (paymentOnlySchemaMigrations.has(migrationNames[index]!)) continue;
    for (const match of text.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]*)/gi)) {
      const name = match[1]!.toLowerCase();
      if (!paymentIndexes.has(name)) expectedIndexes.add(name);
    }
    for (const match of text.matchAll(/ADD\s+CONSTRAINT\s+["']?([a-z_][a-z0-9_]*)/gi)) {
      expectedConstraints.add(match[1]!.toLowerCase());
    }
  }
  if (migrationNames.includes("20261030000000-base44-migration-ledger.cjs")) {
    expectedConstraints.add("uq_data_migration_source_identity");
  }
  const indexRows = await sequelize.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = :schema",
    { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
  );
  const existingIndexes = new Set(indexRows.map((row) => catalogString(row.indexname, "pg_indexes.indexname").toLowerCase()));
  const missingIndexes = [...expectedIndexes].filter((name) => !existingIndexes.has(name));
  if (missingIndexes.length) fail(`Schema verification failed; missing migration indexes: ${missingIndexes.map((name) => `${name} (migration: ${migrationOrigin(migrationNames, sql, name)})`).join(", ")}. No migrations or seeders were run.`);
  if (expectedConstraints.size) {
    const constraintRows = await sequelize.query<{ conname: string }>(
      `SELECT constraint_row.conname
       FROM pg_constraint AS constraint_row
       JOIN pg_namespace AS namespace ON namespace.oid = constraint_row.connamespace
       WHERE namespace.nspname = :schema`,
      { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
    );
    const existingConstraints = new Set(constraintRows.map((row) => catalogString(row.conname, "pg_constraint.conname").toLowerCase()));
    const missingConstraints = [...expectedConstraints].filter((name) => !existingConstraints.has(name));
    if (missingConstraints.length) {
      fail(namedConstraintFailureMessage(
        schemaName,
        missingConstraints.map((name) => `${name} (migration: ${migrationOrigin(migrationNames, sql, name)})`),
      ));
    }
  }

  const constraintRequirements = migrationConstraintRequirements(sql);
  for (const table of paymentTables) constraintRequirements.delete(table);
  if (constraintRequirements.size) {
    const constraintCounts = await sequelize.query<{ table_name: string; contype: string; count: number }>(
      `SELECT relation.relname AS table_name, constraint_row.contype, count(*)::int AS count
       FROM pg_constraint AS constraint_row
       JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
       JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = :schema AND constraint_row.contype IN ('c', 'f', 'u')
       GROUP BY relation.relname, constraint_row.contype`,
      { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
    );
    const actual = new Map<string, { c: number; f: number; u: number }>();
    for (const row of constraintCounts) {
      const table = catalogString(row.table_name, "pg_constraint relation name").toLowerCase();
      const counts = actual.get(table) ?? { c: 0, f: 0, u: 0 };
      counts[row.contype as "c" | "f" | "u"] = row.count;
      actual.set(table, counts);
    }
    const missing: string[] = [];
    const kindLabels = { c: "check constraints", f: "foreign keys", u: "unique constraints" };
    for (const [table, required] of constraintRequirements) {
      const present = actual.get(table) ?? { c: 0, f: 0, u: 0 };
      for (const kind of ["c", "f", "u"] as const) {
        if (present[kind] < required[kind]) {
          missing.push(`${schemaName}.${table} (${kindLabels[kind]} expected ${required[kind]}, found ${present[kind]})`);
        }
      }
    }
    if (missing.length) fail(`Schema verification failed in schema ${schemaName}; migration table constraints are missing: ${missing.map((item) => `${item} (migration: ${migrationOrigin(migrationNames, sql, item.split(" ")[0]!.split(".").at(-1)!.toLowerCase())})`).join(", ")}. No migrations or seeders were run.`);
  }
};

const reconcileMigrationHistory = async (migrationNames: string[]) => {
  const existence = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(format('%I.%I', :schema, 'SequelizeMeta')) IS NOT NULL AS exists`,
    { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
  );
  const metaExists = existence[0]?.exists === true;
  const recorded: string[] = metaExists
    ? (await sequelize.query<{ name: string }>(`SELECT name FROM "${schemaName}"."SequelizeMeta" ORDER BY name`, { type: QueryTypes.SELECT, raw: true })).map((row) => row.name)
    : [];
  const known = new Set(migrationNames);
  const unknown = recorded.filter((name) => !known.has(name));
  if (unknown.length) fail(`SequelizeMeta contains migration names absent from this deploy: ${unknown.join(", ")}. No migration history was changed.`);

  const missing = migrationNames.filter((name) => !recorded.includes(name));
  const deferred = migrationNames.filter((name) => deferredPaymentMigrations.has(name));
  console.info(`Migration history: ${metaExists ? `${recorded.length} recorded` : "SequelizeMeta is absent"}; ${missing.length} file(s) are unrecorded.`);
  await verifySchema(migrationNames);
  const missingDeferred = deferred.filter((name) => missing.includes(name));
  if (missingDeferred.length) {
    console.info(`Migration history was left unchanged because payment-related schema is deferred: ${missingDeferred.join(", ")}. No migration files were marked complete.`);
    return;
  }
  if (!missing.length) return;
  if (!metaExists) {
    await sequelize.query(`CREATE TABLE "${schemaName}"."SequelizeMeta" ("name" varchar(255) NOT NULL PRIMARY KEY)`);
  }
  for (const name of missing) {
    await sequelize.query(`INSERT INTO "${schemaName}"."SequelizeMeta" ("name") VALUES (:name) ON CONFLICT ("name") DO NOTHING`, { replacements: { name } });
  }
  console.info(`Schema postconditions verified for ${missing.length} migration files; missing SequelizeMeta entries were reconciled. Migration up functions were not executed.`);
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
  console.info(`Payment processing is disabled. Deferred migrations remain available for later: ${[...deferredPaymentMigrations].join(", ")}.`);
  console.info("Payment permission seeding is deferred until payment processing is re-enabled.");
  const seederHistory = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(format('%I.%I', :schema, 'SequelizeData')) IS NOT NULL AS exists`,
      { type: QueryTypes.SELECT, raw: true, replacements: { schema: schemaName } },
  );
  if (seederHistory[0]?.exists) {
    const rows = await sequelize.query<{ count: number }>(`SELECT count(*)::int AS count FROM "${schemaName}"."SequelizeData"`, { type: QueryTypes.SELECT, raw: true });
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

