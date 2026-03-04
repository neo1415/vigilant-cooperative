import { db } from '../server/db/init';
import {
  vouchers,
  ledgerEntries,
  chartOfAccounts,
} from '../server/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { err, ok, isOk, type Result } from '../types/result';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_FLOOR });

export interface CreateVoucherInput {
  voucherType: string;
  description: string;
  createdBy: string;
  documentUrl?: string;
}

export interface LedgerEntryInput {
  accountCode: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountKobo: number;
  description: string;
}

export interface VoucherWithEntries {
  voucher: typeof vouchers.$inferSelect;
  entries: (typeof ledgerEntries.$inferSelect)[];
}

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceKobo: number;
}

export interface ReconciliationResult {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  discrepancy: number;
  unbalancedVouchers: string[];
}

export type LedgerServiceError =
  | { code: 'VOUCHER_NOT_FOUND'; message: string }
  | { code: 'ACCOUNT_NOT_FOUND'; message: string }
  | { code: 'ENTRIES_NOT_BALANCED'; message: string; details: { totalDebits: number; totalCredits: number } }
  | { code: 'INVALID_ENTRY_AMOUNT'; message: string }
  | { code: 'INVALID_ACCOUNT_CODE'; message: string }
  | { code: 'VOUCHER_ALREADY_POSTED'; message: string }
  | { code: 'DATABASE_ERROR'; message: string };

/**
 * Create a voucher with balanced ledger entries
 * Enforces double-entry bookkeeping: debits must equal credits
 */
export async function createVoucher(
  input: CreateVoucherInput,
  entries: LedgerEntryInput[]
): Promise<Result<VoucherWithEntries, LedgerServiceError>> {
  try {
    // Validate entries are balanced
    const validation = validateEntriesBalance(entries);
    if (!validation.isBalanced) {
      return err({
        code: 'ENTRIES_NOT_BALANCED',
        message: `Debits (${validation.totalDebits}) must equal credits (${validation.totalCredits})`,
        details: {
          totalDebits: validation.totalDebits,
          totalCredits: validation.totalCredits,
        },
      });
    }

    // Validate all account codes exist
    for (const entry of entries) {
      const accountExists = await db
        .select({ code: chartOfAccounts.accountCode })
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.accountCode, entry.accountCode))
        .limit(1);

      if (accountExists.length === 0) {
        return err({
          code: 'ACCOUNT_NOT_FOUND',
          message: `Account code ${entry.accountCode} does not exist`,
        });
      }
    }

    // Calculate total amount (sum of debits or credits, they're equal)
    const totalAmountKobo = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amountKobo, 0);

    // Generate voucher number
    const year = new Date().getFullYear();
    const voucherNumber = `VCH-${year}-${Date.now().toString().slice(-5)}`;

    // Create voucher and entries in a transaction
    const result = await db.transaction(async (tx) => {
      // Create voucher
      const [voucher] = (await tx
        .insert(vouchers)
        .values({
          voucherNumber,
          voucherType: input.voucherType,
          amountKobo: totalAmountKobo,
          description: input.description,
          status: 'DRAFT',
          createdBy: input.createdBy,
          documentUrl: input.documentUrl || null,
        })
        .returning()) as any[];

      // Create ledger entries
      const createdEntries = (await tx
        .insert(ledgerEntries)
        .values(
          entries.map((entry) => ({
            voucherId: voucher!.id,
            accountCode: entry.accountCode,
            entryType: entry.entryType,
            amountKobo: entry.amountKobo,
            description: entry.description,
          }))
        )
        .returning()) as any[];

      return { voucher: voucher!, entries: createdEntries };
    });

    return ok(result);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Validate that ledger entries are balanced (debits = credits)
 */
function validateEntriesBalance(entries: LedgerEntryInput[]): {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
} {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    if (entry.amountKobo <= 0) {
      return { isBalanced: false, totalDebits: 0, totalCredits: 0 };
    }

    if (entry.entryType === 'DEBIT') {
      totalDebits += entry.amountKobo;
    } else {
      totalCredits += entry.amountKobo;
    }
  }

  return {
    isBalanced: totalDebits === totalCredits,
    totalDebits,
    totalCredits,
  };
}

/**
 * Post a voucher (mark as POSTED)
 * Once posted, voucher and entries become immutable
 */
export async function postVoucher(
  voucherId: string,
  postedBy: string
): Promise<Result<typeof vouchers.$inferSelect, LedgerServiceError>> {
  try {
    const [voucher] = (await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, voucherId))
      .limit(1)) as any[];

    if (!voucher) {
      return err({
        code: 'VOUCHER_NOT_FOUND',
        message: `Voucher ${voucherId} not found`,
      });
    }

    if (voucher.status === 'POSTED') {
      return err({
        code: 'VOUCHER_ALREADY_POSTED',
        message: `Voucher ${voucherId} is already posted`,
      });
    }

    const [updated] = (await db
      .update(vouchers)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
      })
      .where(eq(vouchers.id, voucherId))
      .returning()) as any[];

    return ok(updated!);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Get account balance by summing all ledger entries
 * Assets and Expenses: Debits increase, Credits decrease
 * Liabilities, Equity, Revenue: Credits increase, Debits decrease
 */
