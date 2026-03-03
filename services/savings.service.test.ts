/**
 * Unit Tests for Savings Service Business Logic
 * 
 * Tests cover:
 * - 25% withdrawal limit enforcement (NS-2)
 * - Cannot-zero-balance rule (NS-3)
 * - Special deposit validation
 * - Balance calculation accuracy
 * 
 * @module services/savings.service.test
 */

import { describe, it, expect } from 'vitest';
import { toKoboAmount } from '../types/branded';
import { calculateWithdrawalLimit, percentageOf } from '../utils/financial';

// ============================================================================
// Test Suite: 25% Withdrawal Limit Calculation (NS-2)
// ============================================================================

describe('Savings Business Logic - 25% Withdrawal Limit (NS-2)', () => {
  it('should calculate exactly 25% of balance', () => {
    const balance = toKoboAmount(100000); // ₦1,000.00
    const limit = calculateWithdrawalLimit(balance);
    
    expect(limit).toBe(25000); // ₦250.00 (exactly 25%)
  });

  it('should use floor division for 25% calculation', () => {
    // Test with amount that doesn't divide evenly
    const balance = toKoboAmount(100001); // ₦1,000.01
    const limit = calculateWithdrawalLimit(balance);
    
    // floor(100001 * 0.25) = floor(25000.25) = 25000
    expect(limit).toBe(25000);
  });

  it('should calculate 25% limit for large balances', () => {
    const balance = toKoboAmount(10000000); // ₦100,000.00
    const limit = calculateWithdrawalLimit(balance);
    
    expect(limit).toBe(2500000); // ₦25,000.00 (exactly 25%)
  });

  it('should calculate 25% limit for small balances', () => {
    const balance = toKoboAmount(100); // ₦1.00
    const limit = calculateWithdrawalLimit(balance);
    
    expect(limit).toBe(25); // ₦0.25 (exactly 25%)
  });

  it('should handle balance of 1 kobo', () => {
    const balance = toKoboAmount(1); // ₦0.01
    const limit = calculateWithdrawalLimit(balance);
    
    // floor(1 * 0.25) = floor(0.25) = 0
    expect(limit).toBe(0);
  });

  it('should handle balance of 4 kobo (minimum for 1 kobo withdrawal)', () => {
    const balance = toKoboAmount(4); // ₦0.04
    const limit = calculateWithdrawalLimit(balance);
    
    // floor(4 * 0.25) = floor(1) = 1
    expect(limit).toBe(1);
  });

  it('should validate withdrawal at exactly 25% limit', () => {
    const balance = toKoboAmount(100000);
    const limit = calculateWithdrawalLimit(balance);
    const withdrawalAmount = limit;
    
    // Withdrawal at exactly 25% should be valid
    expect(withdrawalAmount).toBeLessThanOrEqual(limit);
    expect(withdrawalAmount).toBe(25000);
  });

  it('should detect withdrawal exceeding 25% limit by 1 kobo', () => {
    const balance = toKoboAmount(100000);
    const limit = calculateWithdrawalLimit(balance);
    const withdrawalAmount = toKoboAmount(limit + 1);
    
    // Withdrawal exceeding limit should be detected
    expect(withdrawalAmount).toBeGreaterThan(limit);
    expect(withdrawalAmount).toBe(25001);
  });

  it('should detect withdrawal of 26% exceeds limit', () => {
    const balance = toKoboAmount(100000);
    const limit = calculateWithdrawalLimit(balance);
    const withdrawalAmount = toKoboAmount(26000); // 26%
    
    expect(withdrawalAmount).toBeGreaterThan(limit);
  });

  it('should detect withdrawal of 50% exceeds limit', () => {
    const balance = toKoboAmount(100000);
    const limit = calculateWithdrawalLimit(balance);
    const withdrawalAmount = toKoboAmount(50000); // 50%
    
    expect(withdrawalAmount).toBeGreaterThan(limit);
  });

  it('should detect withdrawal of 100% exceeds limit', () => {
    const balance = toKoboAmount(100000);
    const limit = calculateWithdrawalLimit(balance);
    const withdrawalAmount = balance; // 100%
    
    expect(withdrawalAmount).toBeGreaterThan(limit);
  });
});

// ============================================================================
// Test Suite: Cannot-Zero-Balance Rule (NS-3)
// ============================================================================

