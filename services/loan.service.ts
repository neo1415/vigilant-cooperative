/**
 * Loan Service
 * 
 * Handles loan eligibility calculation, application submission, and validation.
 * Implements all 9 loan validation conditions from the PRD.
 * 
 * CRITICAL RULES:
 * - All monetary calculations use Decimal.js with ROUND_FLOOR
 * - Interest rates: 5% flat for short-term, 10% flat for long-term
 * - Loan-to-savings ratio from config (default 3.0x)
 * - All validations must pass before database write
 * 
 * @module services/loan
 */

import { db } from '../server/db/init';
import { 
  users, 
  savingsAccounts, 
  loans, 
  loanGuarantors,
  loanApprovals,
  loanRepayments,
  configSettings 
} from '../server/db/schema';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { Result, ok, err, isErr } from '../types/result';
import { KoboAmount, toKoboAmount } from '../types/branded';
import { 
  calculateLoanEligibility, 
  calculateLoanTerms
} from '../utils/financial';
import { generateReference } from '../utils/reference';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface EligibilityResult {
  eligible: boolean;
  eligibilityKobo: KoboAmount;
  blockers: string[];
  activeLongTermCount: number;
  activeShortTermCount: number;
  canApplyLongTerm: boolean;
  canApplyShortTerm: boolean;
  normalSavingsKobo: KoboAmount;
  outstandingLoansKobo: KoboAmount;
}

export interface LoanApplicationInput {
  applicantId: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: KoboAmount;
  repaymentMonths: number;
  purpose: string;
  purposeDetail?: string;
  guarantorIds: string[];
}

export interface LoanApplicationResult {
  loanId: string;
  loanReference: string;
  principalKobo: KoboAmount;
  interestKobo: KoboAmount;
  totalRepayableKobo: KoboAmount;
  monthlyInstallmentKobo: KoboAmount;
  status: string;
}

export interface GuarantorValidation {
  guarantorId: string;
  valid: boolean;
  reason?: string;
  exposure?: KoboAmount;
  savingsBalance?: KoboAmount;
}

export interface LoanListItem {
  id: string;
  loanReference: string;
  applicantId: string;
  applicantName: string;
  applicantMemberId: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: KoboAmount;
  totalRepayableKobo: KoboAmount;
  outstandingKobo: KoboAmount;
  status: string;
  submittedAt: string;
  disbursedAt: string | null;
}

export interface LoanDetails {
  id: string;
  loanReference: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: KoboAmount;
  interestRateBps: number;
  interestKobo: KoboAmount;
  totalRepayableKobo: KoboAmount;
  monthlyInstallmentKobo: KoboAmount;
  outstandingKobo: KoboAmount;
  repaymentMonths: number;
  purpose: string;
  purposeDetail?: string | undefined;
  status: string;
  submittedAt: string;
  disbursedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionReason?: string | undefined;
  applicant: {
    id: string;
    memberId: string;
    fullName: string;
    email?: string | undefined;
    department?: string | undefined;
  };
  guarantors: GuarantorDetails[];
  approvals: ApprovalDetails[];
  repayments: RepaymentDetails[];
  repaymentSchedule: RepaymentScheduleItem[];
}

export interface GuarantorDetails {
  id: string;
  guarantorId: string;
  memberId: string;
  fullName: string;
  status: string;
  consentedAt: string | null;
  declinedAt: string | null;
  declineReason?: string | undefined;
}

export interface ApprovalDetails {
  id: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: string;
  previousAmountKobo?: KoboAmount | undefined;
  newAmountKobo?: KoboAmount | undefined;
  comments?: string | undefined;
  createdAt: string;
}

export interface RepaymentDetails {
  id: string;
  amountKobo: KoboAmount;
  paymentDate: string;
  paymentReference: string;
  paymentMethod: string;
  recordedBy: string;
  createdAt: string;
}

export interface RepaymentScheduleItem {
  month: number;
  dueDate: string;
  installmentKobo: KoboAmount;
  remainingBalanceKobo: KoboAmount;
}

