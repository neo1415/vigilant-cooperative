/**
 * Validation Schemas and Utilities
 * 
 * Zod schemas for request validation and custom validators for domain-specific types.
 * All API endpoints should validate input using these schemas.
 * 
 * @module utils/validation
 */

import { z } from 'zod';
import {
  isMemberId,
  isLoanReference,
  isVoucherNumber,
  isExitReference,
  isPayrollReference,
  isKoboAmount,
} from '../types/branded';

// ============================================================================
// Custom Validators
// ============================================================================

/**
 * Validate Nigerian phone number
 * Format: +234XXXXXXXXXX (13 characters)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const regex = /^\+234[0-9]{10}$/;
  return regex.test(phone);
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

/**
 * Validate date is not in the future
 */
export function isNotFutureDate(date: Date): boolean {
  return date <= new Date();
}

/**
 * Validate date is within range
 */
export function isDateInRange(date: Date, minDate: Date, maxDate: Date): boolean {
  return date >= minDate && date <= maxDate;
}

// ============================================================================
// Reusable Schema Fragments
// ============================================================================

/**
 * Kobo amount schema (non-negative integer)
 */
export const koboAmountSchema = z
  .number()
  .int('Amount must be an integer')
  .nonnegative('Amount must be non-negative')
  .refine(isKoboAmount, 'Amount exceeds maximum allowed value');

/**
 * Member ID schema (VIG-YYYY-NNN)
 */
export const memberIdSchema = z
  .string()
  .refine(isMemberId, 'Invalid Member ID format. Expected: VIG-YYYY-NNN');

/**
 * Loan Reference schema (LN-YYYY-NNNNN)
 */
export const loanReferenceSchema = z
  .string()
  .refine(isLoanReference, 'Invalid Loan Reference format. Expected: LN-YYYY-NNNNN');

/**
 * Voucher Number schema (VCH-YYYY-NNNNNN)
 */
export const voucherNumberSchema = z
  .string()
  .refine(isVoucherNumber, 'Invalid Voucher Number format. Expected: VCH-YYYY-NNNNNN');

/**
 * Exit Reference schema (EXIT-YYYY-NNN)
 */
export const exitReferenceSchema = z
  .string()
  .refine(isExitReference, 'Invalid Exit Reference format. Expected: EXIT-YYYY-NNN');

/**
 * Payroll Reference schema (PAY-YYYY-MM)
 */
export const payrollReferenceSchema = z
  .string()
  .refine(isPayrollReference, 'Invalid Payroll Reference format. Expected: PAY-YYYY-MM');

/**
 * Phone number schema (+234XXXXXXXXXX)
 */
export const phoneSchema = z
  .string()
  .refine(isValidPhoneNumber, 'Invalid phone number. Expected format: +234XXXXXXXXXX');

/**
 * Email schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Password schema (with strength requirements)
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine(isValidPassword, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  });

/**
 * UUID schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.startDate <= data.endDate,
  'Start date must be before or equal to end date'
);

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// Authentication Schemas
// ============================================================================

/**
 * Registration schema
 */
export const registrationSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  employeeId: z.string().min(1, 'Employee ID is required').max(50),
  phone: phoneSchema,
  email: emailSchema.optional(),
  department: z.string().min(1, 'Department is required').max(100),
  dateJoined: z.coerce.date().refine(isNotFutureDate, 'Date joined cannot be in the future'),
  password: passwordSchema,
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Member ID or phone is required'), // Can be member_id or phone
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
});

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Member ID or phone is required'),
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
  identifier: z.string().min(1, 'Member ID or phone is required'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: passwordSchema,
});

/**
 * MFA enrollment verification schema
 */
export const mfaVerifySchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

// ============================================================================
// Savings Schemas
// ============================================================================

/**
 * Withdrawal schema
 */
export const withdrawalSchema = z.object({
  accountId: uuidSchema,
  amountKobo: koboAmountSchema,
  description: z.string().min(1).max(500).optional(),
});

/**
 * Deposit schema
 */
export const depositSchema = z.object({
  accountId: uuidSchema,
  amountKobo: koboAmountSchema,
  description: z.string().min(1).max(500).optional(),
});

/**
 * Manual credit schema (treasurer only)
 */
export const manualCreditSchema = z.object({
  userId: uuidSchema,
  accountType: z.enum(['NORMAL', 'SPECIAL']),
  amountKobo: koboAmountSchema,
  description: z.string().min(1).max(500),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
});

// ============================================================================
// Loan Schemas
// ============================================================================

/**
 * Loan application schema
 */
export const loanApplicationSchema = z.object({
  loanType: z.enum(['SHORT_TERM', 'LONG_TERM']),
  principalKobo: koboAmountSchema,
  repaymentMonths: z.number().int().min(1).max(12),
  purpose: z.enum([
    'EDUCATION',
    'MEDICAL',
    'HOUSING',
    'BUSINESS',
    'EMERGENCY',
    'PERSONAL',
    'OTHER',
  ]),
  purposeDetail: z.string().min(10, 'Purpose detail must be at least 10 characters').max(500),
  guarantorIds: z.array(uuidSchema).min(2, 'At least 2 guarantors required').max(4),
});

