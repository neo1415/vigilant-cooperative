/**
 * Financial Calculation Utilities
 * 
 * All monetary calculations use:
 * - INTEGER storage in kobo (1/100 Naira)
 * - Decimal.js for arbitrary-precision arithmetic
 * - ROUND_FLOOR rounding mode (never ROUND_HALF_UP)
 * 
 * CRITICAL RULES:
 * - Never use JavaScript Number for monetary arithmetic
 * - Never use parseFloat(), Math.round(), or toFixed() on money
 * - Always convert to kobo before calculations
 * - Always use Decimal.js with ROUND_FLOOR
 * 
 * @module utils/financial
 */

import Decimal from 'decimal.js';
import { KoboAmount, toKoboAmount } from '../types/branded';

// Configure Decimal.js globally with ROUND_FLOOR
Decimal.set({ rounding: Decimal.ROUND_FLOOR });

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum kobo value (PostgreSQL BIGINT limit)
 */
export const MAX_KOBO = 9_223_372_036_854_775_807;

/**
 * Minimum kobo value
 */
export const MIN_KOBO = 0;

/**
 * Kobo per Naira
 */
export const KOBO_PER_NAIRA = 100;

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert Naira to Kobo
 * 
 * @param naira - Amount in Naira (can be decimal)
 * @returns Amount in kobo (integer)
 * 
 * @example
 * ```ts
 * nairaToKobo(10.50) // 1050
 * nairaToKobo(100) // 10000
 * ```
 */
export function nairaToKobo(naira: number | string): KoboAmount {
  const decimal = new Decimal(naira);
  const kobo = decimal.times(KOBO_PER_NAIRA).floor();
  
  if (kobo.isNegative()) {
    throw new Error(`Negative amounts not allowed: ${naira} Naira`);
  }
  
  if (kobo.greaterThan(MAX_KOBO)) {
    throw new Error(`Amount exceeds maximum: ${naira} Naira`);
  }
  
  return toKoboAmount(kobo.toNumber());
}

/**
 * Convert Kobo to Naira
 * 
 * @param kobo - Amount in kobo (integer)
 * @returns Amount in Naira (decimal)
 * 
 * @example
 * ```ts
 * koboToNaira(1050) // 10.50
 * koboToNaira(10000) // 100.00
 * ```
 */
export function koboToNaira(kobo: KoboAmount): string {
  const decimal = new Decimal(kobo);
  const naira = decimal.dividedBy(KOBO_PER_NAIRA);
  return naira.toFixed(2);
}

/**
 * Format kobo amount as Naira with currency symbol
 * 
 * @param kobo - Amount in kobo
 * @param options - Formatting options
 * @returns Formatted string (e.g., "₦10,500.00")
 * 
 * @example
 * ```ts
 * formatNaira(1050000) // "₦10,500.00"
 * formatNaira(1050000, { showSymbol: false }) // "10,500.00"
 * ```
 */