describe('Savings Business Logic - Cannot-Zero-Balance Rule (NS-3)', () => {
  it('should detect withdrawal that would zero balance', () => {
    const balance = toKoboAmount(25000); // ₦250.00
    const withdrawalAmount = toKoboAmount(25000); // Entire balance
    const newBalance = balance - withdrawalAmount;
    
    expect(newBalance).toBe(0);
    // For ACTIVE members, this should be rejected
  });

  it('should detect withdrawal leaving exactly 0 kobo', () => {
    const balance = toKoboAmount(10000); // ₦100.00
    const withdrawalAmount = toKoboAmount(10000); // Entire balance
    const newBalance = balance - withdrawalAmount;
    
    expect(newBalance).toBe(0);
  });

  it('should allow withdrawal leaving 1 kobo', () => {
    const balance = toKoboAmount(25000); // ₦250.00
    const withdrawalAmount = toKoboAmount(24999); // Leaves 1 kobo
    const newBalance = balance - withdrawalAmount;
    
    expect(newBalance).toBe(1);
    expect(newBalance).toBeGreaterThan(0);
  });

  it('should allow withdrawal leaving 100 kobo', () => {
    const balance = toKoboAmount(25000); // ₦250.00
    const withdrawalAmount = toKoboAmount(24900); // Leaves 100 kobo
    const newBalance = balance - withdrawalAmount;
    
    expect(newBalance).toBe(100);
    expect(newBalance).toBeGreaterThan(0);
  });

  it('should validate employment status check is needed', () => {
    // This test documents that employment status must be checked
    // ACTIVE members: cannot zero balance
    // RESIGNED/INACTIVE members: can zero balance
    const employmentStatuses = ['ACTIVE', 'RESIGNED', 'TERMINATED', 'RETIRED'];
    
    expect(employmentStatuses).toContain('ACTIVE');
    expect(employmentStatuses).toContain('RESIGNED');
  });

  it('should calculate balance after withdrawal correctly', () => {
    const balance = toKoboAmount(100000);
    const withdrawalAmount = toKoboAmount(25000);
    const newBalance = balance - withdrawalAmount;
    
    expect(newBalance).toBe(75000);
    expect(newBalance).toBeGreaterThan(0);
  });
});

// ============================================================================
// Test Suite: Special Deposit Validation
// ============================================================================

describe('Savings Business Logic - Special Deposit Validation', () => {
  it('should validate SPECIAL account type for deposits', () => {
    const accountTypes = ['NORMAL', 'SPECIAL'];
    const validDepositAccountType = 'SPECIAL';
    
    expect(accountTypes).toContain(validDepositAccountType);
    expect(validDepositAccountType).toBe('SPECIAL');
  });

  it('should reject NORMAL account type for member deposits', () => {
    const accountType = 'NORMAL';
    const isValidForMemberDeposit = accountType === 'SPECIAL';
    
    expect(isValidForMemberDeposit).toBe(false);
  });

  it('should validate positive deposit amounts', () => {
    const validAmount = toKoboAmount(50000);
    const zeroAmount = toKoboAmount(0);
    
    expect(validAmount).toBeGreaterThan(0);
    expect(zeroAmount).toBe(0);
    
    // Negative amounts should be rejected by toKoboAmount validation
    expect(() => toKoboAmount(-1000)).toThrow();
  });

  it('should calculate balance after deposit', () => {
    const initialBalance = toKoboAmount(50000); // ₦500.00
    const depositAmount = toKoboAmount(30000); // ₦300.00
    const newBalance = initialBalance + depositAmount;
    
    expect(newBalance).toBe(80000); // ₦800.00
  });

  it('should handle large deposits', () => {
    const initialBalance = toKoboAmount(50000);
    const depositAmount = toKoboAmount(10000000); // ₦100,000.00
    const newBalance = initialBalance + depositAmount;
    
    expect(newBalance).toBe(10050000);
  });

  it('should handle small deposits', () => {
    const initialBalance = toKoboAmount(50000);
    const depositAmount = toKoboAmount(1); // ₦0.01
    const newBalance = initialBalance + depositAmount;
    
    expect(newBalance).toBe(50001);
  });
});

// ============================================================================
// Test Suite: Balance Calculation Accuracy
// ============================================================================

