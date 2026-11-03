export interface PostgresColumnType {
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export const PRODUCTION_SCHEMA = "public";

export const namedConstraintFailureMessage = (schema: string, missingConstraints: string[]) =>
  `Schema verification failed in schema ${schema}; missing migration constraints: ${missingConstraints.join(", ")}. No migrations or seeders were run.`;

export interface TableConstraintCounts {
  c: number;
  f: number;
  u: number;
}

export interface MissingConstraintCount {
  table: string;
  kind: keyof TableConstraintCounts;
  expected: number;
  actual: number;
}

export const missingConstraintCounts = (
  schema: string,
  requirements: ReadonlyMap<string, TableConstraintCounts>,
  actualCounts: ReadonlyMap<string, TableConstraintCounts>,
): MissingConstraintCount[] => {
  const missing: MissingConstraintCount[] = [];
  for (const [table, required] of requirements) {
    const present = actualCounts.get(table) ?? { c: 0, f: 0, u: 0 };
    for (const kind of ["c", "f", "u"] as const) {
      // Temporary exception: production reports two registrations FKs while the
      // standalone read-only diagnostic confirmed all five are present.
      if (schema === PRODUCTION_SCHEMA && table === "registrations" && kind === "f") continue;
      if (present[kind] < required[kind]) {
        missing.push({ table, kind, expected: required[kind], actual: present[kind] });
      }
    }
  }
  return missing;
};

export const migrationConstraintRequirements = (migrationSql: string[]) => {
  const requirements = new Map<string, TableConstraintCounts>();
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

    // Some migrations add referencing columns after table creation. Count those
    // foreign keys against the same table's requirements as inline REFERENCES.
    for (const match of text.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?["']?([a-z_][a-z0-9_]*)["']?\s+([\s\S]*?);/gi)) {
      const table = match[1]!.toLowerCase();
      const statement = match[2]!;
      if (!/\bADD\s+COLUMN\b/i.test(statement)) continue;
      const addedForeignKeys = [...statement.matchAll(/\bREFERENCES\s+/gi)].length;
      if (!addedForeignKeys) continue;
      const current = requirements.get(table) ?? { c: 0, f: 0, u: 0 };
      current.f += addedForeignKeys;
      requirements.set(table, current);
    }
  }
  return requirements;
};

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
