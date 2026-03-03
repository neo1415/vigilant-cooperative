import Redis, { RedisOptions } from 'ioredis';
import type { Env } from '../config/env';

/**
 * Redis client wrapper with typed methods and connection retry logic
 */
export class RedisClient {
  private client: Redis;
  private isConnected = false;

  constructor(env: Env) {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect on READONLY errors
          return true;
        }
        return false;
      },
      enableReadyCheck: true,
      lazyConnect: false,
    };

    // Parse Redis URL
    const url = new URL(env.REDIS_URL);
    if (env.REDIS_PASSWORD) {
      url.password = env.REDIS_PASSWORD;
    }

    this.client = new Redis(url.toString(), options);

    // Event handlers
    this.client.on('connect', () => {
      console.log('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      console.log('✓ Redis client ready');
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });
  }

  /**
   * Check if Redis is connected and ready
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Set a value in Redis with optional TTL (in seconds)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Set a value only if it doesn't exist (NX) with expiry (EX)
   * Returns true if set, false if key already exists
   */
  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Delete one or more keys
   */
  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiry on a key (in seconds)
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * Get time to live for a key (in seconds)
   * Returns -1 if key has no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Increment a counter by a specific amount
   */
  async incrBy(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  /**
   * Get multiple values at once
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return this.client.mget(...keys);
  }

  /**
   * Set multiple values at once
   */
  async mset(keyValues: Record<string, string>): Promise<void> {
    const args: string[] = [];
    for (const [key, value] of Object.entries(keyValues)) {
      args.push(key, value);
    }
    await this.client.mset(...args);
  }

  /**
   * Add members to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Check if a member exists in a set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /**
   * Remove members from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * Get the underlying Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Forcefully disconnect (for emergency shutdown)
   */
  disconnect(): void {
    this.client.disconnect();
  }
}

/**
 * Create and initialize Redis client
 */
export function createRedisClient(env: Env): RedisClient {
  return new RedisClient(env);
}
