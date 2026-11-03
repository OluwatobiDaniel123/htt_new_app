import { QueryTypes } from "sequelize";
import { env } from "../config/env.js";
import { sequelize } from "../models/index.js";
import {
  buildProductionSchemaDiagnostic,
  connectionIdentityQuery,
  registrationForeignKeyCountQuery,
  registrationForeignKeyDetailsQuery,
  type ConnectionIdentity,
  type RegistrationForeignKey,
} from "./productionSchemaDiagnostics.js";

const runDiagnostic = async () => {
  if (env.NODE_ENV !== "production") {
    throw new Error("This diagnostic is restricted to NODE_ENV=production.");
  }
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to use the production connection.");
  }

  try {
    const identityRows = await sequelize.query<ConnectionIdentity>(connectionIdentityQuery, {
      type: QueryTypes.SELECT,
      raw: true,
    });
    const countRows = await sequelize.query<{ foreign_key_count: number }>(registrationForeignKeyCountQuery, {
      type: QueryTypes.SELECT,
      raw: true,
    });
    const constraintRows = await sequelize.query<RegistrationForeignKey>(registrationForeignKeyDetailsQuery, {
      type: QueryTypes.SELECT,
      raw: true,
    });

    const identity = identityRows[0];
    const foreignKeyCount = countRows[0]?.foreign_key_count;
    if (!identity || foreignKeyCount === undefined) {
      throw new Error("The read-only diagnostic queries returned incomplete results.");
    }

    const report = buildProductionSchemaDiagnostic(identity, foreignKeyCount, constraintRows);
    console.info(`Production schema diagnostic (read-only):\n${JSON.stringify(report, null, 2)}`);
  } finally {
    await sequelize.close();
  }
};

runDiagnostic().catch(() => {
  console.error("Production schema diagnostic failed. Error details are omitted to prevent connection settings or credentials from appearing in logs.");
  process.exitCode = 1;
});
