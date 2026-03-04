/**
 * Redis client singleton for Next.js API routes
 */

import { RedisClient, createRedisClient } from '@/server/redis/client';

let redisClient: RedisClient | null = null;

/**
 * Get or create Redis client singleton
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!redisClient) {
    // Create env object from environment variables
    const env = {
      REDIS_URL: process.env.REDIS_URL!,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    } as any;

    redisClient = createRedisClient(env);

    // Wait for connection to be ready
    let retries = 0;
    while (!(await redisClient.isHealthy()) && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (!(await redisClient.isHealthy())) {
      throw new Error('Failed to connect to Redis');
    }
  }

  return redisClient;
}
