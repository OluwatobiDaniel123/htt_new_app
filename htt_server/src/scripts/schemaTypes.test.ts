import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogString, migrationConstraintRequirements, missingConstraintCounts, namedConstraintFailureMessage, postgresColumnTypeMatches, PRODUCTION_SCHEMA, readCatalogField, type PostgresColumnType, type TableConstraintCounts } from "./schemaTypes.js";

const column = (values: Partial<PostgresColumnType>): PostgresColumnType => ({
  data_type: "text",
  udt_name: "text",
  character_maximum_length: null,
  numeric_precision: null,
  numeric_scale: null,
  ...values,
});

test("schema type comparison accepts Sequelize string types and PostgreSQL char aliases", () => {
  assert.equal(postgresColumnTypeMatches("VARCHAR(180)", column({ data_type: "character varying", udt_name: "varchar", character_maximum_length: 180 })), true);
  const widerColumn = column({ data_type: "character varying", udt_name: "varchar", character_maximum_length: 255 });
  assert.equal(postgresColumnTypeMatches("VARCHAR(180)", widerColumn), false);
  assert.equal(postgresColumnTypeMatches("VARCHAR(180)", widerColumn, { allowWiderCharacterLength: true }), true);
  assert.equal(postgresColumnTypeMatches("VARCHAR(3)", column({ data_type: "character", udt_name: "bpchar", character_maximum_length: 3 })), true);
  assert.equal(postgresColumnTypeMatches("VARCHAR(180)", column({ data_type: "character varying", character_maximum_length: 160 })), false);
});

test("schema type comparison checks numeric precision and scale", () => {
  assert.equal(postgresColumnTypeMatches("DECIMAL(12,2)", column({ data_type: "numeric", udt_name: "numeric", numeric_precision: 12, numeric_scale: 2 })), true);
  assert.equal(postgresColumnTypeMatches("DECIMAL(12,2)", column({ data_type: "numeric", udt_name: "numeric", numeric_precision: 12, numeric_scale: 4 })), false);
});

test("schema type comparison accepts text or varchar backing for Sequelize string arrays", () => {
  assert.equal(postgresColumnTypeMatches("VARCHAR(255)[]", column({ data_type: "ARRAY", udt_name: "_text" })), true);
  assert.equal(postgresColumnTypeMatches("VARCHAR(255)[]", column({ data_type: "ARRAY", udt_name: "_varchar" })), true);
  assert.equal(postgresColumnTypeMatches("VARCHAR(255)[]", column({ data_type: "ARRAY", udt_name: "_int4" })), false);
});

test("schema type comparison recognizes timestamp, date, UUID and JSONB", () => {
  assert.equal(postgresColumnTypeMatches("TIMESTAMP WITH TIME ZONE", column({ data_type: "timestamp with time zone", udt_name: "timestamptz" })), true);
  assert.equal(postgresColumnTypeMatches("DATE", column({ data_type: "date", udt_name: "date" })), true);
  assert.equal(postgresColumnTypeMatches("UUID", column({ data_type: "uuid", udt_name: "uuid" })), true);
  assert.equal(postgresColumnTypeMatches("JSONB", column({ data_type: "jsonb", udt_name: "jsonb" })), true);
});

test("catalog field reader handles Sequelize PostgreSQL table-name rows and explicit aliases", () => {
  assert.equal(readCatalogField(["centres"], ["tableName", "table_name"], "table lookup"), "centres");
  assert.equal(readCatalogField({ tableName: "centres" }, ["tableName", "table_name"], "table lookup"), "centres");
  assert.equal(readCatalogField({ table_name: "centres" }, ["tableName", "table_name"], "table lookup"), "centres");
});

test("catalog failures report returned field names without exposing row values", () => {
  assert.throws(
    () => readCatalogField({ unexpected: "private-value" }, ["tableName", "table_name"], "information_schema.tables lookup"),
    /expected field tableName or table_name; received fields \[unexpected\]/,
  );
  assert.throws(() => catalogString(undefined, "information_schema.tables.table_name"), /expected a non-empty string, received undefined/);
});

test("migration constraint parser counts registrations foreign keys from CREATE and ALTER TABLE", async () => {
  const initialSchema = await readFile(resolve(process.cwd(), "migrations/20261029000000-create-initial-schema.cjs"), "utf8");
  const requirements = migrationConstraintRequirements([initialSchema]);

  assert.equal(requirements.get("registrations")?.f, 5);
});

