import { Pool } from 'pg';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Create a .env.local file (you can copy env.local.example) or set DATABASE_URL, then restart the dev server.`,
    );
  }
  return value;
}

let pool;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  pool = connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'eauctionuser',
        database: process.env.PGDATABASE || 'eauctiondb',
        password: requiredEnv('PGPASSWORD'),
      });

  return pool;
}

export default getPool;

