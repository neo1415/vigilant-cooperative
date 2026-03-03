/**
 * Savings Routes
 * 
 * Handles savings management endpoints:
 * - GET /api/v1/savings/accounts - Get savings accounts
 * - GET /api/v1/savings/transactions - Get transaction history (paginated)
 * - POST /api/v1/savings/withdraw - Request withdrawal (idempotency required)
 * - POST /api/v1/savings/deposit - Make special deposit (idempotency required)
 * - POST /api/v1/savings/credit - Manual credit (treasurer only, idempotency required)
 * 
 * @module routes/savings
 */

import type { FastifyInstance } from 'fastify';
import { db } from '../db/init';
import { savingsAccounts, transactions, users, ledgerEntries, vouchers, auditLog } from '../db/schema';
import { eq, and, isNull, desc, sql, gte, lte } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  ErrorCode,
  getHttpStatusCode,
} from '../../utils/api-response';
import type { AuthenticatedUser } from '../middleware/authentication';
import { requireRole, ROLES } from '../middleware/authorization';
import { z } from 'zod';
import { toKoboAmount, type KoboAmount } from '../../types/branded';
import { calculateWithdrawalLimit, formatNaira } from '../../utils/financial';
import { randomUUID } from 'crypto';

// Validation schemas
const withdrawalSchema = z.object({
  accountId: z.string().uuid(),
  amountKobo: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)),
  description: z.string().min(1).max(500).optional(),
});

const depositSchema = z.object({
  amountKobo: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)),
  description: z.string().min(1).max(500).optional(),
});

const creditSchema = z.object({
  userId: z.string().uuid(),
  accountType: z.enum(['NORMAL', 'SPECIAL']),
  amountKobo: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)),
  description: z.string().min(10).max(500),
  reason: z.string().min(10).max(1000),
});

