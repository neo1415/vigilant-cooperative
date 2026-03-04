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
import type { AuthenticatedUser } from '../middleware/authentication';

// Extend Fastify types to include authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireIdempotency: (request: any, reply: any) => Promise<void>;
  }
}

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
            details: validation.error.issues,
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
        ...(purposeDetail ? { purposeDetail } : {}),
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
        ...(isOfficer ? {} : { userId }),
        ...(status ? { status } : {}),
        ...(loanType ? { loanType } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(search ? { search } : {}),
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
  
  /**
   * POST /api/v1/loans/:id/guarantors/:gid/consent
   * 
   * Guarantor provides consent for a loan.
   * 
   * Auth: MEMBER (must be the guarantor)
   * Rate Limit: 10 requests/minute
   */
  fastify.post(
    '/:id/guarantors/:gid/consent',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Guarantor consent for loan',
        tags: ['loans'],
        params: {
          type: 'object',
          required: ['id', 'gid'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            gid: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['consent'],
          properties: {
            consent: { type: 'boolean' },
            declineReason: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ 
      Params: { id: string; gid: string };
      Body: { consent: boolean; declineReason?: string };
    }>, reply: FastifyReply) => {
      const userId = request.user.id;
      const { id: loanId, gid: guarantorId } = request.params;
      const { consent, declineReason } = request.body;
      
      const result = await loanService.guarantorConsent(
        loanId,
        guarantorId,
        consent,
        declineReason
      );
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      return reply.send({
        success: true,
        data: {
          message: consent ? 'Consent provided successfully' : 'Loan declined',
        },
      });
    }
  );
  
  /**
   * POST /api/v1/loans/:id/approve
   * 
   * Approve a loan (role-specific).
   * - PRESIDENT: First approval
   * - COMMITTEE: Second approval (requires 2 attestations)
   * - TREASURER: Final approval and disbursement
   * 
   * Auth: PRESIDENT, COMMITTEE, TREASURER
   * Rate Limit: 10 requests/minute
   */
  fastify.post(
    '/:id/approve',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Approve loan',
        tags: ['loans'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            comments: { type: 'string' },
            adjustedAmountKobo: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ 
      Params: { id: string };
      Body: { comments?: string; adjustedAmountKobo?: number };
    }>, reply: FastifyReply) => {
      const userId = request.user.id;
      const userRoles = request.user.roles || [];
      const { id: loanId } = request.params;
      const { comments, adjustedAmountKobo } = request.body;
      
      let result;
      
      if (userRoles.includes('PRESIDENT')) {
        result = await loanService.approveByPresident(
          loanId,
          userId,
          true, // approved
          comments,
          undefined // no rejection reason for approval
        );
      } else if (userRoles.includes('COMMITTEE')) {
        result = await loanService.approveByCommittee(
          loanId,
          userId,
          true, // approved
          comments
        );
      } else if (userRoles.includes('TREASURER')) {
        result = await loanService.approveByTreasurer(
          loanId,
          userId,
          true, // approved
          comments
        );
      } else {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to approve loans',
          },
        });
      }
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      return reply.send({
        success: true,
        data: {
          message: 'Loan approved successfully',
        },
      });
    }
  );
  
  /**
   * POST /api/v1/loans/:id/reject
   * 
   * Reject a loan application.
   * 
   * Auth: PRESIDENT, COMMITTEE, TREASURER
   * Rate Limit: 10 requests/minute
   */
  fastify.post(
    '/:id/reject',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Reject loan',
        tags: ['loans'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 10 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ 
      Params: { id: string };
      Body: { reason: string };
    }>, reply: FastifyReply) => {
      const userId = request.user.id;
      const userRoles = request.user.roles || [];
      const { id: loanId } = request.params;
      const { reason } = request.body;
      
      const isOfficer = userRoles.some((role: string) => 
        ['PRESIDENT', 'COMMITTEE', 'TREASURER'].includes(role)
      );
      
      if (!isOfficer) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to reject loans',
          },
        });
      }
      
      // Determine approver role
      let approverRole: 'PRESIDENT' | 'COMMITTEE' | 'TREASURER';
      if (userRoles.includes('PRESIDENT')) {
        approverRole = 'PRESIDENT';
      } else if (userRoles.includes('COMMITTEE')) {
        approverRole = 'COMMITTEE';
      } else {
        approverRole = 'TREASURER';
      }
      
      const result = await loanService.rejectLoan(loanId, userId, approverRole, reason);
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      return reply.send({
        success: true,
        data: {
          message: 'Loan rejected successfully',
        },
      });
    }
  );
  
  /**
   * POST /api/v1/loans/:id/cancel
   * 
   * Cancel a loan application (applicant only).
   * 
   * Auth: MEMBER (must be applicant)
   * Rate Limit: 10 requests/minute
   */
  fastify.post(
    '/:id/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Cancel loan application',
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
      const { id: loanId } = request.params;
      
      const result = await loanService.cancelApplication(loanId, userId);
      
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }
      
      return reply.send({
        success: true,
        data: {
          message: 'Loan application cancelled successfully',
        },
      });
    }
  );

  /**
   * POST /api/v1/loans/:id/disburse
   * 
   * Disburse an approved loan (Treasurer only).
   * Transfers funds via Monnify API and updates loan status.
   * 
   * Auth: TREASURER only
   * Idempotency: Required
   * Rate Limit: 5 requests/minute
   */
  fastify.post(
    '/:id/disburse',
    {
      preHandler: [fastify.authenticate, fastify.requireIdempotency],
      schema: {
        description: 'Disburse an approved loan',
        tags: ['loans'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  loanReference: { type: 'string' },
                  status: { type: 'string' },
                  transferReference: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      // Check if user is TREASURER
      if (!request.user.roles.includes('TREASURER')) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only treasurers can disburse loans',
          },
        });
      }

      const result = await loanService.disburseLoan(
        request.params.id,
        request.user.id
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }

      return reply.send({
        success: true,
        data: result.value,
      });
    }
  );

  /**
   * POST /api/v1/loans/:id/repayments
   * 
   * Record a loan repayment.
   * Updates outstanding balance and marks loan as completed if fully repaid.
   * 
   * Auth: TREASURER or SECRETARY
   * Idempotency: Required
   * Rate Limit: 10 requests/minute
   */
  fastify.post(
    '/:id/repayments',
    {
      preHandler: [fastify.authenticate, fastify.requireIdempotency],
      schema: {
        description: 'Record a loan repayment',
        tags: ['loans'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            amountKobo: { type: 'number' },
            paymentDate: { type: 'string', format: 'date' },
            paymentReference: { type: 'string' },
            paymentMethod: { type: 'string', enum: ['PAYROLL_DEDUCTION', 'MANUAL', 'BANK_TRANSFER'] },
          },
          required: ['amountKobo', 'paymentDate', 'paymentReference', 'paymentMethod'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  outstandingKobo: { type: 'number' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          amountKobo: number;
          paymentDate: string;
          paymentReference: string;
          paymentMethod: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      // Check if user is TREASURER or SECRETARY
      if (!request.user.roles.includes('TREASURER') && !request.user.roles.includes('SECRETARY')) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only treasurers and secretaries can record repayments',
          },
        });
      }

      const result = await loanService.recordRepayment(
        request.params.id,
        toKoboAmount(request.body.amountKobo),
        new Date(request.body.paymentDate),
        request.body.paymentReference,
        request.body.paymentMethod,
        request.user.id
      );

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: result.error,
            message: ERROR_MESSAGES[result.error] || 'An error occurred',
          },
        });
      }

      return reply.send({
        success: true,
        data: result.value,
      });
    }
  );
}
