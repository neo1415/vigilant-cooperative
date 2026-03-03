/**
 * Loan API Routes
 * 
 * Endpoints for loan eligibility checking and application submission.
 * All financial mutations require idempotency keys.
 * 
 * @module server/routes/loans
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { LoanService, LoanErrorCode, LoanListItem } from '../../services/loan.service';
import { toKoboAmount } from '../../types/branded';
import { formatNaira } from '../../utils/financial';

// ============================================================================
// Request Schemas
// ============================================================================

const loanApplicationSchema = z.object({
  loanType: z.enum(['SHORT_TERM', 'LONG_TERM']),
  principalKobo: z.number().int().positive(),
  repaymentMonths: z.number().int().positive().max(12),
  purpose: z.string().min(3).max(100),
  purposeDetail: z.string().max(500).optional(),
  guarantorIds: z.array(z.string().uuid()).min(2).max(5),
});

type LoanApplicationBody = z.infer<typeof loanApplicationSchema>;

// ============================================================================
// Error Messages
// ============================================================================

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
  [LoanErrorCode.CONFIG_NOT_FOUND]: 'System configuration error. Please contact support.',
  [LoanErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
  [LoanErrorCode.INVALID_INPUT]: 'Invalid input data.',
};

// ============================================================================
// Routes
// ============================================================================

export async function loanRoutes(fastify: FastifyInstance) {
  const loanService = new LoanService();
  
  /**
   * GET /api/v1/loans/eligibility
   * 
   * Check loan eligibility for the authenticated member.
   * Returns available loan amounts for short-term and long-term loans.
   * 
   * Auth: MEMBER (own eligibility)
   * Rate Limit: 10 requests/minute
   */
  fastify.get(
    '/eligibility',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Check loan eligibility',
        tags: ['loans'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  eligible: { type: 'boolean' },
                  eligibilityKobo: { type: 'number' },
                  eligibilityFormatted: { type: 'string' },
                  blockers: { type: 'array', items: { type: 'string' } },
                  activeLongTermCount: { type: 'number' },
                  activeShortTermCount: { type: 'number' },
                  canApplyLongTerm: { type: 'boolean' },
                  canApplyShortTerm: { type: 'boolean' },
                  normalSavingsKobo: { type: 'number' },
                  normalSavingsFormatted: { type: 'string' },
                  outstandingLoansKobo: { type: 'number' },
                  outstandingLoansFormatted: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.id;
      
      const result = await loanService.calculateEligibility(userId);
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      const eligibility = result.value;
      
      return reply.send({
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
    }
  );
  
  /**
   * POST /api/v1/loans
   * 
   * Submit a loan application.
   * Validates all 9 loan conditions before creating the loan.
   * 
   * Auth: MEMBER
   * Idempotency: Required
   * Rate Limit: 5 requests/minute
   */
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, fastify.requireIdempotency],
      schema: {
        description: 'Submit loan application',
        tags: ['loans'],
        body: {
          type: 'object',
          required: ['loanType', 'principalKobo', 'repaymentMonths', 'purpose', 'guarantorIds'],
          properties: {
            loanType: { type: 'string', enum: ['SHORT_TERM', 'LONG_TERM'] },
            principalKobo: { type: 'number' },
            repaymentMonths: { type: 'number' },
            purpose: { type: 'string' },
            purposeDetail: { type: 'string' },
            guarantorIds: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  loanId: { type: 'string' },
                  loanReference: { type: 'string' },
                  principalKobo: { type: 'number' },
                  principalFormatted: { type: 'string' },
                  interestKobo: { type: 'number' },
                  interestFormatted: { type: 'string' },
                  totalRepayableKobo: { type: 'number' },
                  totalRepayableFormatted: { type: 'string' },
                  monthlyInstallmentKobo: { type: 'number' },
                  monthlyInstallmentFormatted: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoanApplicationBody }>, reply: FastifyReply) => {
      // Validate request body
      const validation = loanApplicationSchema.safeParse(request.body);
      
      if (!validation.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input data',
            details: validation.error.errors,
          },
        });
      }
      
      const userId = request.user.id;
      const { loanType, principalKobo, repaymentMonths, purpose, purposeDetail, guarantorIds } = validation.data;
      
      // Submit application
      const result = await loanService.submitApplication({
        applicantId: userId,
        loanType,
        principalKobo: toKoboAmount(principalKobo),
        repaymentMonths,
        purpose,
        purposeDetail: purposeDetail ?? undefined,
        guarantorIds,
      });
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      const loan = result.value;
      
      return reply.code(201).send({
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
      });
    }
  );
  
  /**
   * GET /api/v1/loans
   * 
   * List loans for the authenticated member.
   * Officers can see all loans.
   * 
   * Auth: MEMBER (own loans), TREASURER/SECRETARY/ADMIN (all loans)
   * Rate Limit: 20 requests/minute
   */
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'List loans',
        tags: ['loans'],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            loanType: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            search: { type: 'string' },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ 
      Querystring: { 
        status?: string; 
        loanType?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
        page?: number; 
        limit?: number;
      } 
    }>, reply: FastifyReply) => {
      const userId = request.user.id;
      const userRoles = request.user.roles || [];
      const isOfficer = userRoles.some((role: string) => 
        ['TREASURER', 'SECRETARY', 'PRESIDENT', 'COMMITTEE', 'ADMIN'].includes(role)
      );
      
      const { status, loanType, startDate, endDate, search, page = 1, limit = 20 } = request.query;
      
      const result = await loanService.listLoans({
        userId: isOfficer ? undefined : userId,
        status: status ?? undefined,
        loanType: loanType ?? undefined,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        search: search ?? undefined,
        page,
        limit,
      });
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      const { loans: loanList, pagination } = result.value;
      
      return reply.send({
        success: true,
        data: {
          loans: loanList.map((loan: LoanListItem) => ({
            id: loan.id,
            loanReference: loan.loanReference,
            applicantId: loan.applicantId,
            applicantName: loan.applicantName,
            applicantMemberId: loan.applicantMemberId,
            loanType: loan.loanType,
            principalKobo: loan.principalKobo,
            principalFormatted: formatNaira(loan.principalKobo),
            totalRepayableKobo: loan.totalRepayableKobo,
            totalRepayableFormatted: formatNaira(loan.totalRepayableKobo),
            outstandingKobo: loan.outstandingKobo,
            outstandingFormatted: formatNaira(loan.outstandingKobo),
            status: loan.status,
            submittedAt: loan.submittedAt,
            disbursedAt: loan.disbursedAt,
          })),
          pagination,
        },
      });
    }
  );
  
  /**
   * GET /api/v1/loans/:id
   * 
   * Get loan details.
   * Members can only see their own loans.
   * Officers can see all loans.
   * 
   * Auth: MEMBER (own loan), TREASURER/SECRETARY/ADMIN (any loan)
   * Rate Limit: 20 requests/minute
   */
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Get loan details',
        tags: ['loans'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user.id;
      const userRoles = request.user.roles || [];
      const isOfficer = userRoles.some((role: string) => 
        ['TREASURER', 'SECRETARY', 'PRESIDENT', 'COMMITTEE', 'ADMIN'].includes(role)
      );
      
      const result = await loanService.getLoanDetails(request.params.id, userId, isOfficer);
      
      if (!result.success) {
        return reply.code(404).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'Loan not found',
          },
        });
      }
      
      const loan = result.value;
      
      return reply.send({
        success: true,
        data: {
          id: loan.id,
          loanReference: loan.loanReference,
          loanType: loan.loanType,
          principalKobo: loan.principalKobo,
          principalFormatted: formatNaira(loan.principalKobo),
          interestRateBps: loan.interestRateBps,
          interestKobo: loan.interestKobo,
          interestFormatted: formatNaira(loan.interestKobo),
          totalRepayableKobo: loan.totalRepayableKobo,
          totalRepayableFormatted: formatNaira(loan.totalRepayableKobo),
          monthlyInstallmentKobo: loan.monthlyInstallmentKobo,
          monthlyInstallmentFormatted: formatNaira(loan.monthlyInstallmentKobo),
          outstandingKobo: loan.outstandingKobo,
          outstandingFormatted: formatNaira(loan.outstandingKobo),
          repaymentMonths: loan.repaymentMonths,
          purpose: loan.purpose,
          purposeDetail: loan.purposeDetail,
          status: loan.status,
          submittedAt: loan.submittedAt,
          disbursedAt: loan.disbursedAt,
          completedAt: loan.completedAt,
          rejectedAt: loan.rejectedAt,
          rejectionReason: loan.rejectionReason,
          applicant: isOfficer ? loan.applicant : undefined,
          guarantors: loan.guarantors.map(g => ({
            id: g.id,
            guarantorId: g.guarantorId,
            memberId: g.memberId,
            fullName: g.fullName,
            status: g.status,
            consentedAt: g.consentedAt,
            declinedAt: g.declinedAt,
            declineReason: g.declineReason,
          })),
          approvals: loan.approvals.map(a => ({
            id: a.id,
            approverId: a.approverId,
            approverName: a.approverName,
            approverRole: a.approverRole,
            action: a.action,
            previousAmountKobo: a.previousAmountKobo,
            previousAmountFormatted: a.previousAmountKobo ? formatNaira(a.previousAmountKobo) : undefined,
            newAmountKobo: a.newAmountKobo,
            newAmountFormatted: a.newAmountKobo ? formatNaira(a.newAmountKobo) : undefined,
            comments: a.comments,
            createdAt: a.createdAt,
          })),
          repayments: loan.repayments.map(r => ({
            id: r.id,
            amountKobo: r.amountKobo,
            amountFormatted: formatNaira(r.amountKobo),
            paymentDate: r.paymentDate,
            paymentReference: r.paymentReference,
            paymentMethod: r.paymentMethod,
            recordedBy: r.recordedBy,
            createdAt: r.createdAt,
          })),
          repaymentSchedule: loan.repaymentSchedule.map(s => ({
            month: s.month,
            dueDate: s.dueDate,
            installmentKobo: s.installmentKobo,
            installmentFormatted: formatNaira(s.installmentKobo),
            remainingBalanceKobo: s.remainingBalanceKobo,
            remainingBalanceFormatted: formatNaira(s.remainingBalanceKobo),
          })),
        },
      });
    }
  );
}

