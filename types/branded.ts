/**
 * Branded Types for Domain Concepts
 * 
 * Branded types provide compile-time type safety for domain identifiers,
 * preventing accidental mixing of different ID types (e.g., UserId vs LoanId).
 * 
 * @module types/branded
 */

/**
 * Brand symbol used to create nominal types
 */
declare const brand: unique symbol;

/**
 * Generic branded type utility
 */
export type Branded<T, B> = T & { readonly [brand]: B };

/**
 * User ID - UUID representing a user/member
 */
export type UserId = Branded<string, 'UserId'>;

/**
 * Member ID - Format: VIG-YYYY-NNN (e.g., VIG-2026-001)
 */
export type MemberId = Branded<string, 'MemberId'>;

/**
 * Loan ID - UUID representing a loan
 */
export type LoanId = Branded<string, 'LoanId'>;

/**
 * Loan Reference - Format: LN-YYYY-NNNNN (e.g., LN-2026-00001)
 */
export type LoanReference = Branded<string, 'LoanReference'>;

/**
 * Account ID - UUID representing a savings account
 */
export type AccountId = Branded<string, 'AccountId'>;

/**
 * Transaction ID - UUID representing a transaction
 */
export type TransactionId = Branded<string, 'TransactionId'>;

/**
 * Voucher ID - UUID representing a voucher
 */
export type VoucherId = Branded<string, 'VoucherId'>;

/**
 * Voucher Number - Format: VCH-YYYY-NNNNNN (e.g., VCH-2026-000001)
 */
export type VoucherNumber = Branded<string, 'VoucherNumber'>;

/**
 * Exit Reference - Format: EXIT-YYYY-NNN (e.g., EXIT-2026-001)
 */
export type ExitReference = Branded<string, 'ExitReference'>;

/**
 * Payroll Import Reference - Format: PAY-YYYY-MM (e.g., PAY-2026-03)
 */
export type PayrollReference = Branded<string, 'PayrollReference'>;

/**
 * Kobo Amount - Integer representing monetary value in kobo (1/100 Naira)
 */
export type KoboAmount = Branded<number, 'KoboAmount'>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Member ID validation regex (VIG-YYYY-NNN)
 */
const MEMBER_ID_REGEX = /^VIG-\d{4}-\d{3}$/;

/**
 * Loan Reference validation regex (LN-YYYY-NNNNN)
 */
const LOAN_REFERENCE_REGEX = /^LN-\d{4}-\d{5}$/;

/**
 * Voucher Number validation regex (VCH-YYYY-NNNNNN)
 */
const VOUCHER_NUMBER_REGEX = /^VCH-\d{4}-\d{6}$/;

/**
 * Exit Reference validation regex (EXIT-YYYY-NNN)
 */
const EXIT_REFERENCE_REGEX = /^EXIT-\d{4}-\d{3}$/;

/**
 * Payroll Reference validation regex (PAY-YYYY-MM)
 */
const PAYROLL_REFERENCE_REGEX = /^PAY-\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Type guard for UserId
 */