export function formatNaira(
  kobo: KoboAmount,
  options: {
    showSymbol?: boolean;
    showDecimals?: boolean;
  } = {}
): string {
  const { showSymbol = true, showDecimals = true } = options;
  
  const naira = koboToNaira(kobo);
  const [whole, decimal = '00'] = naira.split('.');
  
  // Add thousand separators
  const formatted = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  const amount = showDecimals ? `${formatted}.${decimal}` : formatted;
  
  return showSymbol ? `₦${amount}` : amount;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that a value is a valid kobo amount
 * 
 * @param value - Value to validate
 * @returns true if valid, false otherwise
 */
export function isValidKoboAmount(value: unknown): value is KoboAmount {
  if (typeof value !== 'number') return false;
  if (!Number.isInteger(value)) return false;
  if (value < MIN_KOBO) return false;
  if (value > MAX_KOBO) return false;
  return true;
}

/**
 * Validate that an amount is within a limit
 * 
 * @param amount - Amount to check
 * @param limit - Maximum allowed amount
 * @returns true if within limit, false otherwise
 */
export function isWithinLimit(amount: KoboAmount, limit: KoboAmount): boolean {
  return amount <= limit;
}

// ============================================================================
// Loan Calculations
// ============================================================================

/**
 * Calculate loan interest using flat rate
 * 
 * @param principalKobo - Loan principal in kobo
 * @param interestRateBps - Interest rate in basis points (e.g., 500 = 5%)
 * @returns Interest amount in kobo
 * 
 * @example
 * ```ts
 * calculateLoanInterest(500000, 500) // 25000 (5% of 500000)
 * ```
 */
export function calculateLoanInterest(
  principalKobo: KoboAmount,
  interestRateBps: number
): KoboAmount {
  const principal = new Decimal(principalKobo);
  const rateFraction = new Decimal(interestRateBps).dividedBy(10000);
  const interest = principal.times(rateFraction).floor();
  
  return toKoboAmount(interest.toNumber());
}

/**
 * Calculate monthly installment for a loan
 * 
 * @param totalRepayableKobo - Total amount to repay (principal + interest)
 * @param months - Number of months
 * @returns Object with monthly installment and final installment
 * 
 * @example
 * ```ts
 * calculateMonthlyInstallment(525000, 6)
 * // { monthlyInstallment: 87500, finalInstallment: 87500 }
 * 
 * calculateMonthlyInstallment(525001, 6)
 * // { monthlyInstallment: 87500, finalInstallment: 87501 }
 * // Final installment absorbs the remainder
 * ```
 */
export function calculateMonthlyInstallment(
  totalRepayableKobo: KoboAmount,
  months: number
): {
  monthlyInstallment: KoboAmount;
  finalInstallment: KoboAmount;
} {
  if (months <= 0) {
    throw new Error('Number of months must be positive');
  }
  
  const total = new Decimal(totalRepayableKobo);
  const monthlyInstallment = total.dividedBy(months).floor();
  
  // Calculate remainder and add to final installment
  const regularPayments = monthlyInstallment.times(months - 1);
  const finalInstallment = total.minus(regularPayments);
  
  return {
    monthlyInstallment: toKoboAmount(monthlyInstallment.toNumber()),
    finalInstallment: toKoboAmount(finalInstallment.toNumber()),
  };
}

/**
 * Calculate complete loan terms
 * 
 * @param principalKobo - Loan principal in kobo
 * @param interestRateBps - Interest rate in basis points
 * @param months - Number of months
 * @returns Complete loan calculation
 * 
 * @example
 * ```ts
 * calculateLoanTerms(500000, 500, 6)
 * // {
 * //   principalKobo: 500000,
 * //   interestKobo: 25000,
 * //   totalRepayableKobo: 525000,
 * //   monthlyInstallment: 87500,
 * //   finalInstallment: 87500
 * // }
 * ```
 */
export function calculateLoanTerms(
  principalKobo: KoboAmount,
  interestRateBps: number,
  months: number
): {
  principalKobo: KoboAmount;
  interestKobo: KoboAmount;
  totalRepayableKobo: KoboAmount;
  monthlyInstallment: KoboAmount;
  finalInstallment: KoboAmount;
} {
  const interestKobo = calculateLoanInterest(principalKobo, interestRateBps);
  const totalRepayableKobo = toKoboAmount(principalKobo + interestKobo);
  const { monthlyInstallment, finalInstallment } = calculateMonthlyInstallment(
    totalRepayableKobo,
    months
  );
  
  return {
    principalKobo,
    interestKobo,
    totalRepayableKobo,
    monthlyInstallment,
    finalInstallment,
  };
}

// ============================================================================
// Eligibility Calculations
// ============================================================================

/**
 * Calculate maximum loan eligibility based on savings
 * 
 * @param normalSavingsKobo - Normal savings balance in kobo
 * @param loanToSavingsRatio - Loan-to-savings ratio (e.g., 3.0 means 3x savings)
 * @param outstandingLoansKobo - Current outstanding loan balance
 * @returns Maximum eligible loan amount in kobo
 * 
 * @example
 * ```ts
 * calculateLoanEligibility(250000, 3.0, 0) // 750000
 * calculateLoanEligibility(250000, 3.0, 100000) // 650000
 * ```
 */
export function calculateLoanEligibility(
  normalSavingsKobo: KoboAmount,
  loanToSavingsRatio: number,
  outstandingLoansKobo: KoboAmount
): KoboAmount {
  const savings = new Decimal(normalSavingsKobo);
  const ratio = new Decimal(loanToSavingsRatio);
  const outstanding = new Decimal(outstandingLoansKobo);
  
  const maxLoan = savings.times(ratio).floor();
  const available = Decimal.max(0, maxLoan.minus(outstanding));
  
  return toKoboAmount(available.toNumber());
}

/**
 * Calculate withdrawal limit (25% of balance)
 * 
 * @param balanceKobo - Current balance in kobo
 * @returns Maximum withdrawal amount in kobo
 * 
 * @example
 * ```ts
 * calculateWithdrawalLimit(100000) // 25000
 * calculateWithdrawalLimit(100001) // 25000 (floored)
 * ```
 */
export function calculateWithdrawalLimit(balanceKobo: KoboAmount): KoboAmount {
  const balance = new Decimal(balanceKobo);
  const limit = balance.times(0.25).floor();
  
  return toKoboAmount(limit.toNumber());
}

/**
 * Calculate guarantor exposure (total guaranteed amount)
 * 
 * @param guaranteedLoans - Array of loan amounts guaranteed
 * @returns Total exposure in kobo
 * 
 * @example
 * ```ts
 * calculateGuarantorExposure([500000, 300000, 200000]) // 1000000
 * ```
 */
export function calculateGuarantorExposure(guaranteedLoans: KoboAmount[]): KoboAmount {
  const total = guaranteedLoans.reduce((sum, loan) => {
    return sum.plus(loan);
  }, new Decimal(0));
  
  return toKoboAmount(total.toNumber());
}

// ============================================================================
// Arithmetic Operations
// ============================================================================

/**
 * Add two kobo amounts
 * 
 * @param a - First amount
 * @param b - Second amount
 * @returns Sum in kobo
 */
export function addKobo(a: KoboAmount, b: KoboAmount): KoboAmount {
  const sum = new Decimal(a).plus(b);
  
  if (sum.greaterThan(MAX_KOBO)) {
    throw new Error('Sum exceeds maximum kobo value');
  }
  
  return toKoboAmount(sum.toNumber());
}

/**
 * Subtract two kobo amounts
 * 
 * @param a - First amount
 * @param b - Second amount (subtracted from first)
 * @returns Difference in kobo
 */
export function subtractKobo(a: KoboAmount, b: KoboAmount): KoboAmount {
  const diff = new Decimal(a).minus(b);
  
  if (diff.isNegative()) {
    throw new Error('Result would be negative');
  }
  
  return toKoboAmount(diff.toNumber());
}

/**
 * Multiply kobo amount by a factor
 * 
 * @param amount - Amount in kobo
 * @param factor - Multiplication factor
 * @returns Product in kobo (floored)
 */
export function multiplyKobo(amount: KoboAmount, factor: number): KoboAmount {
  const product = new Decimal(amount).times(factor).floor();
  
  if (product.greaterThan(MAX_KOBO)) {
    throw new Error('Product exceeds maximum kobo value');
  }
  
  return toKoboAmount(product.toNumber());
}

/**
 * Divide kobo amount by a divisor
 * 
 * @param amount - Amount in kobo
 * @param divisor - Division divisor
 * @returns Quotient in kobo (floored)
 */
export function divideKobo(amount: KoboAmount, divisor: number): KoboAmount {
  if (divisor === 0) {
    throw new Error('Division by zero');
  }
  
  const quotient = new Decimal(amount).dividedBy(divisor).floor();
  
  return toKoboAmount(quotient.toNumber());
}

/**
 * Calculate percentage of an amount
 * 
 * @param amount - Amount in kobo
 * @param percentage - Percentage (e.g., 25 for 25%)
 * @returns Percentage of amount in kobo (floored)
 */
export function percentageOf(amount: KoboAmount, percentage: number): KoboAmount {
  const result = new Decimal(amount).times(percentage).dividedBy(100).floor();
  
  return toKoboAmount(result.toNumber());
}
