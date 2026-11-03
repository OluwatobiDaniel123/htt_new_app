export interface PostgresColumnType {
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

const lower = (value: string) => value.toLowerCase();

const numericShapeMatches = (expected: string, column: PostgresColumnType) => {
  const match = expected.match(/^(?:DECIMAL|NUMERIC)(?:\((\d+),(\d+)\))?$/i);
  if (!match || column.data_type !== "numeric") return false;
  if (!match[1]) return true;
  return Number(column.numeric_precision) === Number(match[1]) && Number(column.numeric_scale) === Number(match[2]);
};

const characterShapeMatches = (expected: string, column: PostgresColumnType) => {
  const match = expected.match(/^(VARCHAR|CHAR|CHARACTER VARYING|CHARACTER)(?:\((\d+)\))?$/i);
  if (!match) return false;
  if (!["character varying", "character"].includes(column.data_type)) return false;
  if (!match[2]) return true;
  return Number(column.character_maximum_length) === Number(match[2]);
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
export const postgresColumnTypeMatches = (sequelizeSqlType: string, column: PostgresColumnType): boolean => {
  const expected = sequelizeSqlType.trim().replace(/\s+/g, " ").toUpperCase();
  const actual = lower(column.data_type);
  const array = expected.match(/^(.*)\[\]$/);
  if (array) return actual === "array" && arrayElementMatches(array[1]!, column.udt_name);
  if (characterShapeMatches(expected, column)) return true;
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