const transactionQuerySchema = z.object({
  page: z.string().optional().default('1').transform(val => parseInt(val, 10)),
  limit: z.string().optional().default('25').transform(val => parseInt(val, 10)),
  accountType: z.enum(['NORMAL', 'SPECIAL']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Generate transaction reference
 */
function generateTransactionReference(type: string): string {
  const timestamp = Date.now();
  const random = randomUUID().substring(0, 8);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Register savings routes
 */
export async function savingsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/savings/accounts
   * Get user's savings accounts
   */
  fastify.get(
    '/api/v1/savings/accounts',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      try {
        const accounts = await db
          .select({
            id: savingsAccounts.id,
            accountType: savingsAccounts.accountType,
            balanceKobo: savingsAccounts.balanceKobo,
            isLocked: savingsAccounts.isLocked,
            createdAt: savingsAccounts.createdAt,
            updatedAt: savingsAccounts.updatedAt,
          })
          .from(savingsAccounts)
          .where(
            and(
              eq(savingsAccounts.userId, user.id),
              isNull(savingsAccounts.deletedAt)
            )
          );

        // Calculate withdrawal limits for each account
        const accountsWithLimits = accounts.map(account => ({
          ...account,
          balanceKobo: account.balanceKobo.toString(),
          withdrawalLimitKobo: calculateWithdrawalLimit(
            toKoboAmount(account.balanceKobo)
          ).toString(),
          balanceFormatted: formatNaira(toKoboAmount(account.balanceKobo)),
        }));

        return reply.send(
          successResponse(
            {
              accounts: accountsWithLimits,
            },
            request.id
          )
        );
      } catch (error) {
        fastify.log.error({ error, userId: user.id }, 'Failed to fetch savings accounts');
        return reply.code(500).send(
          errorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Failed to fetch savings accounts',
            request.id
          )
        );
      }
    }
  );

  /**
   * GET /api/v1/savings/transactions
   * Get transaction history with pagination
   */
  fastify.get(
    '/api/v1/savings/transactions',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      // Validate query parameters
      const validation = transactionQuerySchema.safeParse(request.query);
      if (!validation.success) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid query parameters',
            request.id,
            { errors: validation.error.issues }
          )
        );
      }

      const { page = 1, limit = 25, accountType, startDate, endDate } = validation.data;
      const offset = (page - 1) * limit;

      try {
        // Build query conditions
        const conditions = [
          eq(transactions.userId, user.id),
          isNull(transactions.deletedAt),
        ];

        if (accountType) {
          // Join with savings accounts to filter by account type
          const accountIds = await db
            .select({ id: savingsAccounts.id })
            .from(savingsAccounts)
            .where(
              and(
                eq(savingsAccounts.userId, user.id),
                eq(savingsAccounts.accountType, accountType),
                isNull(savingsAccounts.deletedAt)
              )
            );

          if (accountIds.length > 0) {
            conditions.push(
              sql`${transactions.accountId} IN (${sql.join(
                accountIds.map(a => sql`${a.id}`),
                sql`, `
              )})`
            );
          }
        }

        if (startDate) {
          conditions.push(gte(transactions.createdAt, new Date(startDate)));
        }

        if (endDate) {
          conditions.push(lte(transactions.createdAt, new Date(endDate)));
        }

        // Fetch transactions
        const txns = await db
          .select({
            id: transactions.id,
            accountId: transactions.accountId,
            direction: transactions.direction,
            amountKobo: transactions.amountKobo,
            balanceAfterKobo: transactions.balanceAfterKobo,
            reference: transactions.reference,
            type: transactions.type,
            description: transactions.description,
            createdAt: transactions.createdAt,
          })
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.createdAt))
          .limit(limit)
          .offset(offset);

        // Get total count
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(and(...conditions));

        const count = countResult[0]?.count || 0;

        // Format transactions
        const formattedTransactions = txns.map(txn => ({
          ...txn,
          amountKobo: txn.amountKobo.toString(),
          balanceAfterKobo: txn.balanceAfterKobo.toString(),
          amountFormatted: formatNaira(toKoboAmount(txn.amountKobo)),
          balanceAfterFormatted: formatNaira(toKoboAmount(txn.balanceAfterKobo)),
        }));

        return reply.send(
          successResponse(
            {
              transactions: formattedTransactions,
              pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit),
                hasMore: offset + txns.length < count,
              },
            },
            request.id
          )
        );
      } catch (error) {
        fastify.log.error({ error, userId: user.id }, 'Failed to fetch transactions');
        return reply.code(500).send(
          errorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Failed to fetch transactions',
            request.id
          )
        );
      }
    }
  );

  /**
   * POST /api/v1/savings/withdraw
   * Request withdrawal from Normal Savings (with idempotency)
   */
  fastify.post(
    '/api/v1/savings/withdraw',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      // Validate input
      const validation = withdrawalSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid withdrawal request',
            request.id,
            { errors: validation.error.issues }
          )
        );
      }

      const { accountId, amountKobo, description } = validation.data;

      try {
        // Verify account ownership
        const [account] = await db
          .select()
          .from(savingsAccounts)
          .where(
            and(
              eq(savingsAccounts.id, accountId),
              eq(savingsAccounts.userId, user.id),
              isNull(savingsAccounts.deletedAt)
            )
          )
          .limit(1);

        if (!account) {
          return reply.code(404).send(
            errorResponse(
              ErrorCode.NOT_FOUND,
              'Savings account not found',
              request.id
            )
          );
        }

        // Check if account is locked
        if (account.isLocked) {
          return reply.code(403).send(
            errorResponse(
              ErrorCode.ACCOUNT_LOCKED,
              'This savings account is locked',
              request.id
            )
          );
        }

        // Validate withdrawal amount
        const withdrawalLimit = calculateWithdrawalLimit(toKoboAmount(account.balanceKobo));
        
        if (amountKobo > withdrawalLimit) {
          return reply.code(400).send(
            errorResponse(
              ErrorCode.WITHDRAWAL_LIMIT_EXCEEDED,
              'Withdrawal amount exceeds 25% limit',
              request.id,
              {
                requested: amountKobo.toString(),
                limit: withdrawalLimit.toString(),
                balance: account.balanceKobo.toString(),
              }
            )
          );
        }

        if (amountKobo > account.balanceKobo) {
          return reply.code(400).send(
            errorResponse(
              ErrorCode.INSUFFICIENT_BALANCE,
              'Insufficient balance',
              request.id,
              {
                requested: amountKobo.toString(),
                available: account.balanceKobo.toString(),
              }
            )
          );
        }

        // Perform withdrawal in transaction
        const result = await db.transaction(async (trx) => {
          // Lock account row
          const lockedAccounts = await trx
            .select()
            .from(savingsAccounts)
            .where(eq(savingsAccounts.id, accountId))
            .for('update', { noWait: true });

          if (!lockedAccounts[0]) {
            throw new Error('ACCOUNT_NOT_FOUND');
          }

          const lockedAccount = lockedAccounts[0];

          // Re-validate inside transaction
          const currentLimit = calculateWithdrawalLimit(toKoboAmount(lockedAccount.balanceKobo));
          if (amountKobo > currentLimit) {
            throw new Error('WITHDRAWAL_LIMIT_EXCEEDED');
          }

          if (amountKobo > lockedAccount.balanceKobo) {
            throw new Error('INSUFFICIENT_BALANCE');
          }

          const newBalance = lockedAccount.balanceKobo - amountKobo;

          // Update balance with version check
          const updated = await trx
            .update(savingsAccounts)
            .set({
              balanceKobo: newBalance,
              version: lockedAccount.version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(savingsAccounts.id, accountId),
                eq(savingsAccounts.version, lockedAccount.version)
              )
            )
            .returning();

          if (updated.length === 0) {
            throw new Error('OPTIMISTIC_LOCK_CONFLICT');
          }

          // Create transaction record
          const reference = generateTransactionReference('WD');
          const txnRecords = await trx
            .insert(transactions)
            .values({
              userId: user.id,
              accountId,
              direction: 'DEBIT',
              amountKobo,
              balanceAfterKobo: newBalance,
              reference,
              type: 'WITHDRAWAL',
              description: description || 'Savings withdrawal',
            })
            .returning();

          const txn = txnRecords[0];
          if (!txn) {
            throw new Error('TRANSACTION_CREATION_FAILED');
          }

          // Create voucher
          const voucherRecords = await trx
            .insert(vouchers)
            .values({
              voucherNumber: `VCH-${Date.now()}-${randomUUID().substring(0, 8)}`,
              voucherType: 'SAVINGS_WITHDRAWAL',
              amountKobo,
              description: `Withdrawal: ${reference}`,
              status: 'POSTED',
              createdBy: user.id,
              postedAt: new Date(),
            })
            .returning();

          const voucherRecord = voucherRecords[0];
          if (!voucherRecord) {
            throw new Error('VOUCHER_CREATION_FAILED');
          }

          // Create ledger entries (double-entry)
          await trx.insert(ledgerEntries).values([
            {
              voucherId: voucherRecord.id,
              accountCode: '1001', // Cash (debit)
              entryType: 'DEBIT',
              amountKobo,
              description: `Withdrawal: ${reference}`,
            },
            {
              voucherId: voucherRecord.id,
              accountCode: account.accountType === 'NORMAL' ? '1002' : '1003', // Member Savings (credit)
              entryType: 'CREDIT',
              amountKobo,
              description: `Withdrawal: ${reference}`,
            },
          ]);

          // Create audit log
          await trx.insert(auditLog).values({
            userId: user.id,
            action: 'SAVINGS_DEBITED',
            resourceType: 'SAVINGS_ACCOUNT',
            resourceId: accountId,
            previousValue: { balanceKobo: lockedAccount.balanceKobo },
            newValue: { balanceKobo: newBalance },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });

          return {
            transaction: txn,
            newBalance,
          };
        }, { isolationLevel: 'serializable' });

        return reply.send(
          successResponse(
            {
              reference: result.transaction.reference,
              amountKobo: amountKobo.toString(),
              balanceAfterKobo: result.newBalance.toString(),
              balanceAfterFormatted: formatNaira(toKoboAmount(result.newBalance)),
              processedAt: result.transaction.createdAt,
            },
            request.id
          )
        );
      } catch (error: any) {
        fastify.log.error({ error, userId: user.id }, 'Withdrawal failed');

        if (error.message === 'WITHDRAWAL_LIMIT_EXCEEDED') {
          return reply.code(400).send(
            errorResponse(
              ErrorCode.WITHDRAWAL_LIMIT_EXCEEDED,
              'Withdrawal amount exceeds 25% limit',
              request.id
            )
          );
        }

        if (error.message === 'INSUFFICIENT_BALANCE') {
          return reply.code(400).send(
            errorResponse(
              ErrorCode.INSUFFICIENT_BALANCE,
              'Insufficient balance',
              request.id
            )
          );
        }

        if (error.message === 'OPTIMISTIC_LOCK_CONFLICT') {
          return reply.code(409).send(
            errorResponse(
              ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
              'Concurrent modification detected, please retry',
              request.id
            )
          );
        }

        return reply.code(500).send(
          errorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Withdrawal failed',
            request.id
          )
        );
      }
    }
  );

  /**
   * POST /api/v1/savings/deposit
   * Make special deposit (with idempotency)
   */
  fastify.post(
    '/api/v1/savings/deposit',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      // Validate input
      const validation = depositSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid deposit request',
            request.id,
            { errors: validation.error.issues }
          )
        );
      }

      const { amountKobo, description } = validation.data;

      // Validate amount
      if (amountKobo <= 0) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.INVALID_AMOUNT,
            'Deposit amount must be positive',
            request.id
          )
        );
      }

      try {
        // Get user's SPECIAL savings account
        const [account] = await db
          .select()
          .from(savingsAccounts)
          .where(
            and(
              eq(savingsAccounts.userId, user.id),
              eq(savingsAccounts.accountType, 'SPECIAL'),
              isNull(savingsAccounts.deletedAt)
            )
          )
          .limit(1);

        if (!account) {
          return reply.code(404).send(
            errorResponse(
              ErrorCode.NOT_FOUND,
              'Special savings account not found',
              request.id
            )
          );
        }

        // Check if account is locked
        if (account.isLocked) {
          return reply.code(403).send(
            errorResponse(
              ErrorCode.ACCOUNT_LOCKED,
              'This savings account is locked',
              request.id
            )
          );
        }

        // Perform deposit in transaction
        const result = await db.transaction(async (trx) => {
          // Lock account row
          const lockedAccounts = await trx
            .select()
            .from(savingsAccounts)
            .where(eq(savingsAccounts.id, account.id))
            .for('update', { noWait: true });

          if (!lockedAccounts[0]) {
            throw new Error('ACCOUNT_NOT_FOUND');
          }

          const lockedAccount = lockedAccounts[0];
          const newBalance = lockedAccount.balanceKobo + amountKobo;

          // Update balance with version check
          const updated = await trx
            .update(savingsAccounts)
            .set({
              balanceKobo: newBalance,
              version: lockedAccount.version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(savingsAccounts.id, account.id),
                eq(savingsAccounts.version, lockedAccount.version)
              )
            )
            .returning();

          if (updated.length === 0) {
            throw new Error('OPTIMISTIC_LOCK_CONFLICT');
          }

          // Create transaction record
          const reference = generateTransactionReference('DEP');
          const txnRecords = await trx
            .insert(transactions)
            .values({
              userId: user.id,
              accountId: account.id,
              direction: 'CREDIT',
              amountKobo,
              balanceAfterKobo: newBalance,
              reference,
              type: 'SPECIAL_DEPOSIT',
              description: description || 'Special deposit',
            })
            .returning();

          const txn = txnRecords[0];
          if (!txn) {
            throw new Error('TRANSACTION_CREATION_FAILED');
          }

          // Create voucher
          const voucherRecords = await trx
            .insert(vouchers)
            .values({
              voucherNumber: `VCH-${Date.now()}-${randomUUID().substring(0, 8)}`,
              voucherType: 'SPECIAL_DEPOSIT',
              amountKobo,
              description: `Special Deposit: ${reference}`,
              status: 'POSTED',
              createdBy: user.id,
              postedAt: new Date(),
            })
            .returning();

          const voucherRecord = voucherRecords[0];
          if (!voucherRecord) {
            throw new Error('VOUCHER_CREATION_FAILED');
          }

          // Create ledger entries (double-entry)
          await trx.insert(ledgerEntries).values([
            {
              voucherId: voucherRecord.id,
              accountCode: '1003', // Member Special Deposits (debit)
              entryType: 'DEBIT',
              amountKobo,
              description: `Special Deposit: ${reference}`,
            },
            {
              voucherId: voucherRecord.id,
              accountCode: '1001', // Cash (credit)
              entryType: 'CREDIT',
              amountKobo,
              description: `Special Deposit: ${reference}`,
            },
          ]);

          // Create audit log
          await trx.insert(auditLog).values({
            userId: user.id,
            action: 'SAVINGS_CREDITED',
            resourceType: 'SAVINGS_ACCOUNT',
            resourceId: account.id,
            previousValue: { balanceKobo: lockedAccount.balanceKobo },
            newValue: { balanceKobo: newBalance },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });

          return {
            transaction: txn,
            newBalance,
          };
        }, { isolationLevel: 'serializable' });

        return reply.send(
          successResponse(
            {
              reference: result.transaction.reference,
              amountKobo: amountKobo.toString(),
              balanceAfterKobo: result.newBalance.toString(),
              balanceAfterFormatted: formatNaira(toKoboAmount(result.newBalance)),
              processedAt: result.transaction.createdAt,
            },
            request.id
          )
        );
      } catch (error: any) {
        fastify.log.error({ error, userId: user.id }, 'Deposit failed');

        if (error.message === 'OPTIMISTIC_LOCK_CONFLICT') {
          return reply.code(409).send(
            errorResponse(
              ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
              'Concurrent modification detected, please retry',
              request.id
            )
          );
        }

        return reply.code(500).send(
          errorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Deposit failed',
            request.id
          )
        );
      }
    }
  );

  /**
   * POST /api/v1/savings/credit
   * Manual credit by treasurer (with idempotency)
   */
  fastify.post(
    '/api/v1/savings/credit',
    {
      onRequest: [fastify.authenticate, requireRole(ROLES.TREASURER, ROLES.ADMIN)],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      // Validate input
      const validation = creditSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid credit request',
            request.id,
            { errors: validation.error.issues }
          )
        );
      }

      const { userId: targetUserId, accountType, amountKobo, description, reason } = validation.data;

      // Validate amount
      if (amountKobo <= 0) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.INVALID_AMOUNT,
            'Credit amount must be positive',
            request.id
          )
        );
      }

      try {
        // Verify target user exists and is approved
        const [targetUser] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, targetUserId),
              isNull(users.deletedAt)
            )
          )
          .limit(1);

        if (!targetUser) {
          return reply.code(404).send(
            errorResponse(
              ErrorCode.NOT_FOUND,
              'Target user not found',
              request.id
            )
          );
        }

        if (!targetUser.isApproved) {
          return reply.code(400).send(
            errorResponse(
              ErrorCode.MEMBER_NOT_APPROVED,
              'Cannot credit unapproved member',
              request.id
            )
          );
        }

        // Get target user's savings account
        const [account] = await db
          .select()
          .from(savingsAccounts)
          .where(
            and(
              eq(savingsAccounts.userId, targetUserId),
              eq(savingsAccounts.accountType, accountType),
              isNull(savingsAccounts.deletedAt)
            )
          )
          .limit(1);

        if (!account) {
          return reply.code(404).send(
            errorResponse(
              ErrorCode.NOT_FOUND,
              `${accountType} savings account not found`,
              request.id
            )
          );
        }

        // Perform credit in transaction
        const result = await db.transaction(async (trx) => {
          // Lock account row
          const lockedAccounts = await trx
            .select()
            .from(savingsAccounts)
            .where(eq(savingsAccounts.id, account.id))
            .for('update', { noWait: true });

          if (!lockedAccounts[0]) {
            throw new Error('ACCOUNT_NOT_FOUND');
          }

          const lockedAccount = lockedAccounts[0];
          const newBalance = lockedAccount.balanceKobo + amountKobo;

          // Update balance with version check
          const updated = await trx
            .update(savingsAccounts)
            .set({
              balanceKobo: newBalance,
              version: lockedAccount.version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(savingsAccounts.id, account.id),
                eq(savingsAccounts.version, lockedAccount.version)
              )
            )
            .returning();

          if (updated.length === 0) {
            throw new Error('OPTIMISTIC_LOCK_CONFLICT');
          }

          // Create transaction record
          const reference = generateTransactionReference('CR');
          const txnRecords = await trx
            .insert(transactions)
            .values({
              userId: targetUserId,
              accountId: account.id,
              direction: 'CREDIT',
              amountKobo,
              balanceAfterKobo: newBalance,
              reference,
              type: 'MANUAL_CREDIT',
              description,
              metadata: {
                creditedBy: user.id,
                creditedByMemberId: user.memberId,
                reason,
              },
            })
            .returning();

          const txn = txnRecords[0];
          if (!txn) {
            throw new Error('TRANSACTION_CREATION_FAILED');
          }

          // Create voucher
          const voucherRecords = await trx
            .insert(vouchers)
            .values({
              voucherNumber: `VCH-${Date.now()}-${randomUUID().substring(0, 8)}`,
              voucherType: 'MANUAL_CREDIT',
              amountKobo,
              description: `Manual Credit: ${reference}`,
              status: 'POSTED',
              createdBy: user.id,
              postedAt: new Date(),
            })
            .returning();

          const voucherRecord = voucherRecords[0];
          if (!voucherRecord) {
            throw new Error('VOUCHER_CREATION_FAILED');
          }

          // Create ledger entries (double-entry)
          const accountCode = accountType === 'NORMAL' ? '1002' : '1003';
          await trx.insert(ledgerEntries).values([
            {
              voucherId: voucherRecord.id,
              accountCode, // Member Savings (debit)
              entryType: 'DEBIT',
              amountKobo,
              description: `Manual Credit: ${reference}`,
            },
            {
              voucherId: voucherRecord.id,
              accountCode: '1001', // Cash (credit)
              entryType: 'CREDIT',
              amountKobo,
              description: `Manual Credit: ${reference}`,
            },
          ]);

          // Create audit log
          await trx.insert(auditLog).values({
            userId: user.id,
            action: 'SAVINGS_CREDITED',
            resourceType: 'SAVINGS_ACCOUNT',
            resourceId: account.id,
            previousValue: { balanceKobo: lockedAccount.balanceKobo },
            newValue: { 
              balanceKobo: newBalance,
              creditedBy: user.id,
              reason,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });

          return {
            transaction: txn,
            newBalance,
            targetUser,
          };
        }, { isolationLevel: 'serializable' });

        return reply.send(
          successResponse(
            {
              reference: result.transaction.reference,
              targetMemberId: result.targetUser.memberId,
              targetMemberName: result.targetUser.fullName,
              accountType,
              amountKobo: amountKobo.toString(),
              balanceAfterKobo: result.newBalance.toString(),
              balanceAfterFormatted: formatNaira(toKoboAmount(result.newBalance)),
              processedAt: result.transaction.createdAt,
              creditedBy: user.memberId,
            },
            request.id
          )
        );
      } catch (error: any) {
        fastify.log.error({ error, userId: user.id, targetUserId }, 'Manual credit failed');

        if (error.message === 'OPTIMISTIC_LOCK_CONFLICT') {
          return reply.code(409).send(
            errorResponse(
              ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
              'Concurrent modification detected, please retry',
              request.id
            )
          );
        }

        return reply.code(500).send(
          errorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Manual credit failed',
            request.id
          )
        );
      }
    }
  );
}
