import test from "node:test";
import assert from "node:assert/strict";
import { postgresColumnTypeMatches, type PostgresColumnType } from "./schemaTypes.js";

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
