import type { RedisClient } from '../redis/client';

/**
 * Distributed lock service using Redis SET NX EX
 * Prevents concurrent modifications to the same resource
 */
export class DistributedLockService {
  constructor(private redis: RedisClient) {}

  /**
   * Acquire a distributed lock
   * @param key Lock key (e.g., "lock:user:123:financial")
   * @param ttlSeconds Time to live in seconds (default: 30)
   * @returns Lock token if acquired, null if lock is held by another process
   */
  async acquire(key: string, ttlSeconds: number = 30): Promise<string | null> {
    const token = `${Date.now()}-${Math.random()}`;
    const lockKey = `lock:${key}`;

    const acquired = await this.redis.setNX(lockKey, token, ttlSeconds);

    if (acquired) {
      return token;
    }

    return null;
  }

  /**
   * Release a distributed lock
   * @param key Lock key
   * @param token Lock token returned from acquire
   */
  async release(key: string, token: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const currentToken = await this.redis.get(lockKey);

    // Only release if we own the lock
    if (currentToken === token) {
      await this.redis.del(lockKey);
      return true;
    }

    return false;
  }

  /**
   * Execute a function with a distributed lock
   * Automatically acquires and releases the lock
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttlSeconds?: number; timeoutMs?: number } = {}
  ): Promise<T> {
    const { ttlSeconds = 30, timeoutMs = 5000 } = options;

    const startTime = Date.now();
    let token: string | null = null;

    // Try to acquire lock with timeout
    while (!token && Date.now() - startTime < timeoutMs) {
      token = await this.acquire(key, ttlSeconds);
      if (!token) {
        // Wait 50ms before retrying
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    if (!token) {
      throw new Error(`Failed to acquire lock for key: ${key} within ${timeoutMs}ms`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}

/**
 * Create distributed lock service
 */
export function createDistributedLockService(redis: RedisClient): DistributedLockService {
  return new DistributedLockService(redis);
}