test("migration constraint parser counts foreign keys added by ALTER TABLE for other tables", () => {
  const requirements = migrationConstraintRequirements([`
    CREATE TABLE refresh_sessions (id uuid PRIMARY KEY);
    ALTER TABLE refresh_sessions
      ADD COLUMN replaced_by_session_id uuid REFERENCES refresh_sessions(id) ON DELETE SET NULL;
  `]);

  assert.equal(requirements.get("refresh_sessions")?.f, 1);
});

test("production schema verification targets the public schema consistently", async () => {
  const productionSetup = await readFile(resolve(process.cwd(), "src/scripts/productionSetup.ts"), "utf8");

  assert.equal(PRODUCTION_SCHEMA, "public");
  assert.match(productionSetup, /const schemaName = PRODUCTION_SCHEMA/);
  assert.doesNotMatch(productionSetup, /current_schema\s*\(/i);
  assert.match(productionSetup, /namespace\.nspname = :schema/);
  assert.match(productionSetup, /tables\.table_schema = :schema/);
});

test("named migration constraint failures identify the checked schema", () => {
  assert.equal(
    namedConstraintFailureMessage("public", ["registrations_guardian_fk (migration: 20261029000000-create-initial-schema.cjs)"]),
    "Schema verification failed in schema public; missing migration constraints: registrations_guardian_fk (migration: 20261029000000-create-initial-schema.cjs). No migrations or seeders were run.",
  );
});

test("only public registrations foreign-key counts are temporarily excluded", () => {
  const requirements = new Map<string, TableConstraintCounts>([
    ["registrations", { c: 2, f: 5, u: 1 }],
    ["players", { c: 1, f: 1, u: 0 }],
  ]);
  const actual = new Map<string, TableConstraintCounts>([
    ["registrations", { c: 1, f: 2, u: 0 }],
    ["players", { c: 1, f: 0, u: 0 }],
  ]);

  assert.deepEqual(missingConstraintCounts("public", requirements, actual), [
    { table: "registrations", kind: "c", expected: 2, actual: 1 },
    { table: "registrations", kind: "u", expected: 1, actual: 0 },
    { table: "players", kind: "f", expected: 1, actual: 0 },
  ]);
  assert.deepEqual(missingConstraintCounts("archive", requirements, actual), [
    { table: "registrations", kind: "c", expected: 2, actual: 1 },
    { table: "registrations", kind: "f", expected: 5, actual: 2 },
    { table: "registrations", kind: "u", expected: 1, actual: 0 },
    { table: "players", kind: "f", expected: 1, actual: 0 },
  ]);
});

test("temporary foreign-key exception leaves the other production schema checks enabled", async () => {
  const productionSetup = await readFile(resolve(process.cwd(), "src/scripts/productionSetup.ts"), "utf8");

  assert.match(productionSetup, /missingConstraintCounts\(schemaName, constraintRequirements, actual\)/);
  assert.match(productionSetup, /missingTables\.length/);
  assert.match(productionSetup, /missingColumns\.length/);
  assert.match(productionSetup, /mismatchedTypes\.length/);
  assert.match(productionSetup, /missingIndexes\.length/);
  assert.match(productionSetup, /missingConstraints\.length/);
});

test("production setup seeder paths resolve to the five required source files", async () => {
  const productionSetup = await readFile(resolve(process.cwd(), "src/scripts/productionSetup.ts"), "utf8");
  const gitignore = await readFile(resolve(process.cwd(), ".gitignore"), "utf8");
  const seederDirectory = resolve(process.cwd(), "seeders");
  const requiredSeeders = [
    "20261029000000-seed-rbac.cjs",
    "20261029000001-phase4-academy-permissions.cjs",
    "20261029000003-phase6-notification-permissions.cjs",
    "20261030000000-phase7-safeguarding-permissions.cjs",
    "20261102000000-coaching-apprentice-permission.cjs",
  ];

  assert.match(productionSetup, /const seederDirectory = resolve\(process\.cwd\(\), "seeders"\)/);
  assert.doesNotMatch(gitignore, /^\s*seeders\/\s*$/m);
  await Promise.all(requiredSeeders.map((name) => access(resolve(seederDirectory, name))));
});
