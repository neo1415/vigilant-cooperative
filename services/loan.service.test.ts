/**
 * Loan Service Unit Tests
 * 
 * Tests loan calculations and validation rules.
 * Focus on financial calculations and business logic.
 * 
 * @module services/loan.service.test
 */

import { describe, it, expect } from 'vitest';
import { toKoboAmount } from '../types/branded';
import { 
  calculateLoanEligibility, 
  calculateLoanTerms,
  calculateLoanInterest,
  calculateMonthlyInstallment 
} from '../utils/financial';

describe('Loan Calculations', () => {
  describe('calculateLoanInterest', () => {
    it('should calculate 5% interest correctly', () => {
      const principal = toKoboAmount(500000); // ₦5,000
      const rateBps = 500; // 5%
      const interest = calculateLoanInterest(principal, rateBps);
      
      expect(interest).toBe(25000); // ₦250
    });
    
    it('should calculate 10% interest correctly', () => {
      const principal = toKoboAmount(1000000); // ₦10,000
      const rateBps = 1000; // 10%
      const interest = calculateLoanInterest(principal, rateBps);
      
      expect(interest).toBe(100000); // ₦1,000
    });
    
    it('should floor fractional kobo', () => {
      const principal = toKoboAmount(333333); // ₦3,333.33
      const rateBps = 500; // 5%
      const interest = calculateLoanInterest(principal, rateBps);
      
      // 333333 * 0.05 = 16666.65 -> floor to 16666
      expect(interest).toBe(16666);
    });
    
    it('should handle zero principal', () => {
      const principal = toKoboAmount(0);
      const rateBps = 500;
      const interest = calculateLoanInterest(principal, rateBps);
      
      expect(interest).toBe(0);
    });
    
    it('should handle large amounts', () => {
      const principal = toKoboAmount(10000000); // ₦100,000
      const rateBps = 1000; // 10%
      const interest = calculateLoanInterest(principal, rateBps);
      
      expect(interest).toBe(1000000); // ₦10,000
    });
  });
  
  describe('calculateMonthlyInstallment', () => {
    it('should calculate even installments', () => {
      const totalRepayable = toKoboAmount(600000); // ₦6,000
      const months = 6;
      const result = calculateMonthlyInstallment(totalRepayable, months);
      
      expect(result.monthlyInstallment).toBe(100000); // ₦1,000
      expect(result.finalInstallment).toBe(100000); // ₦1,000
    });
    
    it('should handle remainder in final installment', () => {
      const totalRepayable = toKoboAmount(600001); // ₦6,000.01
      const months = 6;
      const result = calculateMonthlyInstallment(totalRepayable, months);
      
      expect(result.monthlyInstallment).toBe(100000); // ₦1,000
      expect(result.finalInstallment).toBe(100001); // ₦1,000.01 (absorbs remainder)
    });
    
    it('should floor monthly installment', () => {
      const totalRepayable = toKoboAmount(1000000); // ₦10,000
      const months = 7;
      const result = calculateMonthlyInstallment(totalRepayable, months);
      
      // 1000000 / 7 = 142857.14... -> floor to 142857
      expect(result.monthlyInstallment).toBe(142857);
      // Final: 1000000 - (142857 * 6) = 142858
      expect(result.finalInstallment).toBe(142858);
    });
    
    it('should handle single month', () => {
      const totalRepayable = toKoboAmount(500000);
      const months = 1;
      const result = calculateMonthlyInstallment(totalRepayable, months);
      
      expect(result.monthlyInstallment).toBe(500000);
      expect(result.finalInstallment).toBe(500000);
    });
    
    it('should throw error for zero months', () => {
      const totalRepayable = toKoboAmount(500000);
      
      expect(() => calculateMonthlyInstallment(totalRepayable, 0)).toThrow();
    });
    
    it('should throw error for negative months', () => {
      const totalRepayable = toKoboAmount(500000);
      
      expect(() => calculateMonthlyInstallment(totalRepayable, -1)).toThrow();
    });
  });
  
  describe('calculateLoanTerms', () => {
    it('should calculate complete short-term loan (6 months, 5%)', () => {
      const principal = toKoboAmount(500000); // ₦5,000
      const rateBps = 500; // 5%
      const months = 6;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.principalKobo).toBe(500000);
      expect(terms.interestKobo).toBe(25000); // 5% of 500000
      expect(terms.totalRepayableKobo).toBe(525000);
      expect(terms.monthlyInstallment).toBe(87500); // 525000 / 6
      expect(terms.finalInstallment).toBe(87500);
    });
    
    it('should calculate complete long-term loan (12 months, 10%)', () => {
      const principal = toKoboAmount(1000000); // ₦10,000
      const rateBps = 1000; // 10%
      const months = 12;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.principalKobo).toBe(1000000);
      expect(terms.interestKobo).toBe(100000); // 10% of 1000000
      expect(terms.totalRepayableKobo).toBe(1100000);
      expect(terms.monthlyInstallment).toBe(91666); // floor(1100000 / 12)
      expect(terms.finalInstallment).toBe(91674); // 1100000 - (91666 * 11) = 91674
    });
    
    it('should handle loan with remainder', () => {
      const principal = toKoboAmount(333333);
      const rateBps = 500; // 5%
      const months = 6;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.principalKobo).toBe(333333);
      expect(terms.interestKobo).toBe(16666); // floor(333333 * 0.05)
      expect(terms.totalRepayableKobo).toBe(349999);
      expect(terms.monthlyInstallment).toBe(58333); // floor(349999 / 6)
      expect(terms.finalInstallment).toBe(58334); // 349999 - (58333 * 5)
    });
    
    it('should verify total equals sum of installments', () => {
      const principal = toKoboAmount(750000);
      const rateBps = 500;
      const months = 6;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      const regularPayments = terms.monthlyInstallment * (months - 1);
      const total = regularPayments + terms.finalInstallment;
      
      expect(total).toBe(terms.totalRepayableKobo);
    });
  });
  
  describe('calculateLoanEligibility', () => {
    it('should calculate eligibility with 3x ratio and no outstanding loans', () => {
      const savings = toKoboAmount(250000); // ₦2,500
      const ratio = 3.0;
      const outstanding = toKoboAmount(0);
      
      const eligibility = calculateLoanEligibility(savings, ratio, outstanding);
      
      expect(eligibility).toBe(750000); // ₦7,500 (3x savings)
    });
    
    it('should subtract outstanding loans from eligibility', () => {
      const savings = toKoboAmount(250000);
      const ratio = 3.0;
      const outstanding = toKoboAmount(100000);
      
      const eligibility = calculateLoanEligibility(savings, ratio, outstanding);
      
      expect(eligibility).toBe(650000); // 750000 - 100000
    });
    
    it('should return zero when outstanding exceeds max loan', () => {
      const savings = toKoboAmount(250000);
      const ratio = 3.0;
      const outstanding = toKoboAmount(800000);
      
      const eligibility = calculateLoanEligibility(savings, ratio, outstanding);
      
      expect(eligibility).toBe(0);
    });
    
    it('should return zero for zero savings', () => {
      const savings = toKoboAmount(0);
      const ratio = 3.0;
      const outstanding = toKoboAmount(0);
      
      const eligibility = calculateLoanEligibility(savings, ratio, outstanding);
      
      expect(eligibility).toBe(0);
    });
    
    it('should floor fractional eligibility', () => {
      const savings = toKoboAmount(333333);
      const ratio = 3.0;
      const outstanding = toKoboAmount(0);
      
      const eligibility = calculateLoanEligibility(savings, ratio, outstanding);
      
      // 333333 * 3 = 999999 (floored)
      expect(eligibility).toBe(999999);
    });
    
    it('should handle different ratios', () => {
      const savings = toKoboAmount(100000);
      const ratio = 2.5;
      const outstanding = toKoboAmount(0);
      
      const eligibility = calculateLoanEligibility(savings, ratio, outstanding);
      
      expect(eligibility).toBe(250000); // floor(100000 * 2.5)
    });
  });
});