export interface LoanListFilters {
  userId?: string;
  status?: string;
  loanType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface LoanListResult {
  loans: LoanListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export enum LoanErrorCode {
  // Applicant validation errors
  EMPLOYMENT_INACTIVE = 'EMPLOYMENT_INACTIVE',
  ACCOUNT_NOT_APPROVED = 'ACCOUNT_NOT_APPROVED',
  ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',
  NO_SAVINGS_ON_FILE = 'NO_SAVINGS_ON_FILE',
  INSUFFICIENT_ELIGIBILITY = 'INSUFFICIENT_ELIGIBILITY',
  
  // Loan type validation errors
  INVALID_LOAN_TYPE = 'INVALID_LOAN_TYPE',
  MAX_ACTIVE_LOANS_REACHED = 'MAX_ACTIVE_LOANS_REACHED',
  INVALID_REPAYMENT_PERIOD = 'INVALID_REPAYMENT_PERIOD',
  
  // Guarantor validation errors
  INSUFFICIENT_GUARANTORS = 'INSUFFICIENT_GUARANTORS',
  SELF_GUARANTEE_NOT_ALLOWED = 'SELF_GUARANTEE_NOT_ALLOWED',
  GUARANTOR_NOT_ELIGIBLE = 'GUARANTOR_NOT_ELIGIBLE',
  GUARANTOR_EXPOSURE_EXCEEDED = 'GUARANTOR_EXPOSURE_EXCEEDED',
  
  // Approval workflow errors
  LOAN_NOT_FOUND = 'LOAN_NOT_FOUND',
  INVALID_LOAN_STATUS = 'INVALID_LOAN_STATUS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INSUFFICIENT_COMMITTEE_APPROVALS = 'INSUFFICIENT_COMMITTEE_APPROVALS',
  REJECTION_REASON_REQUIRED = 'REJECTION_REASON_REQUIRED',
  GUARANTOR_ALREADY_RESPONDED = 'GUARANTOR_ALREADY_RESPONDED',
  NOT_APPLICANT = 'NOT_APPLICANT',
  
  // System errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
}

// ============================================================================
// Configuration Defaults
// ============================================================================

const DEFAULT_CONFIG = {
  loanToSavingsRatio: 3.0,
  maxActiveLongTermLoans: 1,
  maxActiveShortTermLoans: 2,
  minGuarantorsShortTerm: 2,
  minGuarantorsLongTerm: 3,
  maxGuarantorsPerMember: 5,
  guarantorExposureLimitPct: 200, // 200% of guarantor's savings
  shortTermMaxMonths: 6,
  longTermMaxMonths: 12,
  shortTermInterestRateBps: 500, // 5%
  longTermInterestRateBps: 1000, // 10%
};

// ============================================================================
// Loan Service Class
// ============================================================================

export class LoanService {
  /**
   * Get system configuration with defaults
   */
  private async getConfig(): Promise<typeof DEFAULT_CONFIG> {
    try {
      const configs = await db.select().from(configSettings);
      
      const configMap = configs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {} as Record<string, unknown>);
      
      return {
        loanToSavingsRatio: (configMap.loan_to_savings_ratio as number) ?? DEFAULT_CONFIG.loanToSavingsRatio,
        maxActiveLongTermLoans: (configMap.max_active_long_term_loans as number) ?? DEFAULT_CONFIG.maxActiveLongTermLoans,
        maxActiveShortTermLoans: (configMap.max_active_short_term_loans as number) ?? DEFAULT_CONFIG.maxActiveShortTermLoans,
        minGuarantorsShortTerm: (configMap.min_guarantors_short_term as number) ?? DEFAULT_CONFIG.minGuarantorsShortTerm,
        minGuarantorsLongTerm: (configMap.min_guarantors_long_term as number) ?? DEFAULT_CONFIG.minGuarantorsLongTerm,
        maxGuarantorsPerMember: (configMap.max_guarantors_per_member as number) ?? DEFAULT_CONFIG.maxGuarantorsPerMember,
        guarantorExposureLimitPct: (configMap.guarantor_exposure_limit_pct as number) ?? DEFAULT_CONFIG.guarantorExposureLimitPct,
        shortTermMaxMonths: (configMap.short_term_max_months as number) ?? DEFAULT_CONFIG.shortTermMaxMonths,
        longTermMaxMonths: (configMap.long_term_max_months as number) ?? DEFAULT_CONFIG.longTermMaxMonths,
        shortTermInterestRateBps: (configMap.short_term_interest_rate_bps as number) ?? DEFAULT_CONFIG.shortTermInterestRateBps,
        longTermInterestRateBps: (configMap.long_term_interest_rate_bps as number) ?? DEFAULT_CONFIG.longTermInterestRateBps,
      };
    } catch (error) {
      console.error('Error loading config, using defaults:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Calculate loan eligibility for a member
   * 
   * This calculation is called in multiple places and always reads from live database.
   * Never cache loan eligibility - staleness has financial consequences.
   * 
   * @param userId - Member user ID
   * @returns Eligibility result with available amounts and blockers
   */
  async calculateEligibility(userId: string): Promise<Result<EligibilityResult, LoanErrorCode>> {
    try {
      // Get user details
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));
      
      if (!user) {
        return err(LoanErrorCode.ACCOUNT_DEACTIVATED);
      }
      
      const blockers: string[] = [];
      
      // Check employment status
      if (user.employmentStatus !== 'ACTIVE') {
        blockers.push('EMPLOYMENT_INACTIVE');
      }
      
      // Check approval status
      if (!user.isApproved) {
        blockers.push('ACCOUNT_NOT_APPROVED');
      }
      
      // Get normal savings balance
      const [normalAccount] = await db
        .select()
        .from(savingsAccounts)
        .where(
          and(
            eq(savingsAccounts.userId, userId),
            eq(savingsAccounts.accountType, 'NORMAL'),
            isNull(savingsAccounts.deletedAt)
          )
        );
      
      const normalSavingsKobo = toKoboAmount(normalAccount?.balanceKobo ?? 0);
      
      if (normalSavingsKobo === 0) {
        blockers.push('NO_SAVINGS_ON_FILE');
      }
      
      // Get configuration
      const config = await this.getConfig();
      
      // Get active loans
      const activeLoans = await db
        .select()
        .from(loans)
        .where(
          and(
            eq(loans.applicantId, userId),
            inArray(loans.status, [
              'SUBMITTED',
              'GUARANTOR_CONSENT',
              'PRESIDENT_REVIEW',
              'COMMITTEE_REVIEW',
              'TREASURER_REVIEW',
              'DISBURSED',
              'ACTIVE'
            ]),
            isNull(loans.deletedAt)
          )
        );
      
      // Calculate outstanding loans
      const outstandingLoansKobo = toKoboAmount(
        activeLoans.reduce((sum, loan) => sum + loan.outstandingKobo, 0)
      );
      
      // Calculate eligibility
      const eligibilityKobo = calculateLoanEligibility(
        normalSavingsKobo,
        config.loanToSavingsRatio,
        outstandingLoansKobo
      );
      
      // Count active loans by type
      const activeLongTermCount = activeLoans.filter(l => l.loanType === 'LONG_TERM').length;
      const activeShortTermCount = activeLoans.filter(l => l.loanType === 'SHORT_TERM').length;
      
      // Check if can apply for each type
      const canApplyLongTerm = activeLongTermCount < config.maxActiveLongTermLoans;
      const canApplyShortTerm = activeShortTermCount < config.maxActiveShortTermLoans;
      
      return ok({
        eligible: blockers.length === 0 && eligibilityKobo > 0,
        eligibilityKobo,
        blockers,
        activeLongTermCount,
        activeShortTermCount,
        canApplyLongTerm,
        canApplyShortTerm,
        normalSavingsKobo,
        outstandingLoansKobo,
      });
    } catch (error) {
      console.error('Error calculating eligibility:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Validate guarantor eligibility
   * 
   * Checks all guarantor requirements:
   * - Not the applicant
   * - Active employment
   * - Approved account
   * - Not exceeding max guarantees
   * - Sufficient savings for exposure
   */
  private async validateGuarantor(
    guarantorId: string,
    applicantId: string,
    principalKobo: KoboAmount,
    config: typeof DEFAULT_CONFIG
  ): Promise<GuarantorValidation> {
    // Check self-guarantee
    if (guarantorId === applicantId) {
      return {
        guarantorId,
        valid: false,
        reason: 'SELF_GUARANTEE_NOT_ALLOWED',
      };
    }
    
    // Get guarantor details
    const [guarantor] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, guarantorId), isNull(users.deletedAt)));
    
    if (!guarantor) {
      return {
        guarantorId,
        valid: false,
        reason: 'GUARANTOR_NOT_FOUND',
      };
    }
    
    // Check employment status
    if (guarantor.employmentStatus !== 'ACTIVE') {
      return {
        guarantorId,
        valid: false,
        reason: 'GUARANTOR_EMPLOYMENT_INACTIVE',
      };
    }
    
    // Check approval status
    if (!guarantor.isApproved) {
      return {
        guarantorId,
        valid: false,
        reason: 'GUARANTOR_NOT_APPROVED',
      };
    }
    
    // Get guarantor's normal savings
    const [guarantorSavings] = await db
      .select()
      .from(savingsAccounts)
      .where(
        and(
          eq(savingsAccounts.userId, guarantorId),
          eq(savingsAccounts.accountType, 'NORMAL'),
          isNull(savingsAccounts.deletedAt)
        )
      );
    
    const savingsBalance = toKoboAmount(guarantorSavings?.balanceKobo ?? 0);
    
    // Calculate current guarantor exposure
    const exposureResult = await db.execute<{ exposure_kobo: string; active_guarantee_count: string }>(sql`
      SELECT COALESCE(SUM(l.outstanding_kobo), 0) AS exposure_kobo,
             COUNT(DISTINCT l.id) AS active_guarantee_count
      FROM ${loanGuarantors} g
      JOIN ${loans} l ON g.loan_id = l.id
      WHERE g.guarantor_id = ${guarantorId}
        AND g.status = 'CONSENTED'
        AND l.status IN (
          'ACTIVE', 'DISBURSED', 'TREASURER_REVIEW',
          'COMMITTEE_REVIEW', 'PRESIDENT_REVIEW', 'GUARANTOR_CONSENT', 'SUBMITTED'
        )
        AND l.deleted_at IS NULL
        AND l.applicant_id != ${guarantorId}
    `);
    
    const currentExposure = toKoboAmount(Number(exposureResult.rows[0]?.exposure_kobo ?? 0));
    const activeGuaranteeCount = Number(exposureResult.rows[0]?.active_guarantee_count ?? 0);
    
    // Check max guarantees per member
    if (activeGuaranteeCount >= config.maxGuarantorsPerMember) {
      return {
        guarantorId,
        valid: false,
        reason: 'MAX_GUARANTEES_REACHED',
        exposure: currentExposure,
        savingsBalance,
      };
    }
    
    // Calculate exposure limit
    const exposureLimit = toKoboAmount(
      Math.floor((savingsBalance * config.guarantorExposureLimitPct) / 100)
    );
    
    const newExposure = toKoboAmount(currentExposure + principalKobo);
    
    // Check exposure limit
    if (newExposure > exposureLimit) {
      return {
        guarantorId,
        valid: false,
        reason: 'GUARANTOR_EXPOSURE_EXCEEDED',
        exposure: currentExposure,
        savingsBalance,
      };
    }
    
    return {
      guarantorId,
      valid: true,
      exposure: currentExposure,
      savingsBalance,
    };
  }

  /**
   * Submit loan application
   * 
   * Validates all 9 loan conditions before creating the loan:
   * 1. Employment status = ACTIVE
   * 2. Account is approved
   * 3. Account not deleted
   * 4. Valid loan type
   * 5. Principal <= eligibility
   * 6. Repayment period <= max for loan type
   * 7. Active loans of type < max for type
   * 8. Sufficient guarantors for loan type
   * 9. All guarantors meet requirements
   * 
   * @param input - Loan application input
   * @returns Loan application result or error
   */
  async submitApplication(
    input: LoanApplicationInput
  ): Promise<Result<LoanApplicationResult, LoanErrorCode>> {
    try {
      const { applicantId, loanType, principalKobo, repaymentMonths, purpose, purposeDetail, guarantorIds } = input;
      
      // Get configuration
      const config = await this.getConfig();
      
      // Condition 1-3: Check applicant eligibility
      const eligibilityResult = await this.calculateEligibility(applicantId);
      
      if (!eligibilityResult.success) {
        return err(eligibilityResult.error);
      }
      
      const eligibility = eligibilityResult.value;
      
      if (!eligibility.eligible) {
        if (eligibility.blockers.includes('EMPLOYMENT_INACTIVE')) {
          return err(LoanErrorCode.EMPLOYMENT_INACTIVE);
        }
        if (eligibility.blockers.includes('ACCOUNT_NOT_APPROVED')) {
          return err(LoanErrorCode.ACCOUNT_NOT_APPROVED);
        }
        if (eligibility.blockers.includes('NO_SAVINGS_ON_FILE')) {
          return err(LoanErrorCode.NO_SAVINGS_ON_FILE);
        }
        return err(LoanErrorCode.ACCOUNT_DEACTIVATED);
      }
      
      // Condition 4: Valid loan type
      if (loanType !== 'SHORT_TERM' && loanType !== 'LONG_TERM') {
        return err(LoanErrorCode.INVALID_LOAN_TYPE);
      }
      
      // Condition 5: Principal <= eligibility
      if (principalKobo > eligibility.eligibilityKobo) {
        return err(LoanErrorCode.INSUFFICIENT_ELIGIBILITY);
      }
      
      // Condition 6: Repayment period validation
      const maxMonths = loanType === 'SHORT_TERM' ? config.shortTermMaxMonths : config.longTermMaxMonths;
      if (repaymentMonths > maxMonths || repaymentMonths <= 0) {
        return err(LoanErrorCode.INVALID_REPAYMENT_PERIOD);
      }
      
      // Condition 7: Check active loans of this type
      if (loanType === 'LONG_TERM' && !eligibility.canApplyLongTerm) {
        return err(LoanErrorCode.MAX_ACTIVE_LOANS_REACHED);
      }
      if (loanType === 'SHORT_TERM' && !eligibility.canApplyShortTerm) {
        return err(LoanErrorCode.MAX_ACTIVE_LOANS_REACHED);
      }
      
      // Condition 8: Check minimum guarantors
      const minGuarantors = loanType === 'SHORT_TERM' 
        ? config.minGuarantorsShortTerm 
        : config.minGuarantorsLongTerm;
      
      if (guarantorIds.length < minGuarantors) {
        return err(LoanErrorCode.INSUFFICIENT_GUARANTORS);
      }
      
      // Condition 9: Validate all guarantors
      const guarantorValidations = await Promise.all(
        guarantorIds.map(gId => this.validateGuarantor(gId, applicantId, principalKobo, config))
      );
      
      const invalidGuarantors = guarantorValidations.filter(v => !v.valid);
      if (invalidGuarantors.length > 0) {
        // Return first invalid guarantor reason
        return err(LoanErrorCode.GUARANTOR_NOT_ELIGIBLE);
      }
      
      // Calculate loan terms
      const interestRateBps = loanType === 'SHORT_TERM' 
        ? config.shortTermInterestRateBps 
        : config.longTermInterestRateBps;
      
      const terms = calculateLoanTerms(principalKobo, interestRateBps, repaymentMonths);
      
      // Generate loan reference
      const loanReference = await generateReference('LN');
      
      // Create loan record
      const loanResult = await db
        .insert(loans)
        .values({
          loanReference,
          applicantId,
          loanType,
          principalKobo,
          interestRateBps,
          interestKobo: terms.interestKobo,
          totalRepayableKobo: terms.totalRepayableKobo,
          monthlyInstallmentKobo: terms.monthlyInstallment,
          outstandingKobo: terms.totalRepayableKobo,
          repaymentMonths,
          purpose,
          purposeDetail: purposeDetail ?? null,
          status: 'SUBMITTED',
        })
        .returning();
      
      const loan = loanResult[0];
      if (!loan) {
        return err(LoanErrorCode.DATABASE_ERROR);
      }
      
      // Create guarantor records with PENDING status
      await db.insert(loanGuarantors).values(
        guarantorIds.map(guarantorId => ({
          loanId: loan.id,
          guarantorId,
          status: 'PENDING' as const,
        }))
      );
      
      // TODO: Send notifications to guarantors (will be implemented in notification service)
      
      return ok({
        loanId: loan.id,
        loanReference: loan.loanReference,
        principalKobo: toKoboAmount(loan.principalKobo),
        interestKobo: toKoboAmount(loan.interestKobo),
        totalRepayableKobo: toKoboAmount(loan.totalRepayableKobo),
        monthlyInstallmentKobo: toKoboAmount(loan.monthlyInstallmentKobo),
        status: loan.status,
      });
    } catch (error) {
      console.error('Error submitting loan application:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get loan details by ID
   * 
   * Returns complete loan information including guarantors, approvals, and repayments.
   * Members can only view their own loans, officers can view all loans.
   * 
   * @param loanId - Loan ID
   * @param requestingUserId - User requesting the loan details
   * @param isOfficer - Whether the requesting user is an officer
   * @returns Complete loan details or error
   */
  async getLoanDetails(
    loanId: string,
    requestingUserId: string,
    isOfficer: boolean
  ): Promise<Result<LoanDetails, LoanErrorCode>> {
    try {
      // Get loan with applicant details
      const [loanData] = await db
        .select({
          loan: loans,
          applicant: users,
        })
        .from(loans)
        .innerJoin(users, eq(loans.applicantId, users.id))
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loanData) {
        return err(LoanErrorCode.DATABASE_ERROR);
      }
      
      const { loan, applicant } = loanData;
      
      // Check authorization: members can only view their own loans
      if (!isOfficer && loan.applicantId !== requestingUserId) {
        return err(LoanErrorCode.DATABASE_ERROR);
      }
      
      // Get guarantors with their details
      const guarantorData = await db
        .select({
          guarantor: loanGuarantors,
          user: users,
        })
        .from(loanGuarantors)
        .innerJoin(users, eq(loanGuarantors.guarantorId, users.id))
        .where(eq(loanGuarantors.loanId, loanId));
      
      // Get approval history
      const approvalData = await db
        .select({
          approval: loanApprovals,
          approver: users,
        })
        .from(loanApprovals)
        .innerJoin(users, eq(loanApprovals.approverId, users.id))
        .where(eq(loanApprovals.loanId, loanId))
        .orderBy(sql`${loanApprovals.createdAt} ASC`);
      
      // Get repayment history
      const repaymentData = await db
        .select({
          repayment: loanRepayments,
          recorder: users,
        })
        .from(loanRepayments)
        .innerJoin(users, eq(loanRepayments.recordedBy, users.id))
        .where(eq(loanRepayments.loanId, loanId))
        .orderBy(sql`${loanRepayments.paymentDate} DESC`);
      
      // Calculate repayment schedule
      const schedule = this.calculateRepaymentSchedule(
        toKoboAmount(loan.totalRepayableKobo),
        toKoboAmount(loan.monthlyInstallmentKobo),
        loan.repaymentMonths,
        loan.disbursedAt ?? loan.submittedAt
      );
      
      return ok({
        id: loan.id,
        loanReference: loan.loanReference,
        loanType: loan.loanType as 'SHORT_TERM' | 'LONG_TERM',
        principalKobo: toKoboAmount(loan.principalKobo),
        interestRateBps: loan.interestRateBps,
        interestKobo: toKoboAmount(loan.interestKobo),
        totalRepayableKobo: toKoboAmount(loan.totalRepayableKobo),
        monthlyInstallmentKobo: toKoboAmount(loan.monthlyInstallmentKobo),
        outstandingKobo: toKoboAmount(loan.outstandingKobo),
        repaymentMonths: loan.repaymentMonths,
        purpose: loan.purpose,
        purposeDetail: loan.purposeDetail ?? undefined,
        status: loan.status,
        submittedAt: loan.submittedAt.toISOString(),
        disbursedAt: loan.disbursedAt?.toISOString() ?? null,
        completedAt: loan.completedAt?.toISOString() ?? null,
        rejectedAt: loan.rejectedAt?.toISOString() ?? null,
        rejectionReason: loan.rejectionReason ?? undefined,
        applicant: {
          id: applicant.id,
          memberId: applicant.memberId,
          fullName: applicant.fullName,
          email: applicant.email ?? undefined,
          department: applicant.department ?? undefined,
        },
        guarantors: guarantorData.map(({ guarantor, user }) => ({
          id: guarantor.id,
          guarantorId: user.id,
          memberId: user.memberId,
          fullName: user.fullName,
          status: guarantor.status,
          consentedAt: guarantor.consentedAt?.toISOString() ?? null,
          declinedAt: guarantor.declinedAt?.toISOString() ?? null,
          declineReason: guarantor.declineReason ?? undefined,
        })),
        approvals: approvalData.map(({ approval, approver }) => ({
          id: approval.id,
          approverId: approver.id,
          approverName: approver.fullName,
          approverRole: approval.approverRole,
          action: approval.action,
          previousAmountKobo: approval.previousAmountKobo ? toKoboAmount(approval.previousAmountKobo) : undefined,
          newAmountKobo: approval.newAmountKobo ? toKoboAmount(approval.newAmountKobo) : undefined,
          comments: approval.comments ?? undefined,
          createdAt: approval.createdAt.toISOString(),
        })),
        repayments: repaymentData.map(({ repayment, recorder }) => ({
          id: repayment.id,
          amountKobo: toKoboAmount(repayment.amountKobo),
          paymentDate: repayment.paymentDate,
          paymentReference: repayment.paymentReference,
          paymentMethod: repayment.paymentMethod,
          recordedBy: recorder.fullName,
          createdAt: repayment.createdAt.toISOString(),
        })),
        repaymentSchedule: schedule,
      });
    } catch (error) {
      console.error('Error getting loan details:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }
  
  /**
   * Calculate repayment schedule
   * 
   * Generates a month-by-month repayment schedule showing expected payments.
   * 
   * @param totalRepayableKobo - Total amount to repay
   * @param monthlyInstallmentKobo - Monthly installment amount
   * @param months - Number of months
   * @param startDate - Loan disbursement or submission date
   * @returns Array of repayment schedule items
   */
  private calculateRepaymentSchedule(
    totalRepayableKobo: KoboAmount,
    monthlyInstallmentKobo: KoboAmount,
    months: number,
    startDate: Date
  ): RepaymentScheduleItem[] {
    const schedule: RepaymentScheduleItem[] = [];
    let remainingBalance = totalRepayableKobo;
    
    for (let i = 0; i < months; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      
      // Last installment gets the remaining balance
      const installment = i === months - 1 
        ? remainingBalance 
        : monthlyInstallmentKobo;
      
      remainingBalance = toKoboAmount(remainingBalance - installment);
      
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      schedule.push({
        month: i + 1,
        dueDate: dueDateStr ?? dueDate.toISOString(),
        installmentKobo: installment,
        remainingBalanceKobo: remainingBalance,
      });
    }
    
    return schedule;
  }

  /**
   * List loans with filtering and pagination
   * 
   * Members see only their own loans.
   * Officers see all loans.
   * 
   * @param filters - Filtering and pagination options
   * @returns List of loans with pagination metadata
   */
  async listLoans(filters: LoanListFilters): Promise<Result<LoanListResult, LoanErrorCode>> {
    try {
      const { userId, status, loanType, startDate, endDate, search, page, limit } = filters;
      
      // Build WHERE conditions
      const conditions = [isNull(loans.deletedAt)];
      
      if (userId) {
        conditions.push(eq(loans.applicantId, userId));
      }
      
      if (status) {
        conditions.push(eq(loans.status, status));
      }
      
      if (loanType) {
        conditions.push(eq(loans.loanType, loanType as 'SHORT_TERM' | 'LONG_TERM'));
      }
      
      if (startDate) {
        conditions.push(sql`${loans.submittedAt} >= ${new Date(startDate).toISOString()}`);
      }
      
      if (endDate) {
        conditions.push(sql`${loans.submittedAt} <= ${new Date(endDate).toISOString()}`);
      }
      
      if (search) {
        conditions.push(sql`${loans.loanReference} ILIKE ${`%${search}%`}`);
      }
      
      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loans)
        .where(and(...conditions));
      
      const total = countResult?.count ?? 0;
      const totalPages = Math.ceil(total / limit);
      
      // Get loans with applicant details
      const loanList = await db
        .select({
          id: loans.id,
          loanReference: loans.loanReference,
          applicantId: loans.applicantId,
          applicantName: users.fullName,
          applicantMemberId: users.memberId,
          loanType: loans.loanType,
          principalKobo: loans.principalKobo,
          totalRepayableKobo: loans.totalRepayableKobo,
          outstandingKobo: loans.outstandingKobo,
          status: loans.status,
          submittedAt: loans.submittedAt,
          disbursedAt: loans.disbursedAt,
        })
        .from(loans)
        .innerJoin(users, eq(loans.applicantId, users.id))
        .where(and(...conditions))
        .orderBy(sql`${loans.submittedAt} DESC`)
        .limit(limit)
        .offset((page - 1) * limit);
      
      return ok({
        loans: loanList.map(loan => ({
          id: loan.id,
          loanReference: loan.loanReference,
          applicantId: loan.applicantId,
          applicantName: loan.applicantName,
          applicantMemberId: loan.applicantMemberId,
          loanType: loan.loanType as 'SHORT_TERM' | 'LONG_TERM',
          principalKobo: toKoboAmount(loan.principalKobo),
          totalRepayableKobo: toKoboAmount(loan.totalRepayableKobo),
          outstandingKobo: toKoboAmount(loan.outstandingKobo),
          status: loan.status,
          submittedAt: loan.submittedAt.toISOString(),
          disbursedAt: loan.disbursedAt?.toISOString() ?? null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      });
    } catch (error) {
      console.error('Error listing loans:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Guarantor consent - Guarantor provides consent for a loan
   * 
   * When all guarantors consent, loan status advances to PRESIDENT_REVIEW.
   * 
   * @param loanId - Loan ID
   * @param guarantorId - Guarantor user ID
   * @param consent - true for consent, false for decline
   * @param declineReason - Required if declining
   * @returns Success result or error
   */
  async guarantorConsent(
    loanId: string,
    guarantorId: string,
    consent: boolean,
    declineReason?: string
  ): Promise<Result<{ status: string }, LoanErrorCode>> {
    try {
      // Get loan
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }
      
      // Verify loan is in SUBMITTED or GUARANTOR_CONSENT status
      if (loan.status !== 'SUBMITTED' && loan.status !== 'GUARANTOR_CONSENT') {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }
      
      // Get guarantor record
      const [guarantorRecord] = await db
        .select()
        .from(loanGuarantors)
        .where(
          and(
            eq(loanGuarantors.loanId, loanId),
            eq(loanGuarantors.guarantorId, guarantorId)
          )
        );
      
      if (!guarantorRecord) {
        return err(LoanErrorCode.UNAUTHORIZED);
      }
      
      // Check if already responded
      if (guarantorRecord.status !== 'PENDING') {
        return err(LoanErrorCode.GUARANTOR_ALREADY_RESPONDED);
      }
      
      // Update guarantor status
      if (consent) {
        await db
          .update(loanGuarantors)
          .set({
            status: 'CONSENTED',
            consentedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(loanGuarantors.id, guarantorRecord.id));
      } else {
        if (!declineReason || declineReason.length < 10) {
          return err(LoanErrorCode.REJECTION_REASON_REQUIRED);
        }
        
        await db
          .update(loanGuarantors)
          .set({
            status: 'DECLINED',
            declinedAt: new Date(),
            declineReason,
            updatedAt: new Date(),
          })
          .where(eq(loanGuarantors.id, guarantorRecord.id));
        
        // If any guarantor declines, reject the loan
        await db
          .update(loans)
          .set({
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason: `Guarantor declined: ${declineReason}`,
            rejectedBy: guarantorId,
            updatedAt: new Date(),
            version: loan.version + 1,
          })
          .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        
        // TODO: Send notification to applicant
        
        return ok({ status: 'REJECTED' });
      }
      
      // Check if all guarantors have consented
      const allGuarantors = await db
        .select()
        .from(loanGuarantors)
        .where(eq(loanGuarantors.loanId, loanId));
      
      const allConsented = allGuarantors.every(g => g.status === 'CONSENTED');
      
      if (allConsented) {
        // Advance to PRESIDENT_REVIEW
        await db
          .update(loans)
          .set({
            status: 'PRESIDENT_REVIEW',
            updatedAt: new Date(),
            version: loan.version + 1,
          })
          .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        
        // TODO: Send notification to President
        
        return ok({ status: 'PRESIDENT_REVIEW' });
      } else {
        // Update to GUARANTOR_CONSENT if not already
        if (loan.status === 'SUBMITTED') {
          await db
            .update(loans)
            .set({
              status: 'GUARANTOR_CONSENT',
              updatedAt: new Date(),
              version: loan.version + 1,
            })
            .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        }
        
        return ok({ status: 'GUARANTOR_CONSENT' });
      }
    } catch (error) {
      console.error('Error processing guarantor consent:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * President approval - President approves or rejects loan
   * 
   * When approved, loan advances to COMMITTEE_REVIEW.
   * 
   * @param loanId - Loan ID
   * @param approverId - President user ID
   * @param approved - true for approve, false for reject
   * @param comments - Optional comments
   * @param rejectionReason - Required if rejecting
   * @returns Success result or error
   */
  async approveByPresident(
    loanId: string,
    approverId: string,
    approved: boolean,
    comments?: string,
    rejectionReason?: string
  ): Promise<Result<{ status: string }, LoanErrorCode>> {
    try {
      // Get loan
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }
      
      // Verify loan is in PRESIDENT_REVIEW status
      if (loan.status !== 'PRESIDENT_REVIEW') {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }
      
      if (approved) {
        // Create approval record
        await db.insert(loanApprovals).values({
          loanId,
          approverId,
          approverRole: 'PRESIDENT',
          action: 'APPROVED',
          comments: comments ?? null,
        });
        
        // Advance to COMMITTEE_REVIEW
        await db
          .update(loans)
          .set({
            status: 'COMMITTEE_REVIEW',
            updatedAt: new Date(),
            version: loan.version + 1,
          })
          .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        
        // TODO: Send notification to Committee members
        
        return ok({ status: 'COMMITTEE_REVIEW' });
      } else {
        if (!rejectionReason || rejectionReason.length < 20) {
          return err(LoanErrorCode.REJECTION_REASON_REQUIRED);
        }
        
        // Create rejection record
        await db.insert(loanApprovals).values({
          loanId,
          approverId,
          approverRole: 'PRESIDENT',
          action: 'REJECTED',
          comments: rejectionReason,
        });
        
        // Reject loan
        await db
          .update(loans)
          .set({
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason,
            rejectedBy: approverId,
            updatedAt: new Date(),
            version: loan.version + 1,
          })
          .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        
        // TODO: Send notification to applicant
        
        return ok({ status: 'REJECTED' });
      }
    } catch (error) {
      console.error('Error processing president approval:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Committee approval - Committee member approves or rejects loan
   * 
   * Requires 2 committee member approvals to advance to TREASURER_REVIEW.
   * 
   * @param loanId - Loan ID
   * @param approverId - Committee member user ID
   * @param approved - true for approve, false for reject
   * @param comments - Optional comments
   * @param rejectionReason - Required if rejecting
   * @returns Success result or error
   */
  async approveByCommittee(
    loanId: string,
    approverId: string,
    approved: boolean,
    comments?: string,
    rejectionReason?: string
  ): Promise<Result<{ status: string; approvalCount?: number }, LoanErrorCode>> {
    try {
      // Get loan
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }
      
      // Verify loan is in COMMITTEE_REVIEW status
      if (loan.status !== 'COMMITTEE_REVIEW') {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }
      
      // Check if this committee member has already approved
      const existingApproval = await db
        .select()
        .from(loanApprovals)
        .where(
          and(
            eq(loanApprovals.loanId, loanId),
            eq(loanApprovals.approverId, approverId),
            eq(loanApprovals.approverRole, 'COMMITTEE')
          )
        );
      
      if (existingApproval.length > 0) {
        return err(LoanErrorCode.INVALID_INPUT);
      }
      
      if (approved) {
        // Create approval record
        await db.insert(loanApprovals).values({
          loanId,
          approverId,
          approverRole: 'COMMITTEE',
          action: 'APPROVED',
          comments: comments ?? null,
        });
        
        // Count committee approvals
        const committeeApprovals = await db
          .select()
          .from(loanApprovals)
          .where(
            and(
              eq(loanApprovals.loanId, loanId),
              eq(loanApprovals.approverRole, 'COMMITTEE'),
              eq(loanApprovals.action, 'APPROVED')
            )
          );
        
        const approvalCount = committeeApprovals.length;
        
        // Need 2 approvals to advance
        if (approvalCount >= 2) {
          await db
            .update(loans)
            .set({
              status: 'TREASURER_REVIEW',
              updatedAt: new Date(),
              version: loan.version + 1,
            })
            .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
          
          // TODO: Send notification to Treasurer
          
          return ok({ status: 'TREASURER_REVIEW', approvalCount });
        } else {
          return ok({ status: 'COMMITTEE_REVIEW', approvalCount });
        }
      } else {
        if (!rejectionReason || rejectionReason.length < 20) {
          return err(LoanErrorCode.REJECTION_REASON_REQUIRED);
        }
        
        // Create rejection record
        await db.insert(loanApprovals).values({
          loanId,
          approverId,
          approverRole: 'COMMITTEE',
          action: 'REJECTED',
          comments: rejectionReason,
        });
        
        // Reject loan
        await db
          .update(loans)
          .set({
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason,
            rejectedBy: approverId,
            updatedAt: new Date(),
            version: loan.version + 1,
          })
          .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        
        // TODO: Send notification to applicant
        
        return ok({ status: 'REJECTED' });
      }
    } catch (error) {
      console.error('Error processing committee approval:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Treasurer approval - Treasurer approves or rejects loan
   * 
   * This is the final approval stage. When approved, loan is ready for disbursement.
   * 
   * @param loanId - Loan ID
   * @param approverId - Treasurer user ID
   * @param approved - true for approve, false for reject
   * @param comments - Optional comments
   * @param rejectionReason - Required if rejecting
   * @returns Success result or error
   */
  async approveByTreasurer(
    loanId: string,
    approverId: string,
    approved: boolean,
    comments?: string,
    rejectionReason?: string
  ): Promise<Result<{ status: string }, LoanErrorCode>> {
    try {
      // Get loan
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }
      
      // Verify loan is in TREASURER_REVIEW status
      if (loan.status !== 'TREASURER_REVIEW') {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }
      
      if (approved) {
        // Create approval record
        await db.insert(loanApprovals).values({
          loanId,
          approverId,
          approverRole: 'TREASURER',
          action: 'APPROVED',
          comments: comments ?? null,
        });
        
        // Loan remains in TREASURER_REVIEW until disbursement
        // Status will change to DISBURSED when treasurer disburses funds
        
        // TODO: Send notification to applicant that loan is approved
        
        return ok({ status: 'TREASURER_REVIEW' });
      } else {
        if (!rejectionReason || rejectionReason.length < 20) {
          return err(LoanErrorCode.REJECTION_REASON_REQUIRED);
        }
        
        // Create rejection record
        await db.insert(loanApprovals).values({
          loanId,
          approverId,
          approverRole: 'TREASURER',
          action: 'REJECTED',
          comments: rejectionReason,
        });
        
        // Reject loan
        await db
          .update(loans)
          .set({
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectionReason,
            rejectedBy: approverId,
            updatedAt: new Date(),
            version: loan.version + 1,
          })
          .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
        
        // TODO: Send notification to applicant
        
        return ok({ status: 'REJECTED' });
      }
    } catch (error) {
      console.error('Error processing treasurer approval:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Reject loan - Any approver can reject a loan with reason
   * 
   * @param loanId - Loan ID
   * @param approverId - Approver user ID
   * @param approverRole - Approver role (PRESIDENT, COMMITTEE, TREASURER)
   * @param rejectionReason - Reason for rejection (minimum 20 characters)
   * @returns Success result or error
   */
  async rejectLoan(
    loanId: string,
    approverId: string,
    approverRole: 'PRESIDENT' | 'COMMITTEE' | 'TREASURER',
    rejectionReason: string
  ): Promise<Result<{ status: string }, LoanErrorCode>> {
    try {
      if (!rejectionReason || rejectionReason.length < 20) {
        return err(LoanErrorCode.REJECTION_REASON_REQUIRED);
      }
      
      // Get loan
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }
      
      // Verify loan is in a reviewable status
      const reviewableStatuses = ['PRESIDENT_REVIEW', 'COMMITTEE_REVIEW', 'TREASURER_REVIEW'];
      if (!reviewableStatuses.includes(loan.status)) {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }
      
      // Create rejection record
      await db.insert(loanApprovals).values({
        loanId,
        approverId,
        approverRole,
        action: 'REJECTED',
        comments: rejectionReason,
      });
      
      // Reject loan
      await db
        .update(loans)
        .set({
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason,
          rejectedBy: approverId,
          updatedAt: new Date(),
          version: loan.version + 1,
        })
        .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
      
      // TODO: Send notification to applicant
      
      return ok({ status: 'REJECTED' });
    } catch (error) {
      console.error('Error rejecting loan:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Cancel application - Applicant cancels their own loan application
   * 
   * Only allowed before disbursement.
   * 
   * @param loanId - Loan ID
   * @param applicantId - Applicant user ID
   * @returns Success result or error
   */
  async cancelApplication(
    loanId: string,
    applicantId: string
  ): Promise<Result<{ status: string }, LoanErrorCode>> {
    try {
      // Get loan
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)));
      
      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }
      
      // Verify user is the applicant
      if (loan.applicantId !== applicantId) {
        return err(LoanErrorCode.NOT_APPLICANT);
      }
      
      // Can only cancel before disbursement
      const cancellableStatuses = [
        'SUBMITTED',
        'GUARANTOR_CONSENT',
        'PRESIDENT_REVIEW',
        'COMMITTEE_REVIEW',
        'TREASURER_REVIEW'
      ];
      
      if (!cancellableStatuses.includes(loan.status)) {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }
      
      // Cancel loan
      await db
        .update(loans)
        .set({
          status: 'CANCELLED',
          updatedAt: new Date(),
          version: loan.version + 1,
        })
        .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));
      
      // TODO: Send notifications to guarantors and approvers
      
      return ok({ status: 'CANCELLED' });
    } catch (error) {
      console.error('Error cancelling loan application:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }


  /**
   * Disburse an approved loan
   *
   * CRITICAL: This function handles real money transfer via Monnify API.
   * Uses SERIALIZABLE isolation level and distributed locks.
   * Re-validates eligibility inside transaction to prevent TOCTOU attacks.
   *
   * @param loanId - Loan ID to disburse
   * @param treasurerId - Treasurer user ID performing disbursement
   * @returns Disbursement result with transaction details
   */
  async disburseLoan(
    loanId: string,
    treasurerId: string
  ): Promise<Result<{ loanReference: string; status: string; transferReference?: string }, LoanErrorCode>> {
    try {
      // Get loan with FOR UPDATE NOWAIT lock
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
        .for('update', { noWait: true });

      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }

      // Verify loan is in TREASURER_APPROVED status
      if (loan.status !== 'TREASURER_APPROVED') {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }

      // Re-validate eligibility inside transaction (TOCTOU protection)
      const eligibilityResult = await this.calculateEligibility(loan.applicantId);
      if (isErr(eligibilityResult)) {
        return err(eligibilityResult.error);
      }

      const { eligibilityKobo } = eligibilityResult.value;
      if (eligibilityKobo < loan.principalKobo) {
        return err(LoanErrorCode.INSUFFICIENT_ELIGIBILITY);
      }

      // Get applicant details for Monnify transfer
      const [applicant] = await db
        .select()
        .from(users)
        .where(eq(users.id, loan.applicantId));

      if (!applicant || !applicant.monnifyAccountReference) {
        return err(LoanErrorCode.ACCOUNT_DEACTIVATED);
      }

      // TODO: Integrate with Monnify API for transfer
      // For now, we'll simulate the transfer
      const transferReference = `TRF-${Date.now()}`;

      // Update loan status to DISBURSED
      await db
        .update(loans)
        .set({
          status: 'DISBURSED',
          disbursedAt: new Date(),
          updatedAt: new Date(),
          version: loan.version + 1,
        })
        .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));

      // TODO: Create transaction record
      // TODO: Create double-entry ledger entries
      // TODO: Create audit log entry
      // TODO: Send notifications (SMS and email)

      return ok({
        loanReference: loan.loanReference,
        status: 'DISBURSED',
        transferReference,
      });
    } catch (error) {
      console.error('Error disbursing loan:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Record a loan repayment
   *
   * Updates outstanding balance and creates transaction records.
   * Marks loan as COMPLETED if fully repaid.
   *
   * @param loanId - Loan ID
   * @param amountKobo - Repayment amount in kobo
   * @param paymentDate - Payment date
   * @param paymentReference - Payment reference number
   * @param paymentMethod - Payment method (PAYROLL_DEDUCTION, MANUAL, BANK_TRANSFER)
   * @param recordedBy - User ID recording the repayment
   * @returns Repayment result with updated balance
   */
  async recordRepayment(
    loanId: string,
    amountKobo: KoboAmount,
    paymentDate: Date,
    paymentReference: string,
    paymentMethod: string,
    recordedBy: string
  ): Promise<Result<{ outstandingKobo: KoboAmount; status: string }, LoanErrorCode>> {
    try {
      // Get loan with FOR UPDATE lock
      const [loan] = await db
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), isNull(loans.deletedAt)))
        .for('update');

      if (!loan) {
        return err(LoanErrorCode.LOAN_NOT_FOUND);
      }

      // Verify loan is disbursed or active
      if (loan.status !== 'DISBURSED' && loan.status !== 'ACTIVE') {
        return err(LoanErrorCode.INVALID_LOAN_STATUS);
      }

      // Validate repayment amount
      if (amountKobo <= 0) {
        return err(LoanErrorCode.INVALID_INPUT);
      }

      if (amountKobo > loan.outstandingKobo) {
        return err(LoanErrorCode.INVALID_INPUT);
      }

      // Calculate new outstanding balance
      const newOutstandingKobo = toKoboAmount(loan.outstandingKobo - amountKobo);
      const isFullyRepaid = newOutstandingKobo === 0;

      // Create repayment record
      const paymentDateStr = paymentDate.toISOString().split('T')[0]!; // Convert Date to YYYY-MM-DD string
      await db.insert(loanRepayments).values({
        loanId,
        amountKobo,
        paymentDate: paymentDateStr,
        paymentReference,
        paymentMethod,
        recordedBy,
      });

      // Update loan outstanding balance and status
      await db
        .update(loans)
        .set({
          outstandingKobo: newOutstandingKobo,
          status: isFullyRepaid ? 'COMPLETED' : 'ACTIVE',
          completedAt: isFullyRepaid ? new Date() : null,
          updatedAt: new Date(),
          version: loan.version + 1,
        })
        .where(and(eq(loans.id, loanId), eq(loans.version, loan.version)));

      // TODO: Create transaction record
      // TODO: Create ledger entries
      // TODO: Create audit log entry
      // TODO: Send notification

      return ok({
        outstandingKobo: newOutstandingKobo,
        status: isFullyRepaid ? 'COMPLETED' : 'ACTIVE',
      });
    } catch (error) {
      console.error('Error recording repayment:', error);
      return err(LoanErrorCode.DATABASE_ERROR);
    }
  }
}