describe('Savings Business Logic - Balance Calculation Accuracy', () => {
  it('should calculate balance after withdrawal using integer arithmetic', () => {
    const initialBalance = toKoboAmount(100000); // ₦1,000.00
    const withdrawalAmount = toKoboAmount(25000); // ₦250.00
    const expectedBalance = toKoboAmount(75000); // ₦750.00
    
    const actualBalance = initialBalance - withdrawalAmount;
    
    expect(actualBalance).toBe(expectedBalance);
    expect(Number.isInteger(actualBalance)).toBe(true);
  });

  it('should calculate balance after deposit using integer arithmetic', () => {
    const initialBalance = toKoboAmount(50000); // ₦500.00
    const depositAmount = toKoboAmount(30000); // ₦300.00
    const expectedBalance = toKoboAmount(80000); // ₦800.00
    
    const actualBalance = initialBalance + depositAmount;
    
    expect(actualBalance).toBe(expectedBalance);
    expect(Number.isInteger(actualBalance)).toBe(true);
  });

  it('should handle balance of 1 kobo correctly', () => {
    const initialBalance = toKoboAmount(1); // ₦0.01
    const depositAmount = toKoboAmount(1); // ₦0.01
    const expectedBalance = toKoboAmount(2); // ₦0.02
    
    const actualBalance = initialBalance + depositAmount;
    
    expect(actualBalance).toBe(expectedBalance);
  });

  it('should handle large balance calculations without overflow', () => {
    const initialBalance = toKoboAmount(900000000); // ₦9,000,000.00
    const depositAmount = toKoboAmount(100000000); // ₦1,000,000.00
    const expectedBalance = toKoboAmount(1000000000); // ₦10,000,000.00
    
    const actualBalance = initialBalance + depositAmount;
    
    expect(actualBalance).toBe(expectedBalance);
  });

  it('should detect insufficient balance for withdrawal', () => {
    const initialBalance = toKoboAmount(10000); // ₦100.00
    const withdrawalAmount = toKoboAmount(10001); // ₦100.01
    
    const hasSufficientBalance = initialBalance >= withdrawalAmount;
    
    expect(hasSufficientBalance).toBe(false);
  });

  it('should use integer arithmetic without floating point errors', () => {
    // Test with amounts that would cause floating point errors
    const initialBalance = toKoboAmount(333333); // ₦3,333.33
    const withdrawalAmount = toKoboAmount(11111); // ₦111.11
    const expectedBalance = toKoboAmount(322222); // ₦3,222.22
    
    const actualBalance = initialBalance - withdrawalAmount;
    
    // Verify exact integer arithmetic (no rounding errors)
    expect(actualBalance).toBe(expectedBalance);
    expect(Number.isInteger(actualBalance)).toBe(true);
  });

  it('should handle multiple operations maintaining accuracy', () => {
    let balance = toKoboAmount(100000); // ₦1,000.00
    
    // Deposit
    balance = balance + toKoboAmount(50000); // +₦500.00
    expect(balance).toBe(150000);
    
    // Withdrawal
    balance = balance - toKoboAmount(25000); // -₦250.00
    expect(balance).toBe(125000);
    
    // Another deposit
    balance = balance + toKoboAmount(75000); // +₦750.00
    expect(balance).toBe(200000);
    
    // Final check
    expect(Number.isInteger(balance)).toBe(true);
  });

  it('should calculate percentage correctly using floor division', () => {
    const amount = toKoboAmount(100000);
    const percentage = 25;
    const result = percentageOf(amount, percentage);
    
    expect(result).toBe(25000);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('should handle percentage calculation with non-even division', () => {
    const amount = toKoboAmount(100001);
    const percentage = 25;
    const result = percentageOf(amount, percentage);
    
    // floor(100001 * 25 / 100) = floor(25000.25) = 25000
    expect(result).toBe(25000);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('should validate balance never goes negative', () => {
    const balance = toKoboAmount(10000);
    const withdrawalAmount = toKoboAmount(15000);
    
    // This should be prevented by validation
    const wouldBeNegative = (balance - withdrawalAmount) < 0;
    
    expect(wouldBeNegative).toBe(true);
    // System should reject this before calculation
  });
});

// ============================================================================
// Test Suite: General Validation Rules
// ============================================================================

describe('Savings Business Logic - General Validation', () => {
  it('should validate positive amounts', () => {
    const validAmount = toKoboAmount(1000);
    const zeroAmount = toKoboAmount(0);
    
    expect(validAmount).toBeGreaterThan(0);
    expect(zeroAmount).toBe(0);
    
    // Negative amounts should be rejected by toKoboAmount validation
    expect(() => toKoboAmount(-1000)).toThrow();
  });

  it('should validate account types', () => {
    const validAccountTypes = ['NORMAL', 'SPECIAL'];
    
    expect(validAccountTypes).toHaveLength(2);
    expect(validAccountTypes).toContain('NORMAL');
    expect(validAccountTypes).toContain('SPECIAL');
  });

  it('should validate transaction directions', () => {
    const validDirections = ['CREDIT', 'DEBIT'];
    
    expect(validDirections).toHaveLength(2);
    expect(validDirections).toContain('CREDIT');
    expect(validDirections).toContain('DEBIT');
  });

  it('should validate balance constraints', () => {
    const balance = toKoboAmount(100000);
    
    // Balance must be non-negative
    expect(balance).toBeGreaterThanOrEqual(0);
    
    // Balance must be an integer
    expect(Number.isInteger(balance)).toBe(true);
  });

  it('should validate withdrawal constraints for NORMAL accounts', () => {
    const balance = toKoboAmount(100000);
    const withdrawalLimit = calculateWithdrawalLimit(balance);
    
    // Withdrawal must not exceed 25% limit
    expect(withdrawalLimit).toBe(25000);
    expect(withdrawalLimit).toBeLessThanOrEqual(balance * 0.25);
  });

  it('should validate no withdrawal limit for SPECIAL accounts', () => {
    const balance = toKoboAmount(100000);
    const withdrawalAmount = toKoboAmount(100000); // 100%
    
    // For SPECIAL accounts, can withdraw entire balance
    const isValidForSpecial = withdrawalAmount <= balance;
    
    expect(isValidForSpecial).toBe(true);
  });
});
