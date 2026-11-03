import "dotenv/config";
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryTypes } from "sequelize";
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
  for (const model of expectedModels) tables.add(String(model.getTableName()).toLowerCase());

  const catalogTables = await sequelize.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
    { type: QueryTypes.SELECT },
  );
  const existingTables = new Set(catalogTables.map((row) => row.table_name.toLowerCase()));
  const missingTables = [...tables].filter((table) => !existingTables.has(table));
  if (missingTables.length) fail(`Schema verification failed; missing existing tables: ${missingTables.join(", ")}. No migrations or seeders were run.`);

  const missingColumns: string[] = [];
  for (const model of expectedModels) {
    const tableName = String(model.getTableName());
    const columns = await sequelize.getQueryInterface().describeTable(tableName);
    for (const [attribute, definition] of Object.entries(model.rawAttributes)) {
      const column = definition.field ?? attribute;
      if (!Object.hasOwn(columns, column)) missingColumns.push(`${tableName}.${column}`);
    }
  }
  const ledgerColumns = ["source_system", "source_entity", "source_id", "target_entity", "target_id", "source_checksum", "imported_at", "created_at", "updated_at"];
  if (tables.has("data_migration_ledger")) {
    const ledger = await sequelize.getQueryInterface().describeTable("data_migration_ledger");
    for (const column of ledgerColumns) if (!Object.hasOwn(ledger, column)) missingColumns.push(`data_migration_ledger.${column}`);
  }
  if (missingColumns.length) fail(`Schema verification failed; missing existing columns: ${missingColumns.join(", ")}. No migrations or seeders were run.`);

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
  const existingIndexes = new Set(indexRows.map((row) => row.indexname.toLowerCase()));
  const missingIndexes = [...expectedIndexes].filter((name) => !existingIndexes.has(name));
  if (missingIndexes.length) fail(`Schema verification failed; missing migration indexes: ${missingIndexes.join(", ")}. No migrations or seeders were run.`);
  if (expectedConstraints.size) {
    const constraintRows = await sequelize.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE connamespace = current_schema()::regnamespace",
      { type: QueryTypes.SELECT },
    );
    const existingConstraints = new Set(constraintRows.map((row) => row.conname.toLowerCase()));
    const missingConstraints = [...expectedConstraints].filter((name) => !existingConstraints.has(name));
    if (missingConstraints.length) fail(`Schema verification failed; missing migration constraints: ${missingConstraints.join(", ")}. No migrations or seeders were run.`);
  }

  const constraintRequirements = tableConstraintRequirements(sql);
  if (constraintRequirements.size) {
    const constraintCounts = await sequelize.query<{ table_name: string; contype: string; count: number }>(
      `SELECT conrelid::regclass::text AS table_name, contype, count(*)::int AS count
       FROM pg_constraint
       WHERE connamespace = current_schema()::regnamespace AND contype IN ('c', 'f', 'u')
       GROUP BY conrelid, contype`,
      { type: QueryTypes.SELECT },
    );
    const actual = new Map<string, { c: number; f: number; u: number }>();
    for (const row of constraintCounts) {
      const table = row.table_name.split(".").at(-1)!.replaceAll('"', "").toLowerCase();
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
    if (missing.length) fail(`Schema verification failed; migration table constraints are missing: ${missing.join(", ")}. No migrations or seeders were run.`);
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

