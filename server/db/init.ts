import { drizzle } from 'drizzle-orm/node-postgres';
import { createDatabaseConnection, createReadReplicaConnection } from './connection';
import type { Env } from '../config/env';

/**
 * Initialize database connections
 */
export async function initializeDatabase(env: Env) {
  const { db: mainDb, pool: mainPool } = createDatabaseConnection(env);
  const { db: replicaDb, pool: replicaPool } = createReadReplicaConnection(env);

  console.log('✓ Database connections initialized');

  return {
    mainDb,
    mainPool,
    replicaDb,
    replicaPool,
  };
}

// Export db instance for seed script
export const { db } = createDatabaseConnection({
  DATABASE_URL: process.env.DATABASE_URL || '',
  DATABASE_READ_REPLICA_URL: process.env.DATABASE_READ_REPLICA_URL,
  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
  BCRYPT_PEPPER: process.env.BCRYPT_PEPPER || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_ACCESS_TOKEN_EXPIRY: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
  JWT_REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
  MONNIFY_API_KEY: process.env.MONNIFY_API_KEY || '',
  MONNIFY_SECRET_KEY: process.env.MONNIFY_SECRET_KEY || '',
  MONNIFY_CONTRACT_CODE: process.env.MONNIFY_CONTRACT_CODE || '',
  MONNIFY_BASE_URL: process.env.MONNIFY_BASE_URL || '',
  TERMII_API_KEY: process.env.TERMII_API_KEY || '',
  TERMII_SENDER_ID: process.env.TERMII_SENDER_ID || 'Vigilant',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || '15m',
  SESSION_TIMEOUT: process.env.SESSION_TIMEOUT || '30m',
  LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
  NODE_ENV: (process.env.NODE_ENV as any) || 'development',
  PORT: Number(process.env.PORT) || 3001,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
});
