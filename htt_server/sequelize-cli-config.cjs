'use strict';

require('dotenv').config();

const sslEnabled = !['false', '0', 'no'].includes(String(process.env.DB_SSL ?? 'true').toLowerCase());
const ssl = sslEnabled
  ? {
      require: true,
      rejectUnauthorized: !['false', '0', 'no'].includes(
        String(process.env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase(),
      ),
    }
  : false;

const pool = {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  min: Number(process.env.DB_POOL_MIN ?? 0),
  acquire: Number(process.env.DB_POOL_ACQUIRE_MS ?? 30000),
  idle: Number(process.env.DB_POOL_IDLE_MS ?? 10000),
};

const common = {
  dialect: 'postgres',
  logging: false,
  pool,
  ...(ssl ? { dialectOptions: { ssl } } : {}),
};

const connection = process.env.DATABASE_URL
  ? { ...common, use_env_variable: 'DATABASE_URL' }
  : {
      ...common,
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'htt_academy',
      username: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD ?? '',
    };

module.exports = {
  development: connection,
  test: connection,
  production: connection,
};