export async function getAccountBalance(
  accountCode: string,
  asOfDate?: Date
): Promise<Result<AccountBalance, LedgerServiceError>> {
  try {
    // Get account details
    const [account] = (await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.accountCode, accountCode))
      .limit(1)) as any[];

    if (!account) {
      return err({
        code: 'ACCOUNT_NOT_FOUND',
        message: `Account ${accountCode} not found`,
      });
    }

    // Build query for ledger entries
    const baseConditions = [
      eq(ledgerEntries.accountCode, accountCode),
      eq(vouchers.status, 'POSTED'),
    ];

    if (asOfDate) {
      baseConditions.push(lte(vouchers.postedAt, asOfDate));
    }

    const entries = (await db
      .select({
        entryType: ledgerEntries.entryType,
        amountKobo: ledgerEntries.amountKobo,
      })
      .from(ledgerEntries)
      .innerJoin(vouchers, eq(ledgerEntries.voucherId, vouchers.id))
      .where(and(...baseConditions))) as any[];

    // Calculate balance based on account type
    let balanceKobo = 0;
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.accountType);

    for (const entry of entries) {
      if (entry.entryType === 'DEBIT') {
        balanceKobo += isDebitNormal ? entry.amountKobo : -entry.amountKobo;
      } else {
        balanceKobo += isDebitNormal ? -entry.amountKobo : entry.amountKobo;
      }
    }

    return ok({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      balanceKobo,
    });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Get all account balances
 */
export async function getAllAccountBalances(
  asOfDate?: Date
): Promise<Result<AccountBalance[], LedgerServiceError>> {
  try {
    const accounts = (await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.isActive, true))
      .orderBy(chartOfAccounts.accountCode)) as any[];

    const balances: AccountBalance[] = [];

    for (const account of accounts) {
      const balanceResult = await getAccountBalance(account.accountCode, asOfDate);
      if (isOk(balanceResult)) {
        balances.push(balanceResult.value);
      }
    }

    return ok(balances);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Reconcile accounts - verify all vouchers are balanced
 */
export async function reconcileAccounts(): Promise<Result<ReconciliationResult, LedgerServiceError>> {
  try {
    // Get all posted vouchers
    const postedVouchers = (await db
      .select({ id: vouchers.id, voucherNumber: vouchers.voucherNumber })
      .from(vouchers)
      .where(eq(vouchers.status, 'POSTED'))) as any[];

    const unbalancedVouchers: string[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    // Check each voucher
    for (const voucher of postedVouchers) {
      const entries = (await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.voucherId, voucher.id))) as any[];

      let voucherDebits = 0;
      let voucherCredits = 0;

      for (const entry of entries) {
        if (entry.entryType === 'DEBIT') {
          voucherDebits += entry.amountKobo;
          totalDebits += entry.amountKobo;
        } else {
          voucherCredits += entry.amountKobo;
          totalCredits += entry.amountKobo;
        }
      }

      if (voucherDebits !== voucherCredits) {
        unbalancedVouchers.push(voucher.voucherNumber);
      }
    }

    const isBalanced = totalDebits === totalCredits && unbalancedVouchers.length === 0;
    const discrepancy = totalDebits - totalCredits;

    return ok({
      isBalanced,
      totalDebits,
      totalCredits,
      discrepancy,
      unbalancedVouchers,
    });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Get voucher with all its entries
 */
export async function getVoucherWithEntries(
  voucherId: string
): Promise<Result<VoucherWithEntries, LedgerServiceError>> {
  try {
    const [voucher] = (await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, voucherId))
      .limit(1)) as any[];

    if (!voucher) {
      return err({
        code: 'VOUCHER_NOT_FOUND',
        message: `Voucher ${voucherId} not found`,
      });
    }

    const entries = (await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.voucherId, voucherId))
      .orderBy(ledgerEntries.createdAt)) as any[];

    return ok({ voucher, entries });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Get recent vouchers with pagination
 */
export async function getRecentVouchers(
  limit: number = 20,
  offset: number = 0
): Promise<Result<(typeof vouchers.$inferSelect)[], LedgerServiceError>> {
  try {
    const results = (await db
      .select()
      .from(vouchers)
      .orderBy(desc(vouchers.createdAt))
      .limit(limit)
      .offset(offset)) as any[];

    return ok(results);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}
