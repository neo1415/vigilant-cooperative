import { Worker, Job } from 'bullmq';
import { processPayrollBatch, type PayrollRow } from '../../services/payroll.service';

// Redis connection options for BullMQ
const redisConnection = {
  host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
  port: Number(process.env.REDIS_URL?.split(':')[2]) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
};

export interface PayrollJobData {
  importId: string;
  rows: PayrollRow[];
  periodMonth: number;
  periodYear: number;
  uploadedBy: string;
}

/**
 * Payroll Worker
 * Processes payroll CSV imports in the background
 */
export const payrollWorker = new Worker<PayrollJobData>(
  'payroll-processing',
  async (job: Job<PayrollJobData>) => {
    const { importId, rows, periodMonth, periodYear } = job.data;

    try {
      console.log(`[Payroll Worker] Processing job ${job.id} for import ${importId}`);

      // Update progress
      await job.updateProgress(10);

      // Process payroll batch
      const result = await processPayrollBatch(importId, rows, periodMonth, periodYear);

      if (!result.success) {
        throw new Error(result.error);
      }

      await job.updateProgress(90);

      // TODO: Send notification to uploader
      console.log(
        `[Payroll Worker] Successfully processed ${result.value.successCount}/${result.value.totalMembers} records`
      );

      await job.updateProgress(100);

      return {
        success: true,
        ...result.value,
      };
    } catch (error) {
      console.error(`[Payroll Worker] Failed to process payroll:`, error);
      throw error; // Re-throw to trigger retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one payroll at a time
    limiter: {
      max: 1,
      duration: 5000, // Max 1 job per 5 seconds
    },
  }
);

// Error handler
payrollWorker.on('failed', (job, err) => {
  console.error(`[Payroll Worker] Job ${job?.id} failed:`, err.message);
});

// Success handler
payrollWorker.on('completed', (job, result) => {
  console.log(`[Payroll Worker] Job ${job.id} completed successfully:`, result);
});

// Progress handler
payrollWorker.on('progress', (job, progress) => {
  console.log(`[Payroll Worker] Job ${job.id} progress: ${progress}%`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Payroll Worker] Shutting down gracefully...');
  await payrollWorker.close();
  process.exit(0);
});

console.log('[Payroll Worker] Payroll processing worker started');
