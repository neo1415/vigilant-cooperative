import { Worker, Job } from 'bullmq';
import type { RedisClient } from '../redis/client';
import { getRedisConnection, defaultWorkerOptions, QueueName } from './config';

/**
 * Base worker class with error handling and retry logic
 */
export abstract class BaseWorker<T = any, R = any> {
  protected worker: Worker<T, R>;

  constructor(
    queueName: QueueName,
    redis: RedisClient,
    options: Partial<typeof defaultWorkerOptions> = {}
  ) {
    const connection = getRedisConnection(redis);

    this.worker = new Worker<T, R>(
      queueName,
      async (job: Job<T>) => {
        return this.process(job);
      },
      {
        connection: connection as any,
        ...defaultWorkerOptions,
        ...options,
      }
    );

    // Event handlers
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} in queue ${queueName} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} in queue ${queueName} failed:`, err);
      this.onFailed(job, err);
    });

    this.worker.on('error', (err) => {
      console.error(`Worker error in queue ${queueName}:`, err);
    });

    console.log(`✓ Worker initialized for queue: ${queueName}`);
  }

  /**
   * Process a job - must be implemented by subclasses
   */
  protected abstract process(job: Job<T>): Promise<R>;

  /**
   * Handle failed jobs - can be overridden by subclasses
   */
  protected onFailed(job: Job<T> | undefined, error: Error): void {
    // Default implementation - log the error
    // Subclasses can override to implement custom failure handling
    if (job) {
      console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, error);
    }
  }

  /**
   * Close the worker gracefully
   */
  async close(): Promise<void> {
    await this.worker.close();
  }

  /**
   * Get the underlying worker instance
   */
  getWorker(): Worker<T, R> {
    return this.worker;
  }
}