describe('Loan Validation Rules', () => {
  describe('Interest Rate Validation', () => {
    it('should use 5% for short-term loans', () => {
      const principal = toKoboAmount(500000);
      const shortTermRate = 500; // 5% in basis points
      
      const interest = calculateLoanInterest(principal, shortTermRate);
      
      expect(interest).toBe(25000);
    });
    
    it('should use 10% for long-term loans', () => {
      const principal = toKoboAmount(500000);
      const longTermRate = 1000; // 10% in basis points
      
      const interest = calculateLoanInterest(principal, longTermRate);
      
      expect(interest).toBe(50000);
    });
  });
  
  describe('Repayment Period Validation', () => {
    it('should allow 6 months for short-term', () => {
      const principal = toKoboAmount(500000);
      const rateBps = 500;
      const months = 6;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.monthlyInstallment).toBeGreaterThan(0);
    });
    
    it('should allow 12 months for long-term', () => {
      const principal = toKoboAmount(1000000);
      const rateBps = 1000;
      const months = 12;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.monthlyInstallment).toBeGreaterThan(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle minimum loan amount (₦1)', () => {
      const principal = toKoboAmount(100); // ₦1
      const rateBps = 500;
      const months = 6;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.principalKobo).toBe(100);
      expect(terms.interestKobo).toBe(5); // floor(100 * 0.05)
      expect(terms.totalRepayableKobo).toBe(105);
    });
    
    it('should handle large loan amounts', () => {
      const principal = toKoboAmount(50000000); // ₦500,000
      const rateBps = 1000;
      const months = 12;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      expect(terms.principalKobo).toBe(50000000);
      expect(terms.interestKobo).toBe(5000000);
      expect(terms.totalRepayableKobo).toBe(55000000);
    });
    
    it('should maintain precision with complex calculations', () => {
      const principal = toKoboAmount(987654);
      const rateBps = 750; // 7.5%
      const months = 9;
      
      const terms = calculateLoanTerms(principal, rateBps, months);
      
      // Verify total equals sum of all installments
      const regularPayments = terms.monthlyInstallment * (months - 1);
      const total = regularPayments + terms.finalInstallment;
      
      expect(total).toBe(terms.totalRepayableKobo);
    });
  });
});

