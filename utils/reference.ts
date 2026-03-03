/**
 * Reference Generation Utilities
 * 
 * Generates unique reference numbers for various entities:
 * - Member IDs: VIG-YYYY-NNN
 * - Loan References: LN-YYYY-NNNNN
 * - Transaction References: TXN-YYYY-NNNNNNNN
 * - Voucher Numbers: VCH-YYYY-NNNNN
 * - Exit References: EXIT-YYYY-NNN
 * - Payroll References: PAY-YYYY-MM
 * 
 * @module utils/reference
 */

import { randomBytes } from 'crypto';

/**
 * Generate a unique reference number
 * 
 * @param prefix - Reference prefix (VIG, LN, TXN, VCH, EXIT, PAY)
 * @param length - Number of digits in the sequential part (default: 5)
 * @returns Formatted reference string
 * 
 * @example
 * ```ts
 * await generateReference('LN') // "LN-2026-00001"
 * await generateReference('TXN', 8) // "TXN-2026-00000001"
 * ```
 */
export async function generateReference(
  prefix: 'VIG' | 'LN' | 'TXN' | 'VCH' | 'EXIT' | 'PAY',
  length: number = 5
): Promise<string> {
  const year = new Date().getFullYear();
  
  // Generate random number for uniqueness
  // In production, this should use a database sequence
  const randomNum = randomBytes(4).readUInt32BE(0);
  const sequential = String(randomNum % Math.pow(10, length)).padStart(length, '0');
  
  return `${prefix}-${year}-${sequential}`;
}

/**
 * Generate a transaction reference
 * 
 * @returns Transaction reference (TXN-YYYY-NNNNNNNN)
 */
export async function generateTransactionReference(): Promise<string> {
  return generateReference('TXN', 8);
}

/**
 * Generate a loan reference
 * 
 * @returns Loan reference (LN-YYYY-NNNNN)
 */
export async function generateLoanReference(): Promise<string> {
  return generateReference('LN', 5);
}

/**
 * Generate a voucher number
 * 
 * @returns Voucher number (VCH-YYYY-NNNNN)
 */
export async function generateVoucherNumber(): Promise<string> {
  return generateReference('VCH', 5);
}

/**
 * Generate a member ID
 * 
 * @returns Member ID (VIG-YYYY-NNN)
 */
export async function generateMemberId(): Promise<string> {
  return generateReference('VIG', 3);
}

/**
 * Generate an exit reference
 * 
 * @returns Exit reference (EXIT-YYYY-NNN)
 */
export async function generateExitReference(): Promise<string> {
  return generateReference('EXIT', 3);
}

/**
 * Generate a payroll reference
 * 
 * @param month - Month number (1-12)
 * @param year - Year (YYYY)
 * @returns Payroll reference (PAY-YYYY-MM)
 */
export function generatePayrollReference(month: number, year: number): string {
  const monthStr = String(month).padStart(2, '0');
  return `PAY-${year}-${monthStr}`;
}

/**
 * Validate reference format
 * 
 * @param reference - Reference string to validate
 * @param prefix - Expected prefix
 * @returns true if valid, false otherwise
 */
export function validateReference(reference: string, prefix: string): boolean {
  const pattern = new RegExp(`^${prefix}-\\d{4}-\\d+$`);
  return pattern.test(reference);
}

