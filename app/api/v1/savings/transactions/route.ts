import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/init';
import { savingsAccounts, transactions } from '@/server/db/schema';
import { eq, and, isNull, desc, sql, gte, lte } from 'drizzle-orm';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { toKoboAmount } from '@/types/branded';
import { formatNaira } from '@/utils/financial';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const transactionQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => parseInt(val, 10)),
  limit: z.string().optional().default('25').transform((val) => parseInt(val, 10)),
  accountType: z.enum(['NORMAL', 'SPECIAL']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing authorization header', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '25',
      accountType: searchParams.get('accountType') as 'NORMAL' | 'SPECIAL' | undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // Validate query parameters
    const validation = transactionQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        errorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid query parameters', requestId, {
          errors: validation.error.issues,
        }),
        { status: 400 }
      );
    }

    const { page = 1, limit = 25, accountType, startDate, endDate } = validation.data;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [eq(transactions.userId, userId), isNull(transactions.deletedAt)];

    if (accountType) {
      // Join with savings accounts to filter by account type
      const accountIds = await db
        .select({ id: savingsAccounts.id })
        .from(savingsAccounts)
        .where(
          and(
            eq(savingsAccounts.userId, userId),
            eq(savingsAccounts.accountType, accountType),
            isNull(savingsAccounts.deletedAt)
          )
        );

      if (accountIds.length > 0) {
        conditions.push(
          sql`${transactions.accountId} IN (${sql.join(
            accountIds.map((a) => sql`${a.id}`),
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
    const formattedTransactions = txns.map((txn) => ({
      ...txn,
      amountKobo: txn.amountKobo.toString(),
      balanceAfterKobo: txn.balanceAfterKobo.toString(),
      amountFormatted: formatNaira(toKoboAmount(txn.amountKobo)),
      balanceAfterFormatted: formatNaira(toKoboAmount(txn.balanceAfterKobo)),
    }));

    return NextResponse.json(
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
        requestId
      )
    );
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch transactions', requestId),
      { status: 500 }
    );
  }
}