export function isUserId(value: unknown): value is UserId {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Type guard for MemberId
 */
export function isMemberId(value: unknown): value is MemberId {
  return typeof value === 'string' && MEMBER_ID_REGEX.test(value);
}

/**
 * Type guard for LoanId
 */
export function isLoanId(value: unknown): value is LoanId {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Type guard for LoanReference
 */
export function isLoanReference(value: unknown): value is LoanReference {
  return typeof value === 'string' && LOAN_REFERENCE_REGEX.test(value);
}

/**
 * Type guard for AccountId
 */
export function isAccountId(value: unknown): value is AccountId {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Type guard for TransactionId
 */
export function isTransactionId(value: unknown): value is TransactionId {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Type guard for VoucherId
 */
export function isVoucherId(value: unknown): value is VoucherId {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Type guard for VoucherNumber
 */
export function isVoucherNumber(value: unknown): value is VoucherNumber {
  return typeof value === 'string' && VOUCHER_NUMBER_REGEX.test(value);
}

/**
 * Type guard for ExitReference
 */
export function isExitReference(value: unknown): value is ExitReference {
  return typeof value === 'string' && EXIT_REFERENCE_REGEX.test(value);
}

/**
 * Type guard for PayrollReference
 */
export function isPayrollReference(value: unknown): value is PayrollReference {
  return typeof value === 'string' && PAYROLL_REFERENCE_REGEX.test(value);
}

/**
 * Type guard for KoboAmount
 */
export function isKoboAmount(value: unknown): value is KoboAmount {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert string to UserId (with validation)
 */
export function toUserId(value: string): UserId {
  if (!isUserId(value)) {
    throw new Error(`Invalid UserId: ${value}`);
  }
  return value;
}

/**
 * Convert string to MemberId (with validation)
 */
export function toMemberId(value: string): MemberId {
  if (!isMemberId(value)) {
    throw new Error(`Invalid MemberId: ${value}. Expected format: VIG-YYYY-NNN`);
  }
  return value;
}

/**
 * Convert string to LoanId (with validation)
 */
export function toLoanId(value: string): LoanId {
  if (!isLoanId(value)) {
    throw new Error(`Invalid LoanId: ${value}`);
  }
  return value;
}

/**
 * Convert string to LoanReference (with validation)
 */
export function toLoanReference(value: string): LoanReference {
  if (!isLoanReference(value)) {
    throw new Error(`Invalid LoanReference: ${value}. Expected format: LN-YYYY-NNNNN`);
  }
  return value;
}

/**
 * Convert string to AccountId (with validation)
 */
export function toAccountId(value: string): AccountId {
  if (!isAccountId(value)) {
    throw new Error(`Invalid AccountId: ${value}`);
  }
  return value;
}

/**
 * Convert string to TransactionId (with validation)
 */
export function toTransactionId(value: string): TransactionId {
  if (!isTransactionId(value)) {
    throw new Error(`Invalid TransactionId: ${value}`);
  }
  return value;
}

/**
 * Convert string to VoucherId (with validation)
 */
export function toVoucherId(value: string): VoucherId {
  if (!isVoucherId(value)) {
    throw new Error(`Invalid VoucherId: ${value}`);
  }
  return value;
}

/**
 * Convert string to VoucherNumber (with validation)
 */
export function toVoucherNumber(value: string): VoucherNumber {
  if (!isVoucherNumber(value)) {
    throw new Error(`Invalid VoucherNumber: ${value}. Expected format: VCH-YYYY-NNNNNN`);
  }
  return value;
}

/**
 * Convert string to ExitReference (with validation)
 */
export function toExitReference(value: string): ExitReference {
  if (!isExitReference(value)) {
    throw new Error(`Invalid ExitReference: ${value}. Expected format: EXIT-YYYY-NNN`);
  }
  return value;
}

/**
 * Convert string to PayrollReference (with validation)
 */
export function toPayrollReference(value: string): PayrollReference {
  if (!isPayrollReference(value)) {
    throw new Error(`Invalid PayrollReference: ${value}. Expected format: PAY-YYYY-MM`);
  }
  return value;
}

/**
 * Convert number to KoboAmount (with validation)
 */
export function toKoboAmount(value: number): KoboAmount {
  if (!isKoboAmount(value)) {
    throw new Error(
      `Invalid KoboAmount: ${value}. Must be a non-negative integer within safe range.`
    );
  }
  return value;
}

// ============================================================================
// Reference Generators
// ============================================================================

/**
 * Generate Member ID in format VIG-YYYY-NNN
 * @param year - Year (e.g., 2026)
 * @param sequence - Sequence number (e.g., 1, 2, 3...)
 * @returns MemberId in format VIG-2026-001
 */
export function generateMemberId(year: number, sequence: number): MemberId {
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `VIG-${year}-${paddedSequence}` as MemberId;
}

/**
 * Generate Loan Reference in format LN-YYYY-NNNNN
 * @param year - Year (e.g., 2026)
 * @param sequence - Sequence number (e.g., 1, 2, 3...)
 * @returns LoanReference in format LN-2026-00001
 */
export function generateLoanReference(year: number, sequence: number): LoanReference {
  const paddedSequence = sequence.toString().padStart(5, '0');
  return `LN-${year}-${paddedSequence}` as LoanReference;
}

/**
 * Generate Voucher Number in format VCH-YYYY-NNNNNN
 * @param year - Year (e.g., 2026)
 * @param sequence - Sequence number (e.g., 1, 2, 3...)
 * @returns VoucherNumber in format VCH-2026-000001
 */
export function generateVoucherNumber(year: number, sequence: number): VoucherNumber {
  const paddedSequence = sequence.toString().padStart(6, '0');
  return `VCH-${year}-${paddedSequence}` as VoucherNumber;
}

/**
 * Generate Exit Reference in format EXIT-YYYY-NNN
 * @param year - Year (e.g., 2026)
 * @param sequence - Sequence number (e.g., 1, 2, 3...)
 * @returns ExitReference in format EXIT-2026-001
 */
export function generateExitReference(year: number, sequence: number): ExitReference {
  const paddedSequence = sequence.toString().padStart(3, '0');
  return `EXIT-${year}-${paddedSequence}` as ExitReference;
}

/**
 * Generate Payroll Reference in format PAY-YYYY-MM
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @returns PayrollReference in format PAY-2026-03
 */
export function generatePayrollReference(year: number, month: number): PayrollReference {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 1 and 12.`);
  }
  const paddedMonth = month.toString().padStart(2, '0');
  return `PAY-${year}-${paddedMonth}` as PayrollReference;
}
