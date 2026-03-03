import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '../config/env';

/**
 * Database connection pool configuration
 * Uses connection pooling for efficient resource management
 */
export function createDatabaseConnection(env: Env) {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000, // 30 seconds
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  const db = drizzle(pool);

  return { db, pool };
}

/**
 * Create read replica connection for reports
 * Falls back to main database if replica URL not provided
 */
export function createReadReplicaConnection(env: Env) {
  const connectionString = env.DATABASE_READ_REPLICA_URL || env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected read replica pool error:', err);
  });

  const db = drizzle(pool);

  return { db, pool };
}

/**
 * Close database connections gracefully
 */
export async function closeDatabaseConnections(pools: Pool[]) {
  await Promise.all(pools.map((pool) => pool.end()));
}