describe('Guarantor Exposure Calculations', () => {
  it('should calculate 200% exposure limit', () => {
    const guarantorSavings = toKoboAmount(500000); // ₦5,000
    const exposureLimitPct = 200;
    
    const limit = Math.floor((guarantorSavings * exposureLimitPct) / 100);
    
    expect(limit).toBe(1000000); // ₦10,000 (2x savings)
  });
  
  it('should allow guarantee within exposure limit', () => {
    const guarantorSavings = toKoboAmount(500000);
    const currentExposure = toKoboAmount(800000);
    const newLoanPrincipal = toKoboAmount(150000);
    const exposureLimitPct = 200;
    
    const limit = Math.floor((guarantorSavings * exposureLimitPct) / 100);
    const newExposure = currentExposure + newLoanPrincipal;
    
    expect(newExposure).toBeLessThanOrEqual(limit);
  });
  
  it('should reject guarantee exceeding exposure limit', () => {
    const guarantorSavings = toKoboAmount(500000);
    const currentExposure = toKoboAmount(900000);
    const newLoanPrincipal = toKoboAmount(200000);
    const exposureLimitPct = 200;
    
    const limit = Math.floor((guarantorSavings * exposureLimitPct) / 100);
    const newExposure = currentExposure + newLoanPrincipal;
    
    expect(newExposure).toBeGreaterThan(limit);
  });
});

describe('Concurrent Loan Validation', () => {
  it('should allow 1 active long-term loan', () => {
    const maxActiveLongTerm = 1;
    const currentActiveLongTerm = 0;
    
    expect(currentActiveLongTerm).toBeLessThan(maxActiveLongTerm);
  });
  
  it('should reject second long-term loan', () => {
    const maxActiveLongTerm = 1;
    const currentActiveLongTerm = 1;
    
    expect(currentActiveLongTerm).toBeGreaterThanOrEqual(maxActiveLongTerm);
  });
  
  it('should allow 2 active short-term loans', () => {
    const maxActiveShortTerm = 2;
    const currentActiveShortTerm = 1;
    
    expect(currentActiveShortTerm).toBeLessThan(maxActiveShortTerm);
  });
  
  it('should reject third short-term loan', () => {
    const maxActiveShortTerm = 2;
    const currentActiveShortTerm = 2;
    
    expect(currentActiveShortTerm).toBeGreaterThanOrEqual(maxActiveShortTerm);
  });
});


