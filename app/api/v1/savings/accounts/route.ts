import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/server/db/init';
import { savingsAccounts } from '@/server/db/schema';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { toKoboAmount } from '@/types/branded';
import { calculateWithdrawalLimit, formatNaira } from '@/utils/financial';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing or invalid authorization header', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    // Get savings accounts
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
      .where(and(eq(savingsAccounts.userId, userId), isNull(savingsAccounts.deletedAt)));

    // Calculate withdrawal limits for each account
    const accountsWithLimits = accounts.map((account) => ({
      ...account,
      balanceKobo: account.balanceKobo.toString(),
      withdrawalLimitKobo: calculateWithdrawalLimit(toKoboAmount(account.balanceKobo)).toString(),
      balanceFormatted: formatNaira(toKoboAmount(account.balanceKobo)),
    }));

    return NextResponse.json(
      successResponse({
        accounts: accountsWithLimits,
      }, requestId)
    );
  } catch (error) {
    console.error('Failed to fetch savings accounts:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch savings accounts', requestId),
      { status: 500 }
    );
  }
}
