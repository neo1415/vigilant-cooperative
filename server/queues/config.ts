import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import type { RedisClient } from '../redis/client';

/**
 * Queue names used throughout the application
 */
export const QUEUE_NAMES = {
  NOTIFICATION: 'notificationQueue',
  PAYROLL: 'payrollQueue',
  REPORT: 'reportQueue',
  RECONCILIATION: 'reconciliationQueue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Get Redis connection options for BullMQ
 */
export function getRedisConnection(redis: RedisClient) {
  return redis.getClient();
}

/**
 * Default queue options with retry strategy
 */
export const defaultQueueOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
      count: 5000, // Keep last 5000 failed jobs
    },
  },
};

/**
 * Default worker options
 */
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000, // 10 jobs per second
  },
};
