import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required configuration is present and valid at startup
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_URL: z.string().url().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string().min(1),
  DATABASE_READ_REPLICA_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().min(1),
  REDIS_PASSWORD: z.string().optional(),

  // Encryption Keys
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 64 hex characters'),
  BCRYPT_PEPPER: z.string().min(32),

  // JWT
  JWT_SECRET: z.string().min(64, 'JWT secret must be at least 64 characters'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

  // Monnify Integration
  MONNIFY_API_KEY: z.string().min(1),
  MONNIFY_SECRET_KEY: z.string().min(1),
  MONNIFY_CONTRACT_CODE: z.string().min(1),
  MONNIFY_BASE_URL: z.string().url(),

  // Termii SMS
  TERMII_API_KEY: z.string().min(1),
  TERMII_SENDER_ID: z.string().default('Vigilant'),

  // Resend Email
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),

  // Cloudflare R2 (Document Storage)
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),

  // Security
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default('15m'),
  SESSION_TIMEOUT: z.string().default('30m'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables
 * Throws if validation fails with detailed error messages
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      throw new Error(
        `Environment validation failed:\n${missingVars.join('\n')}\n\nPlease check your .env file against .env.example`
      );
    }
    throw error;
  }
}