/**
 * Guarantor consent schema
 */
export const guarantorConsentSchema = z.object({
  loanId: uuidSchema,
  guarantorId: uuidSchema,
  consent: z.boolean(),
  declineReason: z.string().min(10).max(500).optional(),
});

/**
 * Loan approval schema
 */
export const loanApprovalSchema = z.object({
  loanId: uuidSchema,
  action: z.enum(['APPROVE', 'REJECT', 'AMOUNT_OVERRIDE']),
  comments: z.string().max(1000).optional(),
  newAmountKobo: koboAmountSchema.optional(),
  rejectionReason: z.string().min(20, 'Rejection reason must be at least 20 characters').max(1000).optional(),
}).refine(
  (data) => {
    if (data.action === 'REJECT') {
      return !!data.rejectionReason;
    }
    return true;
  },
  {
    message: 'Rejection reason is required when rejecting',
    path: ['rejectionReason'],
  }
).refine(
  (data) => {
    if (data.action === 'AMOUNT_OVERRIDE') {
      return !!data.newAmountKobo;
    }
    return true;
  },
  {
    message: 'New amount is required for amount override',
    path: ['newAmountKobo'],
  }
);

/**
 * Loan disbursement schema
 */
export const loanDisbursementSchema = z.object({
  loanId: uuidSchema,
});

/**
 * Loan repayment schema
 */
export const loanRepaymentSchema = z.object({
  loanId: uuidSchema,
  amountKobo: koboAmountSchema,
  paymentDate: z.coerce.date().refine(isNotFutureDate, 'Payment date cannot be in the future'),
  paymentReference: z.string().min(1).max(50),
  paymentMethod: z.enum(['PAYROLL_DEDUCTION', 'MANUAL', 'BANK_TRANSFER']),
});

// ============================================================================
// Member Schemas
// ============================================================================

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  department: z.string().min(1).max(100).optional(),
});

/**
 * Approve member schema
 */
export const approveMemberSchema = z.object({
  userId: uuidSchema,
  approved: z.boolean(),
  rejectionReason: z.string().min(10).max(500).optional(),
}).refine(
  (data) => {
    if (!data.approved) {
      return !!data.rejectionReason;
    }
    return true;
  },
  {
    message: 'Rejection reason is required when rejecting',
    path: ['rejectionReason'],
  }
);

// ============================================================================
// Payroll Schemas
// ============================================================================

/**
 * Payroll import schema
 */
export const payrollImportSchema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2020).max(2100),
  fileUrl: z.string().url(),
});

/**
 * Payroll confirmation schema
 */
export const payrollConfirmationSchema = z.object({
  importId: uuidSchema,
});

/**
 * Payroll deduction row schema (for CSV parsing)
 */
export const payrollDeductionRowSchema = z.object({
  memberId: memberIdSchema,
  normalSavingsKobo: koboAmountSchema,
  specialSavingsKobo: koboAmountSchema.optional(),
  loanRepaymentKobo: koboAmountSchema.optional(),
  loanReference: loanReferenceSchema.optional(),
  otherDeductionsKobo: koboAmountSchema.optional(),
  otherDescription: z.string().max(255).optional(),
});

// ============================================================================
// Report Schemas
// ============================================================================

/**
 * Financial statement schema
 */
export const financialStatementSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reportType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'TRIAL_BALANCE']),
}).refine(
  (data) => data.startDate <= data.endDate,
  'Start date must be before or equal to end date'
);

/**
 * Member statement schema
 */
export const memberStatementSchema = z.object({
  userId: uuidSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.startDate <= data.endDate,
  'Start date must be before or equal to end date'
);

// ============================================================================
// Config Schemas
// ============================================================================

/**
 * Update config schema
 */
export const updateConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(), // Can be any JSON value
  description: z.string().max(500).optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate data against schema and return formatted errors
 * 
 * @param schema - Zod schema
 * @param data - Data to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * const result = validateSchema(loginSchema, req.body);
 * if (!result.success) {
 *   return errorResponse(
 *     ErrorCode.VALIDATION_ERROR,
 *     'Validation failed',
 *     req.id,
 *     result.errors
 *   );
 * }
 * ```
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string[]> = {};
  for (const error of result.error.issues) {
    const field = error.path.join('.');
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(error.message);
  }
  
  return { success: false, errors };
}

/**
 * Create a Fastify schema from Zod schema
 * 
 * @param zodSchema - Zod schema
 * @returns Fastify schema object
 */
export function zodToFastifySchema(zodSchema: z.ZodSchema): Record<string, unknown> {
  // This is a simplified version - in production, use @fastify/type-provider-zod
  return {
    body: zodSchema,
  };
}
