import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/init';
import { loans } from '@/server/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { randomUUID } from 'crypto';

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

    // Fetch user's loans
    const userLoans = await db
      .select({
        id: loans.id,
        loanReference: loans.loanReference,
        loanType: loans.loanType,
        principalKobo: loans.principalKobo,
        interestKobo: loans.interestKobo,
        totalRepayableKobo: loans.totalRepayableKobo,
        outstandingKobo: loans.outstandingKobo,
        repaymentMonths: loans.repaymentMonths,
        monthlyInstallmentKobo: loans.monthlyInstallmentKobo,
        status: loans.status,
        purpose: loans.purpose,
        submittedAt: loans.submittedAt,
        disbursedAt: loans.disbursedAt,
        createdAt: loans.createdAt,
      })
      .from(loans)
      .where(and(eq(loans.applicantId, userId), isNull(loans.deletedAt)))
      .orderBy(desc(loans.createdAt));

    // Format loans
    const formattedLoans = userLoans.map((loan) => ({
      ...loan,
      principalKobo: loan.principalKobo.toString(),
      interestKobo: loan.interestKobo.toString(),
      totalRepayableKobo: loan.totalRepayableKobo.toString(),
      outstandingKobo: loan.outstandingKobo.toString(),
      monthlyInstallmentKobo: loan.monthlyInstallmentKobo.toString(),
    }));

    return NextResponse.json(
      successResponse(
        {
          loans: formattedLoans,
        },
        requestId
      )
    );
  } catch (error) {
    console.error('Failed to fetch loans:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch loans', requestId),
      { status: 500 }
    );
  }
}
