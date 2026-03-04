import { Worker, Job } from 'bullmq';
import { sendSMS, sendEmail, markAsDelivered, markAsFailed } from '../../services/notification.service';

// Redis connection options for BullMQ
const redisConnection = {
  host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
  port: Number(process.env.REDIS_URL?.split(':')[2]) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
};

// Job data types
export interface SMSJobData {
  notificationId: string;
  userId: string;
  phone: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface EmailJobData {
  notificationId: string;
  userId: string;
  email: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * SMS Worker
 * Processes SMS notifications via Termii
 */
export const smsWorker = new Worker<SMSJobData>(
  'sms-notifications',
  async (job: Job<SMSJobData>) => {
    const { notificationId, userId, phone, message, metadata } = job.data;

    try {
      console.log(`[SMS Worker] Processing job ${job.id} for notification ${notificationId}`);

      // Send SMS
      const result = await sendSMS({
        userId,
        phone,
        message,
        ...(metadata && { metadata }),
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      // Mark as delivered
      await markAsDelivered(notificationId);

      console.log(`[SMS Worker] Successfully sent SMS to ${phone}`);
      return { success: true, notificationId };
    } catch (error) {
      console.error(`[SMS Worker] Failed to send SMS:`, error);

      // Mark as failed
      await markAsFailed(
        notificationId,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error; // Re-throw to trigger retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 SMS at a time
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second (rate limiting)
    },
  }
);

/**
 * Email Worker
 * Processes email notifications via Resend
 */
export const emailWorker = new Worker<EmailJobData>(
  'email-notifications',
  async (job: Job<EmailJobData>) => {
    const { notificationId, userId, email, subject, body, metadata } = job.data;

    try {
      console.log(`[Email Worker] Processing job ${job.id} for notification ${notificationId}`);

      // Send email
      const result = await sendEmail({
        userId,
        email,
        subject,
        body,
        ...(metadata && { metadata }),
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      // Mark as delivered
      await markAsDelivered(notificationId);

      console.log(`[Email Worker] Successfully sent email to ${email}`);
      return { success: true, notificationId };
    } catch (error) {
      console.error(`[Email Worker] Failed to send email:`, error);

      // Mark as failed
      await markAsFailed(
        notificationId,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error; // Re-throw to trigger retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 10, // Process 10 emails at a time
    limiter: {
      max: 20, // Max 20 jobs
      duration: 1000, // Per second
    },
  }
);

// Error handlers
smsWorker.on('failed', (job, err) => {
  console.error(`[SMS Worker] Job ${job?.id} failed:`, err.message);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Email Worker] Job ${job?.id} failed:`, err.message);
});

// Success handlers
smsWorker.on('completed', (job) => {
  console.log(`[SMS Worker] Job ${job.id} completed successfully`);
});

emailWorker.on('completed', (job) => {
  console.log(`[Email Worker] Job ${job.id} completed successfully`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Workers] Shutting down gracefully...');
  await smsWorker.close();
  await emailWorker.close();
  process.exit(0);
});

console.log('[Workers] SMS and Email workers started');
