export const connectionIdentityQuery = `
  SELECT
    current_database() AS database_name,
    current_user AS database_user,
    inet_server_addr()::text AS server_address,
    inet_server_port() AS server_port,
    current_schema() AS current_schema
`;

export const registrationForeignKeyCountQuery = `
  SELECT count(*)::int AS foreign_key_count
  FROM pg_constraint AS constraint_row
  JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'registrations'
    AND constraint_row.contype = 'f'
`;

export const registrationForeignKeyDetailsQuery = `
  SELECT
    constraint_row.conname AS constraint_name,
    pg_get_constraintdef(constraint_row.oid, true) AS definition,
    constraint_row.convalidated AS validated
  FROM pg_constraint AS constraint_row
  JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'registrations'
    AND constraint_row.contype = 'f'
  ORDER BY constraint_row.conname
`;

export interface ConnectionIdentity {
  database_name: string;
  database_user: string;
  server_address: string | null;
  server_port: number | null;
  current_schema: string | null;
}

export interface RegistrationForeignKey {
  constraint_name: string;
  definition: string;
  validated: boolean;
}

export const buildProductionSchemaDiagnostic = (
  identity: ConnectionIdentity,
  foreignKeyCount: number,
  constraints: RegistrationForeignKey[],
) => ({
  database: {
    name: identity.database_name,
    user: identity.database_user,
    serverAddress: identity.server_address,
    serverPort: identity.server_port,
    currentSchema: identity.current_schema,
  },
  registrations: {
    schema: "public",
    foreignKeyCount,
    foreignKeys: constraints.map(({ constraint_name, definition, validated }) => ({
      name: constraint_name,
      definition,
      validated,
    })),
  },
});
