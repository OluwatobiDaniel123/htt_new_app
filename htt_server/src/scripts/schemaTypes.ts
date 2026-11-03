export interface PostgresColumnType {
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

const lower = (value: string) => value.toLowerCase();

const receivedFields = (row: unknown) => {
  if (Array.isArray(row)) return `[${row.map((_value, index) => index).join(", ")}]`;
  if (typeof row === "object" && row !== null) return `[${Object.keys(row).sort().join(", ")}]`;
  return `[] (row type: ${row === null ? "null" : typeof row})`;
};

export const readCatalogField = (row: unknown, fieldNames: string[], context: string): unknown => {
  if (Array.isArray(row) && row.length === 1) return row[0];
  if (typeof row === "object" && row !== null) {
    for (const name of fieldNames) {
      if (Object.hasOwn(row, name)) return Reflect.get(row, name);
    }
  }
  throw new Error(`Schema verification failed for ${context}: expected field ${fieldNames.join(" or ")}; received fields ${receivedFields(row)}.`);
};

export const catalogString = (value: unknown, context: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Schema verification failed for ${context}: expected a non-empty string, received ${value === null ? "null" : typeof value}.`);
  }
  return value;
};

const numericShapeMatches = (expected: string, column: PostgresColumnType) => {
  const match = expected.match(/^(?:DECIMAL|NUMERIC)(?:\((\d+),(\d+)\))?$/i);
  if (!match || column.data_type !== "numeric") return false;
  if (!match[1]) return true;
  return Number(column.numeric_precision) === Number(match[1]) && Number(column.numeric_scale) === Number(match[2]);
};

const characterShapeMatches = (
  expected: string,
  column: PostgresColumnType,
  allowWiderLength: boolean,
) => {
  const match = expected.match(/^(VARCHAR|CHAR|CHARACTER VARYING|CHARACTER)(?:\((\d+)\))?$/i);
  if (!match) return false;
  if (!["character varying", "character"].includes(column.data_type)) return false;
  if (!match[2]) return true;
  return allowWiderLength
    ? Number(column.character_maximum_length) >= Number(match[2])
    : Number(column.character_maximum_length) === Number(match[2]);
};

const arrayElementMatches = (elementSql: string, udtName: string) => {
  const element = lower(elementSql.trim());
  if (element.startsWith("varchar") || element.startsWith("character varying") || element.startsWith("text") || element.startsWith("char")) {
    return ["_varchar", "_text", "_bpchar"].includes(udtName);
  }
  const expectedUdt: Record<string, string[]> = {
    uuid: ["_uuid"], integer: ["_int4"], bigint: ["_int8"], smallint: ["_int2"],
    boolean: ["_bool"], date: ["_date"], jsonb: ["_jsonb"], json: ["_json"],
  };
  const base = element.replace(/\(.*\)$/, "");
  return expectedUdt[base]?.includes(udtName) ?? false;
};

/** Compare Sequelize's PostgreSQL SQL type with information_schema's portable type fields. */
export const postgresColumnTypeMatches = (
  sequelizeSqlType: string,
  column: PostgresColumnType,
  options: { allowWiderCharacterLength?: boolean } = {},
): boolean => {
  const expected = sequelizeSqlType.trim().replace(/\s+/g, " ").toUpperCase();
  const actual = lower(column.data_type);
  const array = expected.match(/^(.*)\[\]$/);
  if (array) return actual === "array" && arrayElementMatches(array[1]!, column.udt_name);
  if (characterShapeMatches(expected, column, options.allowWiderCharacterLength === true)) return true;
  if (numericShapeMatches(expected, column)) return true;

  const expectedDataType: Record<string, string[]> = {
    UUID: ["uuid"], TEXT: ["text"], INTEGER: ["integer"], BIGINT: ["bigint"],
    SMALLINT: ["smallint"], BOOLEAN: ["boolean"], DATE: ["date"],
    "TIMESTAMP WITH TIME ZONE": ["timestamp with time zone"],
    "TIMESTAMP WITHOUT TIME ZONE": ["timestamp without time zone"],
    JSON: ["json"], JSONB: ["jsonb"], "DOUBLE PRECISION": ["double precision"],
    REAL: ["real"],
  };
  return expectedDataType[expected]?.includes(actual) ?? false;
};
