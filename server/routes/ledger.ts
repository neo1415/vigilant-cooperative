import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createVoucher,
  postVoucher,
  getAccountBalance,
  getAllAccountBalances,
  reconcileAccounts,
  getVoucherWithEntries,
  getRecentVouchers,
  type LedgerEntryInput,
} from '../../services/ledger.service';
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
  generateMemberStatement,
} from '../../services/reporting.service';
import { successResponse, errorResponse, ErrorCode } from '../../utils/api-response';
import { isErr } from '../../types/result';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireIdempotency: (request: any, reply: any) => Promise<void>;
  }
}

// Validation schemas
const createVoucherSchema = z.object({
  voucherType: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  documentUrl: z.string().url().optional(),
  entries: z.array(
    z.object({
      accountCode: z.string().min(1).max(10),
      entryType: z.enum(['DEBIT', 'CREDIT']),
      amountKobo: z.number().int().positive(),
      description: z.string().min(1).max(500),
    })
  ).min(2),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export async function ledgerRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/ledger/accounts - Get all account balances
  fastify.get(
    '/accounts',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { asOfDate } = request.query as { asOfDate?: string };

      const date = asOfDate ? new Date(asOfDate) : new Date();
      const result = await getAllAccountBalances(date);

      if (isErr(result)) {
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/ledger/accounts/:code - Get specific account balance
  fastify.get(
    '/accounts/:code',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const { asOfDate } = request.query as { asOfDate?: string };

      const date = asOfDate ? new Date(asOfDate) : new Date();
      const result = await getAccountBalance(code, date);

      if (isErr(result)) {
        if (result.error.code === 'ACCOUNT_NOT_FOUND') {
          return reply.status(404).send(
            errorResponse(ErrorCode.ACCOUNT_NOT_FOUND, result.error.message, request.id)
          );
        }
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/ledger/vouchers - Get recent vouchers
  fastify.get(
    '/vouchers',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { limit = 20, offset = 0 } = request.query as { limit?: number; offset?: number };

      const result = await getRecentVouchers(Number(limit), Number(offset));

      if (isErr(result)) {
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/ledger/vouchers/:id - Get voucher with entries
  fastify.get(
    '/vouchers/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await getVoucherWithEntries(id);

      if (isErr(result)) {
        if (result.error.code === 'VOUCHER_NOT_FOUND') {
          return reply.status(404).send(
            errorResponse(ErrorCode.VOUCHER_NOT_FOUND, result.error.message, request.id)
          );
        }
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // POST /api/v1/ledger/vouchers - Create voucher with entries
  fastify.post(
    '/vouchers',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireIdempotency,
      ],
    },
    async (request, reply) => {
      const validation = createVoucherSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send(
          errorResponse(ErrorCode.VALIDATION_ERROR, validation.error.message, request.id)
        );
      }

      const { voucherType, description, documentUrl, entries } = validation.data;

      const result = await createVoucher(
        {
          voucherType,
          description,
          createdBy: request.user.id,
          ...(documentUrl && { documentUrl }),
        },
        entries as LedgerEntryInput[]
      );

      if (isErr(result)) {
        if (result.error.code === 'ENTRIES_NOT_BALANCED') {
          return reply.status(400).send(
            errorResponse(ErrorCode.ENTRIES_NOT_BALANCED, result.error.message, request.id, result.error.details)
          );
        }
        if (result.error.code === 'ACCOUNT_NOT_FOUND') {
          return reply.status(404).send(
            errorResponse(ErrorCode.ACCOUNT_NOT_FOUND, result.error.message, request.id)
          );
        }
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.status(201).send(successResponse(result.value, request.id));
    }
  );

  // POST /api/v1/ledger/vouchers/:id/post - Post a voucher
  fastify.post(
    '/vouchers/:id/post',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireIdempotency,
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await postVoucher(id, request.user.id);

      if (isErr(result)) {
        if (result.error.code === 'VOUCHER_NOT_FOUND') {
          return reply.status(404).send(
            errorResponse(ErrorCode.VOUCHER_NOT_FOUND, result.error.message, request.id)
          );
        }
        if (result.error.code === 'VOUCHER_ALREADY_POSTED') {
          return reply.status(400).send(
            errorResponse(ErrorCode.VOUCHER_ALREADY_POSTED, result.error.message, request.id)
          );
        }
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // POST /api/v1/ledger/reconcile - Reconcile accounts
  fastify.post(
    '/reconcile',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const result = await reconcileAccounts();

      if (isErr(result)) {
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/reports/balance-sheet - Generate balance sheet
  fastify.get(
    '/reports/balance-sheet',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { asOfDate } = request.query as { asOfDate?: string };

      const date = asOfDate ? new Date(asOfDate) : new Date();
      const result = await generateBalanceSheet(date);

      if (isErr(result)) {
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/reports/income-statement - Generate income statement
  fastify.get(
    '/reports/income-statement',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const validation = dateRangeSchema.safeParse(request.query);
      if (!validation.success) {
        return reply.status(400).send(
          errorResponse(ErrorCode.VALIDATION_ERROR, validation.error.message, request.id)
        );
      }

      const { startDate, endDate } = validation.data;
      const result = await generateIncomeStatement({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      if (isErr(result)) {
        if (result.error.code === 'INVALID_DATE_RANGE') {
          return reply.status(400).send(
            errorResponse(ErrorCode.INVALID_DATE_RANGE, result.error.message, request.id)
          );
        }
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/reports/trial-balance - Generate trial balance
  fastify.get(
    '/reports/trial-balance',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { asOfDate } = request.query as { asOfDate?: string };

      const date = asOfDate ? new Date(asOfDate) : new Date();
      const result = await generateTrialBalance(date);

      if (isErr(result)) {
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );

  // GET /api/v1/reports/member-statement - Generate member statement
  fastify.get(
    '/reports/member-statement',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const validation = dateRangeSchema.safeParse(request.query);
      if (!validation.success) {
        return reply.status(400).send(
          errorResponse(ErrorCode.VALIDATION_ERROR, validation.error.message, request.id)
        );
      }

      const { startDate, endDate } = validation.data;
      const result = await generateMemberStatement(request.user.id, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      if (isErr(result)) {
        if (result.error.code === 'MEMBER_NOT_FOUND') {
          return reply.status(404).send(
            errorResponse(ErrorCode.MEMBER_NOT_FOUND, result.error.message, request.id)
          );
        }
        if (result.error.code === 'INVALID_DATE_RANGE') {
          return reply.status(400).send(
            errorResponse(ErrorCode.INVALID_DATE_RANGE, result.error.message, request.id)
          );
        }
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, result.error.message, request.id)
        );
      }

      return reply.send(successResponse(result.value, request.id));
    }
  );
}
