import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProductionSchemaDiagnostic,
  connectionIdentityQuery,
  registrationForeignKeyCountQuery,
  registrationForeignKeyDetailsQuery,
  type ConnectionIdentity,
  type RegistrationForeignKey,
} from "./productionSchemaDiagnostics.js";

test("production schema diagnostics use read-only SELECT queries for identity and registration foreign keys", () => {
  for (const query of [connectionIdentityQuery, registrationForeignKeyCountQuery, registrationForeignKeyDetailsQuery]) {
    assert.match(query.trim(), /^SELECT\b/i);
    assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
  }
  assert.match(connectionIdentityQuery, /current_database\(\)/);
  assert.match(connectionIdentityQuery, /current_user/);
  assert.match(connectionIdentityQuery, /inet_server_addr\(\)/);
  assert.match(connectionIdentityQuery, /inet_server_port\(\)/);
  assert.match(connectionIdentityQuery, /current_schema\(\)/);
  assert.match(registrationForeignKeyCountQuery, /namespace\.nspname = 'public'/);
  assert.match(registrationForeignKeyCountQuery, /relation\.relname = 'registrations'/);
  assert.match(registrationForeignKeyCountQuery, /constraint_row\.contype = 'f'/);
  assert.match(registrationForeignKeyDetailsQuery, /pg_get_constraintdef/);
  assert.match(registrationForeignKeyDetailsQuery, /constraint_row\.convalidated/);
});

test("diagnostic report includes approved connection and constraint fields only", () => {
  const identityWithSecret = {
    database_name: "academy",
    database_user: "app_role",
    server_address: "192.0.2.10",
    server_port: 5432,
    current_schema: "public",
    password: "must-not-be-reported",
  };
  const foreignKeyWithSecret = {
    constraint_name: "registrations_centre_id_fkey",
    definition: "FOREIGN KEY (centre_id) REFERENCES centres(id) ON DELETE SET NULL",
    validated: true,
    token: "must-not-be-reported",
  };
  const report = buildProductionSchemaDiagnostic(
    identityWithSecret satisfies ConnectionIdentity,
    1,
    [foreignKeyWithSecret satisfies RegistrationForeignKey],
  );

  assert.deepEqual(report, {
    database: {
      name: "academy",
      user: "app_role",
      serverAddress: "192.0.2.10",
      serverPort: 5432,
      currentSchema: "public",
    },
    registrations: {
      schema: "public",
      foreignKeyCount: 1,
      foreignKeys: [{
        name: "registrations_centre_id_fkey",
        definition: "FOREIGN KEY (centre_id) REFERENCES centres(id) ON DELETE SET NULL",
        validated: true,
      }],
    },
  });
  assert.doesNotMatch(JSON.stringify(report), /must-not-be-reported/);
});
