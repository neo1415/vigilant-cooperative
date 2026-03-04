import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { LoanService, LoanErrorCode } from '@/services/loan.service';
import { formatNaira } from '@/utils/financial';
import { randomUUID } from 'crypto';

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

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing authorization', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    // Calculate eligibility
    const loanService = new LoanService();
    const result = await loanService.calculateEligibility(userId);
    
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
    
    const eligibility = result.value;
    
    return NextResponse.json({
      success: true,
      data: {
        eligible: eligibility.eligible,
        eligibilityKobo: eligibility.eligibilityKobo,
        eligibilityFormatted: formatNaira(eligibility.eligibilityKobo),
        blockers: eligibility.blockers,
        activeLongTermCount: eligibility.activeLongTermCount,
        activeShortTermCount: eligibility.activeShortTermCount,
        canApplyLongTerm: eligibility.canApplyLongTerm,
        canApplyShortTerm: eligibility.canApplyShortTerm,
        normalSavingsKobo: eligibility.normalSavingsKobo,
        normalSavingsFormatted: formatNaira(eligibility.normalSavingsKobo),
        outstandingLoansKobo: eligibility.outstandingLoansKobo,
        outstandingLoansFormatted: formatNaira(eligibility.outstandingLoansKobo),
      },
    });
  } catch (error) {
    console.error('Error checking loan eligibility:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to check eligibility', requestId),
      { status: 500 }
    );
  }
}