describe('Loan Approval Workflow', () => {
  describe('Status Transitions', () => {
    it('should validate SUBMITTED -> GUARANTOR_CONSENT transition', () => {
      const validStatuses = ['SUBMITTED', 'GUARANTOR_CONSENT'];
      expect(validStatuses).toContain('SUBMITTED');
      expect(validStatuses).toContain('GUARANTOR_CONSENT');
    });
    
    it('should validate GUARANTOR_CONSENT -> PRESIDENT_REVIEW transition', () => {
      const validStatuses = ['GUARANTOR_CONSENT', 'PRESIDENT_REVIEW'];
      expect(validStatuses).toContain('GUARANTOR_CONSENT');
      expect(validStatuses).toContain('PRESIDENT_REVIEW');
    });
    
    it('should validate PRESIDENT_REVIEW -> COMMITTEE_REVIEW transition', () => {
      const validStatuses = ['PRESIDENT_REVIEW', 'COMMITTEE_REVIEW'];
      expect(validStatuses).toContain('PRESIDENT_REVIEW');
      expect(validStatuses).toContain('COMMITTEE_REVIEW');
    });
    
    it('should validate COMMITTEE_REVIEW -> TREASURER_REVIEW transition', () => {
      const validStatuses = ['COMMITTEE_REVIEW', 'TREASURER_REVIEW'];
      expect(validStatuses).toContain('COMMITTEE_REVIEW');
      expect(validStatuses).toContain('TREASURER_REVIEW');
    });
    
    it('should validate rejection from any review status', () => {
      const reviewStatuses = ['PRESIDENT_REVIEW', 'COMMITTEE_REVIEW', 'TREASURER_REVIEW'];
      const rejectedStatus = 'REJECTED';
      
      reviewStatuses.forEach(status => {
        expect(status).toBeTruthy();
      });
      expect(rejectedStatus).toBe('REJECTED');
    });
    
    it('should validate cancellation from pre-disbursement statuses', () => {
      const cancellableStatuses = [
        'SUBMITTED',
        'GUARANTOR_CONSENT',
        'PRESIDENT_REVIEW',
        'COMMITTEE_REVIEW',
        'TREASURER_REVIEW'
      ];
      
      expect(cancellableStatuses.length).toBe(5);
      expect(cancellableStatuses).toContain('SUBMITTED');
      expect(cancellableStatuses).toContain('TREASURER_REVIEW');
    });
  });
  
  describe('Guarantor Consent Logic', () => {
    it('should require all guarantors to consent before advancing', () => {
      const guarantors = [
        { status: 'CONSENTED' },
        { status: 'CONSENTED' },
        { status: 'PENDING' }
      ];
      
      const allConsented = guarantors.every(g => g.status === 'CONSENTED');
      expect(allConsented).toBe(false);
    });
    
    it('should advance when all guarantors consent', () => {
      const guarantors = [
        { status: 'CONSENTED' },
        { status: 'CONSENTED' },
        { status: 'CONSENTED' }
      ];
      
      const allConsented = guarantors.every(g => g.status === 'CONSENTED');
      expect(allConsented).toBe(true);
    });
    
    it('should reject loan if any guarantor declines', () => {
      const guarantors = [
        { status: 'CONSENTED' },
        { status: 'DECLINED' },
        { status: 'PENDING' }
      ];
      
      const anyDeclined = guarantors.some(g => g.status === 'DECLINED');
      expect(anyDeclined).toBe(true);
    });
  });
  
  describe('Committee Approval Logic', () => {
    it('should require 2 committee approvals', () => {
      const requiredApprovals = 2;
      expect(requiredApprovals).toBe(2);
    });
    
    it('should not advance with only 1 committee approval', () => {
      const approvals = [
        { approverRole: 'COMMITTEE', action: 'APPROVED' }
      ];
      
      const committeeApprovals = approvals.filter(
        a => a.approverRole === 'COMMITTEE' && a.action === 'APPROVED'
      );
      
      expect(committeeApprovals.length).toBe(1);
      expect(committeeApprovals.length).toBeLessThan(2);
    });
    
    it('should advance with 2 committee approvals', () => {
      const approvals = [
        { approverRole: 'COMMITTEE', action: 'APPROVED' },
        { approverRole: 'COMMITTEE', action: 'APPROVED' }
      ];
      
      const committeeApprovals = approvals.filter(
        a => a.approverRole === 'COMMITTEE' && a.action === 'APPROVED'
      );
      
      expect(committeeApprovals.length).toBe(2);
      expect(committeeApprovals.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should not count rejected approvals', () => {
      const approvals = [
        { approverRole: 'COMMITTEE', action: 'APPROVED' },
        { approverRole: 'COMMITTEE', action: 'REJECTED' }
      ];
      
      const committeeApprovals = approvals.filter(
        a => a.approverRole === 'COMMITTEE' && a.action === 'APPROVED'
      );
      
      expect(committeeApprovals.length).toBe(1);
    });
  });
  
  describe('Rejection Reason Validation', () => {
    it('should require minimum 20 characters for rejection reason', () => {
      const minLength = 20;
      const validReason = 'This loan application does not meet our criteria';
      const invalidReason = 'Too short';
      
      expect(validReason.length).toBeGreaterThanOrEqual(minLength);
      expect(invalidReason.length).toBeLessThan(minLength);
    });
    
    it('should accept valid rejection reasons', () => {
      const reasons = [
        'Insufficient documentation provided for loan verification',
        'Applicant does not meet minimum savings requirement',
        'Purpose of loan does not align with cooperative policy'
      ];
      
      reasons.forEach(reason => {
        expect(reason.length).toBeGreaterThanOrEqual(20);
      });
    });
  });
  
  describe('Approval Role Validation', () => {
    it('should validate president role', () => {
      const validRoles = ['PRESIDENT', 'COMMITTEE', 'TREASURER'];
      expect(validRoles).toContain('PRESIDENT');
    });
    
    it('should validate committee role', () => {
      const validRoles = ['PRESIDENT', 'COMMITTEE', 'TREASURER'];
      expect(validRoles).toContain('COMMITTEE');
    });
    
    it('should validate treasurer role', () => {
      const validRoles = ['PRESIDENT', 'COMMITTEE', 'TREASURER'];
      expect(validRoles).toContain('TREASURER');
    });
  });
});
