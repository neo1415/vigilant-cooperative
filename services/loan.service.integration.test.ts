/**
 * Loan Service Integration Tests
 * 
 * Tests loan disbursement and repayment with real database transactions.
 * Focuses on concurrency protection, TOCTOU prevention, and transaction rollback.
 * 
 * @module services/loan.service.integration.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../server/db/init';
import { users, savingsAccounts, loans, loanGuarantors } from '../server/db/schema';
import { LoanService } from './loan.service';
import { toKoboAmount } from '../types/branded';
import { eq, and } from 'drizzle-orm';

describe('LoanService Integration Tests', () => {
  let loanService: LoanService;
  let testUserId: string;
  let testLoanId: string;
  let guarantorIds: string[];

  beforeAll(async () => {
    loanService = new LoanService();
  });

  beforeEach(async () => {
    // Clean up test data (skip for now - will be handled by test database reset)
    // await db.delete(loanGuarantors);
    // await db.delete(loans);
    // await db.delete(savingsAccounts);
    // await db.delete(users);

    // Create test user with savings
    const userResult = await db.insert(users).values({
      memberId: 'VIG-2026-TEST',
      employeeIdEncrypted: 'encrypted_emp_id',
      phoneEncrypted: 'encrypted_phone',
      employeeIdHash: 'emp_hash_' + Date.now(),
      phoneHash: 'phone_hash_' + Date.now(),
      fullName: 'Test User',
      email: 'test@example.com',
      department: 'IT',
      employmentStatus: 'ACTIVE',
      dateJoined: new Date('2024-01-01'),
      passwordHash: 'hashed_password',
      isApproved: true,
      roles: ['MEMBER'],
    }).returning() as any[];

    const user = userResult[0];
    if (!user) throw new Error('Failed to create test user');
    testUserId = user.id;

    // Create savings account with balance
    await db.insert(savingsAccounts).values({
      userId: testUserId,
      accountType: 'NORMAL',
      balanceKobo: 1000000, // ₦10,000
    });

    // Create guarantors
    const guarantorPromises = [1, 2, 3].map(async (i) => {
      const guarantorResult = await db.insert(users).values({
        memberId: `VIG-2026-G${i}`,
        employeeIdEncrypted: `encrypted_emp_id_${i}`,
        phoneEncrypted: `encrypted_phone_${i}`,
        employeeIdHash: `emp_hash_g${i}_${Date.now()}`,
        phoneHash: `phone_hash_g${i}_${Date.now()}`,
        fullName: `Guarantor ${i}`,
        email: `guarantor${i}@example.com`,
        department: 'IT',
        employmentStatus: 'ACTIVE',
        dateJoined: new Date('2024-01-01'),
        passwordHash: 'hashed_password',
        isApproved: true,
        roles: ['MEMBER'],
      }).returning() as any[];

      const guarantor = guarantorResult[0];
      if (!guarantor) throw new Error(`Failed to create guarantor ${i}`);

      // Create savings for guarantors
      await db.insert(savingsAccounts).values({
        userId: guarantor.id,
        accountType: 'NORMAL',
        balanceKobo: 2000000, // ₦20,000
      });

      return guarantor.id;
    });

    guarantorIds = await Promise.all(guarantorPromises);

    // Create a test loan
    const loanResult = await db.insert(loans).values({
      loanReference: 'LN-2026-00001',
      applicantId: testUserId,
      loanType: 'SHORT_TERM',
      principalKobo: 500000, // ₦5,000
      interestRateBps: 500, // 5%
      interestKobo: 25000, // ₦250
      totalRepayableKobo: 525000, // ₦5,250
      monthlyInstallmentKobo: 87500, // ₦875
      outstandingKobo: 525000,
      repaymentMonths: 6,
      purpose: 'Test loan',
      status: 'TREASURER_APPROVED',
      submittedAt: new Date(),
    }).returning();

    const loan = loanResult[0];
    if (!loan) throw new Error('Failed to create test loan');
    testLoanId = loan.id;

    // Create guarantor consents
    await Promise.all(
      guarantorIds.map((gId) =>
        db.insert(loanGuarantors).values({
          loanId: testLoanId,
          guarantorId: gId,
          status: 'CONSENTED',
          consentedAt: new Date(),
        })
      )
    );
  });

  afterAll(async () => {
    // Clean up test data (skip for now - will be handled by test database reset)
    // await db.delete(loanGuarantors);
    // await db.delete(loans);
    // await db.delete(savingsAccounts);
    // await db.delete(users);
  });

  describe('disburseLoan', () => {
    it('should successfully disburse an approved loan', async () => {
      const result = await loanService.disburseLoan(testLoanId, 'treasurer-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.loanReference).toBe('LN-2026-00001');
        expect(result.value.status).toBe('DISBURSED');
        expect(result.value.transferReference).toBeDefined();
      }

      // Verify loan status updated
      const updatedLoanResult = await db
        .select()
        .from(loans)
        .where(eq(loans.id, testLoanId));

      const updatedLoan = updatedLoanResult[0];
      expect(updatedLoan?.status).toBe('DISBURSED');
      expect(updatedLoan?.disbursedAt).toBeDefined();
    });

    it('should fail to disburse loan with invalid status', async () => {
      // Update loan to SUBMITTED status
      await db
        .update(loans)
        .set({ status: 'SUBMITTED' })
        .where(eq(loans.id, testLoanId));

      const result = await loanService.disburseLoan(testLoanId, 'treasurer-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_LOAN_STATUS');
      }
    });

    it('should fail to disburse loan if eligibility changed (TOCTOU protection)', async () => {
      // Reduce savings balance to make loan ineligible
      await db
        .update(savingsAccounts)
        .set({ balanceKobo: 10000 }) // ₦100 - too low
        .where(
          and(
            eq(savingsAccounts.userId, testUserId),
            eq(savingsAccounts.accountType, 'NORMAL')
          )
        );

      const result = await loanService.disburseLoan(testLoanId, 'treasurer-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INSUFFICIENT_ELIGIBILITY');
      }

      // Verify loan status not changed
      const loanResult = await db
        .select()
        .from(loans)
        .where(eq(loans.id, testLoanId));

      const loan = loanResult[0];
      expect(loan?.status).toBe('TREASURER_APPROVED');
      expect(loan?.disbursedAt).toBeNull();
    });

    it('should prevent concurrent disbursement attempts', async () => {
      // Attempt to disburse the same loan twice concurrently
      const [result1, result2] = await Promise.allSettled([
        loanService.disburseLoan(testLoanId, 'treasurer-1'),
        loanService.disburseLoan(testLoanId, 'treasurer-2'),
      ]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;

      expect(successCount).toBe(1);

      // Verify only one disbursement occurred
      const loanResult = await db
        .select()
        .from(loans)
        .where(eq(loans.id, testLoanId));

      const loan = loanResult[0];
      expect(loan?.status).toBe('DISBURSED');
    });

    it('should fail if applicant account is deactivated', async () => {
      // Deactivate user account
      await db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, testUserId));

      const result = await loanService.disburseLoan(testLoanId, 'treasurer-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('ACCOUNT_DEACTIVATED');
      }
    });
  });

  describe('recordRepayment', () => {
    beforeEach(async () => {
      // Disburse the loan first
      await db
        .update(loans)
        .set({ status: 'DISBURSED', disbursedAt: new Date() })
        .where(eq(loans.id, testLoanId));
    });

    it('should successfully record a partial repayment', async () => {
      const repaymentAmount = toKoboAmount(100000); // ₦1,000

      const result = await loanService.recordRepayment(
        testLoanId,
        repaymentAmount,
        new Date(),
        'PAY-001',
        'MANUAL',
        'treasurer-id'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outstandingKobo).toBe(425000); // 525000 - 100000
        expect(result.value.status).toBe('ACTIVE');
      }

      // Verify loan updated
      const loanResult = await db
        .select()
        .from(loans)
        .where(eq(loans.id, testLoanId));

      const loan = loanResult[0];
      expect(loan?.outstandingKobo).toBe(425000);
      expect(loan?.status).toBe('ACTIVE');
    });

    it('should mark loan as COMPLETED when fully repaid', async () => {
      const fullAmount = toKoboAmount(525000); // Full repayment

      const result = await loanService.recordRepayment(
        testLoanId,
        fullAmount,
        new Date(),
        'PAY-FULL',
        'MANUAL',
        'treasurer-id'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outstandingKobo).toBe(0);
        expect(result.value.status).toBe('COMPLETED');
      }

      // Verify loan completed
      const loanResult = await db
        .select()
        .from(loans)
        .where(eq(loans.id, testLoanId));

      const loan = loanResult[0];
      expect(loan?.outstandingKobo).toBe(0);
      expect(loan?.status).toBe('COMPLETED');
      expect(loan?.completedAt).toBeDefined();
    });

    it('should fail to record repayment exceeding outstanding balance', async () => {
      const excessAmount = toKoboAmount(600000); // More than outstanding

      const result = await loanService.recordRepayment(
        testLoanId,
        excessAmount,
        new Date(),
        'PAY-EXCESS',
        'MANUAL',
        'treasurer-id'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_INPUT');
      }
    });

    it('should fail to record negative or zero repayment', async () => {
      const zeroAmount = toKoboAmount(0);

      const result = await loanService.recordRepayment(
        testLoanId,
        zeroAmount,
        new Date(),
        'PAY-ZERO',
        'MANUAL',
        'treasurer-id'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_INPUT');
      }
    });

    it('should fail to record repayment on non-disbursed loan', async () => {
      // Update loan back to SUBMITTED
      await db
        .update(loans)
        .set({ status: 'SUBMITTED', disbursedAt: null })
        .where(eq(loans.id, testLoanId));

      const result = await loanService.recordRepayment(
        testLoanId,
        toKoboAmount(100000),
        new Date(),
        'PAY-INVALID',
        'MANUAL',
        'treasurer-id'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_LOAN_STATUS');
      }
    });

    it('should handle multiple sequential repayments correctly', async () => {
      // First repayment
      const result1 = await loanService.recordRepayment(
        testLoanId,
        toKoboAmount(100000),
        new Date(),
        'PAY-001',
        'MANUAL',
        'treasurer-id'
      );

      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.value.outstandingKobo).toBe(425000);
      }

      // Second repayment
      const result2 = await loanService.recordRepayment(
        testLoanId,
        toKoboAmount(200000),
        new Date(),
        'PAY-002',
        'MANUAL',
        'treasurer-id'
      );

      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.value.outstandingKobo).toBe(225000);
      }

      // Third repayment (final)
      const result3 = await loanService.recordRepayment(
        testLoanId,
        toKoboAmount(225000),
        new Date(),
        'PAY-003',
        'MANUAL',
        'treasurer-id'
      );

      expect(result3.success).toBe(true);
      if (result3.success) {
        expect(result3.value.outstandingKobo).toBe(0);
        expect(result3.value.status).toBe('COMPLETED');
      }
    });
  });
});
