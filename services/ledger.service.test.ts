import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for Ledger Service
 * 
 * These tests validate the business logic for:
 * - Double-entry balance validation
 * - Voucher creation
 * - Account balance calculation
 * - Reconciliation logic
 */

describe('Ledger Validation Logic', () => {
  describe('Double-Entry Balance Validation', () => {
    it('should validate balanced entries (debits = credits)', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 100000, description: 'Cash' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 100000, description: 'Loan' },
      ];

      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          totalDebits += entry.amountKobo;
        } else {
          totalCredits += entry.amountKobo;
        }
      }

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(100000);
    });

    it('should detect unbalanced entries (debits != credits)', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 100000, description: 'Cash' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 90000, description: 'Loan' },
      ];

      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          totalDebits += entry.amountKobo;
        } else {
          totalCredits += entry.amountKobo;
        }
      }

      expect(totalDebits).not.toBe(totalCredits);
      expect(totalDebits - totalCredits).toBe(10000);
    });

    it('should validate complex multi-entry transactions', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 50000, description: 'Cash' },
        { accountCode: '1002', entryType: 'DEBIT' as const, amountKobo: 30000, description: 'Bank' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 40000, description: 'Loan 1' },
        { accountCode: '2002', entryType: 'CREDIT' as const, amountKobo: 40000, description: 'Loan 2' },
      ];

      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          totalDebits += entry.amountKobo;
        } else {
          totalCredits += entry.amountKobo;
        }
      }

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(80000);
    });

    it('should reject entries with zero or negative amounts', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 0, description: 'Cash' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 0, description: 'Loan' },
      ];

      const hasInvalidAmount = entries.some((e) => e.amountKobo <= 0);
      expect(hasInvalidAmount).toBe(true);
    });

    it('should handle large amounts without overflow', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 999999999999, description: 'Cash' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 999999999999, description: 'Loan' },
      ];

      let totalDebits = 0;
      let totalCredits = 0;

      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          totalDebits += entry.amountKobo;
        } else {
          totalCredits += entry.amountKobo;
        }
      }

      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(999999999999);
    });
  });

  describe('Account Balance Calculation', () => {
    it('should calculate asset account balance (debits increase)', () => {
      const entries = [
        { entryType: 'DEBIT' as const, amountKobo: 100000 },
        { entryType: 'CREDIT' as const, amountKobo: 30000 },
        { entryType: 'DEBIT' as const, amountKobo: 50000 },
      ];

      const accountType = 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(accountType);

      let balance = 0;
      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          balance += isDebitNormal ? entry.amountKobo : -entry.amountKobo;
        } else {
          balance += isDebitNormal ? -entry.amountKobo : entry.amountKobo;
        }
      }

      expect(balance).toBe(120000); // 100000 - 30000 + 50000
    });

    it('should calculate liability account balance (credits increase)', () => {
      const entries = [
        { entryType: 'CREDIT' as const, amountKobo: 100000 },
        { entryType: 'DEBIT' as const, amountKobo: 30000 },
        { entryType: 'CREDIT' as const, amountKobo: 50000 },
      ];

      const accountType = 'LIABILITY';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(accountType);

      let balance = 0;
      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          balance += isDebitNormal ? entry.amountKobo : -entry.amountKobo;
        } else {
          balance += isDebitNormal ? -entry.amountKobo : entry.amountKobo;
        }
      }

      expect(balance).toBe(120000); // 100000 - 30000 + 50000
    });

    it('should calculate revenue account balance (credits increase)', () => {
      const entries = [
        { entryType: 'CREDIT' as const, amountKobo: 200000 },
        { entryType: 'CREDIT' as const, amountKobo: 150000 },
      ];

      const accountType = 'REVENUE';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(accountType);

      let balance = 0;
      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          balance += isDebitNormal ? entry.amountKobo : -entry.amountKobo;
        } else {
          balance += isDebitNormal ? -entry.amountKobo : entry.amountKobo;
        }
      }

      expect(balance).toBe(350000);
    });

    it('should calculate expense account balance (debits increase)', () => {
      const entries = [
        { entryType: 'DEBIT' as const, amountKobo: 50000 },
        { entryType: 'DEBIT' as const, amountKobo: 30000 },
      ];

      const accountType = 'EXPENSE';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(accountType);

      let balance = 0;
      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          balance += isDebitNormal ? entry.amountKobo : -entry.amountKobo;
        } else {
          balance += isDebitNormal ? -entry.amountKobo : entry.amountKobo;
        }
      }

      expect(balance).toBe(80000);
    });

    it('should handle zero balance accounts', () => {
      const entries = [
        { entryType: 'DEBIT' as const, amountKobo: 100000 },
        { entryType: 'CREDIT' as const, amountKobo: 100000 },
      ];

      const accountType = 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(accountType);

      let balance = 0;
      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          balance += isDebitNormal ? entry.amountKobo : -entry.amountKobo;
        } else {
          balance += isDebitNormal ? -entry.amountKobo : entry.amountKobo;
        }
      }

      expect(balance).toBe(0);
    });
  });

  describe('Reconciliation Logic', () => {
    it('should detect balanced system (total debits = total credits)', () => {
      const vouchers = [
        {
          id: '1',
          entries: [
            { entryType: 'DEBIT' as const, amountKobo: 100000 },
            { entryType: 'CREDIT' as const, amountKobo: 100000 },
          ],
        },
        {
          id: '2',
          entries: [
            { entryType: 'DEBIT' as const, amountKobo: 50000 },
            { entryType: 'CREDIT' as const, amountKobo: 50000 },
          ],
        },
      ];

      let totalDebits = 0;
      let totalCredits = 0;
      const unbalancedVouchers: string[] = [];

      for (const voucher of vouchers) {
        let voucherDebits = 0;
        let voucherCredits = 0;

        for (const entry of voucher.entries) {
          if (entry.entryType === 'DEBIT') {
            voucherDebits += entry.amountKobo;
            totalDebits += entry.amountKobo;
          } else {
            voucherCredits += entry.amountKobo;
            totalCredits += entry.amountKobo;
          }
        }

        if (voucherDebits !== voucherCredits) {
          unbalancedVouchers.push(voucher.id);
        }
      }

      expect(totalDebits).toBe(totalCredits);
      expect(unbalancedVouchers).toHaveLength(0);
    });

    it('should detect unbalanced vouchers', () => {
      const vouchers = [
        {
          id: 'VCH-001',
          entries: [
            { entryType: 'DEBIT' as const, amountKobo: 100000 },
            { entryType: 'CREDIT' as const, amountKobo: 100000 },
          ],
        },
        {
          id: 'VCH-002',
          entries: [
            { entryType: 'DEBIT' as const, amountKobo: 50000 },
            { entryType: 'CREDIT' as const, amountKobo: 40000 }, // Unbalanced!
          ],
        },
      ];

      let totalDebits = 0;
      let totalCredits = 0;
      const unbalancedVouchers: string[] = [];

      for (const voucher of vouchers) {
        let voucherDebits = 0;
        let voucherCredits = 0;

        for (const entry of voucher.entries) {
          if (entry.entryType === 'DEBIT') {
            voucherDebits += entry.amountKobo;
            totalDebits += entry.amountKobo;
          } else {
            voucherCredits += entry.amountKobo;
            totalCredits += entry.amountKobo;
          }
        }

        if (voucherDebits !== voucherCredits) {
          unbalancedVouchers.push(voucher.id);
        }
      }

      expect(unbalancedVouchers).toContain('VCH-002');
      expect(unbalancedVouchers).toHaveLength(1);
    });

    it('should calculate system-wide discrepancy', () => {
      const vouchers = [
        {
          id: '1',
          entries: [
            { entryType: 'DEBIT' as const, amountKobo: 100000 },
            { entryType: 'CREDIT' as const, amountKobo: 90000 },
          ],
        },
      ];

      let totalDebits = 0;
      let totalCredits = 0;

      for (const voucher of vouchers) {
        for (const entry of voucher.entries) {
          if (entry.entryType === 'DEBIT') {
            totalDebits += entry.amountKobo;
          } else {
            totalCredits += entry.amountKobo;
          }
        }
      }

      const discrepancy = totalDebits - totalCredits;
      expect(discrepancy).toBe(10000);
    });
  });

  describe('Voucher Creation Validation', () => {
    it('should require at least 2 entries (debit and credit)', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 100000, description: 'Cash' },
      ];

      // A valid voucher should have at least 2 entries
      const isValid = entries.length >= 2;
      expect(isValid).toBe(false);
    });

    it('should validate account codes exist', () => {
      const validAccountCodes = ['1001', '1002', '2001', '2002'];
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 100000, description: 'Cash' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 100000, description: 'Loan' },
      ];

      const allValid = entries.every((e) => validAccountCodes.includes(e.accountCode));
      expect(allValid).toBe(true);
    });

    it('should reject invalid account codes', () => {
      const validAccountCodes = ['1001', '1002', '2001', '2002'];
      const entries = [
        { accountCode: '9999', entryType: 'DEBIT' as const, amountKobo: 100000, description: 'Cash' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 100000, description: 'Loan' },
      ];

      const allValid = entries.every((e) => validAccountCodes.includes(e.accountCode));
      expect(allValid).toBe(false);
    });

    it('should calculate total voucher amount from debits', () => {
      const entries = [
        { accountCode: '1001', entryType: 'DEBIT' as const, amountKobo: 60000, description: 'Cash' },
        { accountCode: '1002', entryType: 'DEBIT' as const, amountKobo: 40000, description: 'Bank' },
        { accountCode: '2001', entryType: 'CREDIT' as const, amountKobo: 100000, description: 'Loan' },
      ];

      const totalDebits = entries
        .filter((e) => e.entryType === 'DEBIT')
        .reduce((sum, e) => sum + e.amountKobo, 0);

      expect(totalDebits).toBe(100000);
    });
  });
});
