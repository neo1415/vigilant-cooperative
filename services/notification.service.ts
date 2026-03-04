import { db } from '../server/db/init';
import { notifications } from '../server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { err, ok, type Result } from '../types/result';

export interface SendSMSInput {
  userId: string;
  phone: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailInput {
  userId: string;
  email: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInAppNotificationInput {
  userId: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export type NotificationServiceError =
  | { code: 'USER_NOT_FOUND'; message: string }
  | { code: 'INVALID_PHONE'; message: string }
  | { code: 'INVALID_EMAIL'; message: string }
  | { code: 'SMS_DELIVERY_FAILED'; message: string; details?: unknown }
  | { code: 'EMAIL_DELIVERY_FAILED'; message: string; details?: unknown }
  | { code: 'DATABASE_ERROR'; message: string };

/**
 * Send SMS via Termii
 * TODO: Integrate with actual Termii API
 */
export async function sendSMS(
  input: SendSMSInput
): Promise<Result<typeof notifications.$inferSelect, NotificationServiceError>> {
  try {
    // Validate phone number format
    if (!input.phone.match(/^\+?[1-9]\d{1,14}$/)) {
      return err({
        code: 'INVALID_PHONE',
        message: 'Invalid phone number format',
      });
    }

    // Create notification record
    const [notification] = (await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: 'SMS',
        channel: 'TERMII',
        subject: 'SMS Notification',
        body: input.message,
        status: 'PENDING',
        metadata: input.metadata || {},
      })
      .returning()) as any[];

    // TODO: Integrate with Termii API
    // For now, simulate successful delivery
    console.log(`[SMS] To: ${input.phone}, Message: ${input.message}`);

    // Update status to SENT
    const [updated] = (await db
      .update(notifications)
      .set({
        status: 'SENT',
        sentAt: new Date(),
      })
      .where(eq(notifications.id, notification!.id))
      .returning()) as any[];

    return ok(updated!);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Send Email via Resend
 * TODO: Integrate with actual Resend API
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<Result<typeof notifications.$inferSelect, NotificationServiceError>> {
  try {
    // Validate email format
    if (!input.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return err({
        code: 'INVALID_EMAIL',
        message: 'Invalid email format',
      });
    }

    // Create notification record
    const [notification] = (await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: 'EMAIL',
        channel: 'RESEND',
        subject: input.subject,
        body: input.body,
        status: 'PENDING',
        metadata: input.metadata || {},
      })
      .returning()) as any[];

    // TODO: Integrate with Resend API
    // For now, simulate successful delivery
    console.log(`[EMAIL] To: ${input.email}, Subject: ${input.subject}`);

    // Update status to SENT
    const [updated] = (await db
      .update(notifications)
      .set({
        status: 'SENT',
        sentAt: new Date(),
      })
      .where(eq(notifications.id, notification!.id))
      .returning()) as any[];

    return ok(updated!);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Create in-app notification
 */
export async function createInAppNotification(
  input: CreateInAppNotificationInput
): Promise<Result<typeof notifications.$inferSelect, NotificationServiceError>> {
  try {
    const [notification] = (await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: 'IN_APP',
        channel: 'SYSTEM',
        subject: input.subject,
        body: input.body,
        status: 'SENT',
        sentAt: new Date(),
        metadata: input.metadata || {},
      })
      .returning()) as any[];

    return ok(notification!);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Result<(typeof notifications.$inferSelect)[], NotificationServiceError>> {
  try {
    const results = (await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)) as any[];

    return ok(results);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Mark notification as delivered
 */
export async function markAsDelivered(
  notificationId: string
): Promise<Result<typeof notifications.$inferSelect, NotificationServiceError>> {
  try {
    const [updated] = (await db
      .update(notifications)
      .set({
        status: 'DELIVERED',
        deliveredAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning()) as any[];

    return ok(updated!);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Mark notification as failed
 */
export async function markAsFailed(
  notificationId: string,
  errorMessage: string
): Promise<Result<typeof notifications.$inferSelect, NotificationServiceError>> {
  try {
    const [updated] = (await db
      .update(notifications)
      .set({
        status: 'FAILED',
        failedAt: new Date(),
        errorMessage,
      })
      .where(eq(notifications.id, notificationId))
      .returning()) as any[];

    return ok(updated!);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

// ============================================================================
// Notification Templates
// ============================================================================

export const NotificationTemplates = {
  // Member Registration
  memberRegistered: (memberId: string) => ({
    subject: 'Registration Received',
    body: `Your registration has been received. Your Member ID is ${memberId}. Please wait for approval from the cooperative administrators.`,
  }),

  memberApproved: (memberId: string) => ({
    subject: 'Account Approved',
    body: `Congratulations! Your account (${memberId}) has been approved. You can now access all cooperative services.`,
  }),

  // Loan Notifications
  loanSubmitted: (loanReference: string) => ({
    subject: 'Loan Application Submitted',
    body: `Your loan application (${loanReference}) has been submitted successfully and is awaiting guarantor consent.`,
  }),

  guarantorRequest: (applicantName: string, loanReference: string, amount: string) => ({
    subject: 'Guarantor Request',
    body: `${applicantName} has requested you to be a guarantor for their loan (${loanReference}) of ${amount}. Please review and respond.`,
  }),

  loanApproved: (loanReference: string) => ({
    subject: 'Loan Approved',
    body: `Your loan application (${loanReference}) has been approved and is ready for disbursement.`,
  }),

  loanDisbursed: (loanReference: string, amount: string) => ({
    subject: 'Loan Disbursed',
    body: `Your loan (${loanReference}) of ${amount} has been disbursed to your account.`,
  }),

  loanRejected: (loanReference: string, reason: string) => ({
    subject: 'Loan Application Rejected',
    body: `Your loan application (${loanReference}) has been rejected. Reason: ${reason}`,
  }),

  // Savings Notifications
  savingsWithdrawal: (amount: string, balance: string) => ({
    subject: 'Withdrawal Processed',
    body: `Your withdrawal of ${amount} has been processed. Your new balance is ${balance}.`,
  }),

  savingsDeposit: (amount: string, balance: string) => ({
    subject: 'Deposit Received',
    body: `Your deposit of ${amount} has been received. Your new balance is ${balance}.`,
  }),

  // Payroll Notifications
  payrollProcessed: (period: string, totalDeduction: string) => ({
    subject: 'Payroll Deduction Processed',
    body: `Your payroll deductions for ${period} totaling ${totalDeduction} have been processed.`,
  }),
};
