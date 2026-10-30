import { Sequelize } from "sequelize";
import { env } from "./env.js";

const commonOptions = {
  dialect: "postgres" as const,
  logging: false,
  pool: {
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    acquire: env.DB_POOL_ACQUIRE_MS,
    idle: env.DB_POOL_IDLE_MS,
  },
  ...(env.DB_SSL
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
          },
        },
      }
    : {}),
};

export const sequelize = env.DATABASE_URL
  ? new Sequelize(env.DATABASE_URL, commonOptions)
  : new Sequelize(env.PGDATABASE, env.PGUSER, env.PGPASSWORD, {
      ...commonOptions,
      host: env.PGHOST,
      port: env.PGPORT,
    });
