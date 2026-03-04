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

import { z } from 'zod';
import { LoanService, LoanErrorCode } from '@/services/loan.service';
import { toKoboAmount } from '@/types/branded';
import { formatNaira } from '@/utils/financial';

const loanApplicationSchema = z.object({
  loanType: z.enum(['SHORT_TERM', 'LONG_TERM']),
  principalKobo: z.number().int().positive(),
  repaymentMonths: z.number().int().positive().max(12),
  purpose: z.string().min(3).max(100),
  purposeDetail: z.string().max(500).optional(),
  guarantorIds: z.array(z.string().uuid()).min(2).max(5),
});

const ERROR_MESSAGES: Record<LoanErrorCode, string> = {
  [LoanErrorCode.EMPLOYMENT_INACTIVE]: 'Your employment status is not active. Only active employees can apply for loans.',
  [LoanErrorCode.ACCOUNT_NOT_APPROVED]: 'Your account has not been approved yet. Please wait for approval before applying for a loan.',
  [LoanErrorCode.ACCOUNT_DEACTIVATED]: 'Your account has been deactivated.',
  [LoanErrorCode.NO_SAVINGS_ON_FILE]: 'You have no savings on file. Please make a deposit before applying for a loan.',
  [LoanErrorCode.INSUFFICIENT_ELIGIBILITY]: 'The requested loan amount exceeds your eligibility. Please reduce the amount.',
  [LoanErrorCode.INVALID_LOAN_TYPE]: 'Invalid loan type. Must be SHORT_TERM or LONG_TERM.',
  [LoanErrorCode.MAX_ACTIVE_LOANS_REACHED]: 'You have reached the maximum number of active loans for this type.',
  [LoanErrorCode.INVALID_REPAYMENT_PERIOD]: 'Invalid repayment period. Short-term loans must be 6 months or less, long-term loans must be 12 months or less.',
  [LoanErrorCode.INSUFFICIENT_GUARANTORS]: 'Insufficient guarantors. Short-term loans require 2 guarantors, long-term loans require 3 guarantors.',
  [LoanErrorCode.SELF_GUARANTEE_NOT_ALLOWED]: 'You cannot guarantee your own loan.',
  [LoanErrorCode.GUARANTOR_NOT_ELIGIBLE]: 'One or more guarantors are not eligible. Guarantors must be active, approved members with sufficient savings.',
  [LoanErrorCode.GUARANTOR_EXPOSURE_EXCEEDED]: 'One or more guarantors have exceeded their guarantee exposure limit.',
  [LoanErrorCode.LOAN_NOT_FOUND]: 'Loan not found.',
  [LoanErrorCode.INVALID_LOAN_STATUS]: 'Invalid loan status for this operation.',
  [LoanErrorCode.UNAUTHORIZED]: 'You are not authorized to perform this action.',
  [LoanErrorCode.INSUFFICIENT_COMMITTEE_APPROVALS]: 'Insufficient committee approvals for this loan.',
  [LoanErrorCode.REJECTION_REASON_REQUIRED]: 'A rejection reason is required.',
  [LoanErrorCode.GUARANTOR_ALREADY_RESPONDED]: 'You have already responded to this guarantor request.',
  [LoanErrorCode.NOT_APPLICANT]: 'You are not the applicant for this loan.',
  [LoanErrorCode.CONFIG_NOT_FOUND]: 'System configuration error. Please contact support.',
  [LoanErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
  [LoanErrorCode.INVALID_INPUT]: 'Invalid input data.',
};

export async function POST(request: NextRequest) {
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

    // Check for idempotency key
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json(
        errorResponse(ErrorCode.VALIDATION_ERROR, 'Idempotency-Key header is required', requestId),
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = loanApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input data',
            details: validation.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { loanType, principalKobo, repaymentMonths, purpose, purposeDetail, guarantorIds } = validation.data;

    // Submit application
    const loanService = new LoanService();
    const result = await loanService.submitApplication({
      applicantId: userId,
      loanType,
      principalKobo: toKoboAmount(principalKobo),
      repaymentMonths,
      purpose,
      ...(purposeDetail ? { purposeDetail } : {}),
      guarantorIds,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        },
        { status: 400 }
      );
    }

    const loan = result.value;

    return NextResponse.json(
      {
        success: true,
        data: {
          loanId: loan.loanId,
          loanReference: loan.loanReference,
          principalKobo: loan.principalKobo,
          principalFormatted: formatNaira(loan.principalKobo),
          interestKobo: loan.interestKobo,
          interestFormatted: formatNaira(loan.interestKobo),
          totalRepayableKobo: loan.totalRepayableKobo,
          totalRepayableFormatted: formatNaira(loan.totalRepayableKobo),
          monthlyInstallmentKobo: loan.monthlyInstallmentKobo,
          monthlyInstallmentFormatted: formatNaira(loan.monthlyInstallmentKobo),
          status: loan.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to submit loan application:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to submit loan application', requestId),
      { status: 500 }
    );
  }
}
