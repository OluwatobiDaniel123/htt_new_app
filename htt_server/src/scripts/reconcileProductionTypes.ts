import "dotenv/config";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { QueryInterface } from "sequelize";
import { env } from "../config/env.js";
import { sequelize } from "../models/index.js";

const migrationName = "20261104000000-reconcile-production-payment-and-player-types.cjs";
const migrationPath = resolve(process.cwd(), "migrations", migrationName);
const require = createRequire(import.meta.url);

type SingleMigration = {
  up: (queryInterface: QueryInterface) => Promise<void>;
};

const isSingleMigration = (value: unknown): value is SingleMigration =>
  typeof value === "object" && value !== null && "up" in value && typeof value.up === "function";

const run = async () => {
  let failed = false;
  try {
    if (env.NODE_ENV !== "production") {
      throw new Error("This command is restricted to NODE_ENV=production.");
    }

    const migrationModule: unknown = require(migrationPath);
    if (!isSingleMigration(migrationModule)) {
      throw new Error(`The targeted migration does not export an up function: ${migrationName}`);
    }

    await sequelize.authenticate();
    console.info(`Running the single targeted production migration: ${migrationName}`);
    await migrationModule.up(sequelize.getQueryInterface());
    console.info(`Production migration completed successfully: ${migrationName}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : "Unknown migration failure.";
    console.error(`Production type reconciliation failed: ${message}`);
  } finally {
    try {
      await sequelize.close();
      console.info("Database connection closed.");
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : "Unknown connection close failure.";
      console.error(`Failed to close the database connection: ${message}`);
    }
  }

  if (failed) process.exitCode = 1;
};

await run();
