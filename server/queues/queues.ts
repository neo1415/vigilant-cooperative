import { Queue } from 'bullmq';
import type { RedisClient } from '../redis/client';
import { QUEUE_NAMES, getRedisConnection, defaultQueueOptions } from './config';

/**
 * Queue definitions for background jobs
 */
export class Queues {
  public notificationQueue: Queue;
  public payrollQueue: Queue;
  public reportQueue: Queue;
  public reconciliationQueue: Queue;

  constructor(redis: RedisClient) {
    const connection = getRedisConnection(redis);

    this.notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
      connection: connection as any,
      ...defaultQueueOptions,
    });

    this.payrollQueue = new Queue(QUEUE_NAMES.PAYROLL, {
      connection: connection as any,
      ...defaultQueueOptions,
    });

    this.reportQueue = new Queue(QUEUE_NAMES.REPORT, {
      connection: connection as any,
      ...defaultQueueOptions,
    });

    this.reconciliationQueue = new Queue(QUEUE_NAMES.RECONCILIATION, {
      connection: connection as any,
      ...defaultQueueOptions,
    });

    console.log('✓ BullMQ queues initialized');
  }

  /**
   * Close all queues gracefully
   */
  async closeAll(): Promise<void> {
    await Promise.all([
      this.notificationQueue.close(),
      this.payrollQueue.close(),
      this.reportQueue.close(),
      this.reconciliationQueue.close(),
    ]);
    console.log('✓ All queues closed');
  }

  /**
   * Get queue health status
   */
  async getHealthStatus() {
    const [notificationCounts, payrollCounts, reportCounts, reconciliationCounts] =
      await Promise.all([
        this.notificationQueue.getJobCounts(),
        this.payrollQueue.getJobCounts(),
        this.reportQueue.getJobCounts(),
        this.reconciliationQueue.getJobCounts(),
      ]);

    return {
      notification: notificationCounts,
      payroll: payrollCounts,
      report: reportCounts,
      reconciliation: reconciliationCounts,
    };
  }
}

/**
 * Initialize all queues
 */
export function initializeQueues(redis: RedisClient): Queues {
  return new Queues(redis);
}
