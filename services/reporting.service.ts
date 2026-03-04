import { db } from '../server/db/init';
import {
  chartOfAccounts,
  transactions,
  loans,
  savingsAccounts,
  users,
} from '../server/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { err, ok, type Result } from '../types/result';
import { getAccountBalance, getAllAccountBalances, type AccountBalance } from './ledger.service';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_FLOOR });

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface BalanceSheet {
  asOfDate: Date;
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export interface IncomeStatement {
  startDate: Date;
  endDate: Date;
  revenue: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface TrialBalance {
  asOfDate: Date;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface MemberStatement {
  memberId: string;
  memberName: string;
  startDate: Date;
  endDate: Date;
  normalSavingsBalance: number;
  specialSavingsBalance: number;
  totalSavings: number;
  savingsTransactions: Array<{
    date: Date;
    type: string;
    description: string;
    amount: number;
    balanceAfter: number;
  }>;
  loans: Array<{
    loanReference: string;
    loanType: string;
    principalKobo: number;
    outstandingKobo: number;
    status: string;
    disbursedAt: Date | null;
  }>;
  totalLoansOutstanding: number;
}

export type ReportingServiceError =
  | { code: 'MEMBER_NOT_FOUND'; message: string }
  | { code: 'INVALID_DATE_RANGE'; message: string }
  | { code: 'DATABASE_ERROR'; message: string };

/**
 * Generate Balance Sheet
 * Shows financial position at a specific point in time
 * Assets = Liabilities + Equity
 */
export async function generateBalanceSheet(
  asOfDate: Date = new Date()
): Promise<Result<BalanceSheet, ReportingServiceError>> {
  try {
    const balancesResult = await getAllAccountBalances(asOfDate);
    if (!balancesResult.success) {
      return err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve account balances',
      });
    }

    const balances = balancesResult.value;

    const assets = balances.filter((b) => b.accountType === 'ASSET');
    const liabilities = balances.filter((b) => b.accountType === 'LIABILITY');
    const equity = balances.filter((b) => b.accountType === 'EQUITY');

    const totalAssets = assets.reduce((sum, a) => sum + a.balanceKobo, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balanceKobo, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balanceKobo, 0);

    const isBalanced = totalAssets === totalLiabilities + totalEquity;

    return ok({
      asOfDate,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
    });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Generate Income Statement
 * Shows financial performance over a period
 * Net Income = Revenue - Expenses
 */
export async function generateIncomeStatement(
  dateRange: DateRange
): Promise<Result<IncomeStatement, ReportingServiceError>> {
  try {
    if (dateRange.startDate > dateRange.endDate) {
      return err({
        code: 'INVALID_DATE_RANGE',
        message: 'Start date must be before end date',
      });
    }

    // Get balances at end of period
    const balancesResult = await getAllAccountBalances(dateRange.endDate);
    if (!balancesResult.success) {
      return err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve account balances',
      });
    }

    const balances = balancesResult.value;

    const revenue = balances.filter((b) => b.accountType === 'REVENUE');
    const expenses = balances.filter((b) => b.accountType === 'EXPENSE');

    const totalRevenue = revenue.reduce((sum, r) => sum + r.balanceKobo, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.balanceKobo, 0);
    const netIncome = totalRevenue - totalExpenses;

    return ok({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
    });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Generate Trial Balance
 * Lists all accounts with their debit and credit balances
 * Total debits must equal total credits
 */
export async function generateTrialBalance(
  asOfDate: Date = new Date()
): Promise<Result<TrialBalance, ReportingServiceError>> {
  try {
    const balancesResult = await getAllAccountBalances(asOfDate);
    if (!balancesResult.success) {
      return err({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve account balances',
      });
    }

    const balances = balancesResult.value;

    let totalDebits = 0;
    let totalCredits = 0;

    const accounts = balances.map((balance) => {
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(balance.accountType);
      const debitBalance = isDebitNormal && balance.balanceKobo > 0 ? balance.balanceKobo : 0;
      const creditBalance = !isDebitNormal && balance.balanceKobo > 0 ? balance.balanceKobo : 0;

      totalDebits += debitBalance;
      totalCredits += creditBalance;

      return {
        accountCode: balance.accountCode,
        accountName: balance.accountName,
        accountType: balance.accountType,
        debitBalance,
        creditBalance,
      };
    });

    const isBalanced = totalDebits === totalCredits;

    return ok({
      asOfDate,
      accounts,
      totalDebits,
      totalCredits,
      isBalanced,
    });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}

/**
 * Generate Member Statement
 * Complete financial history for a specific member
 */
export async function generateMemberStatement(
  userId: string,
  dateRange: DateRange
): Promise<Result<MemberStatement, ReportingServiceError>> {
  try {
    if (dateRange.startDate > dateRange.endDate) {
      return err({
        code: 'INVALID_DATE_RANGE',
        message: 'Start date must be before end date',
      });
    }

    // Get member details
    const [member] = (await db
      .select({
        memberId: users.memberId,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)) as any[];

    if (!member) {
      return err({
        code: 'MEMBER_NOT_FOUND',
        message: `Member ${userId} not found`,
      });
    }

    // Get savings accounts
    const accounts = (await db
      .select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.userId, userId))) as any[];

    const normalAccount = accounts.find((a: any) => a.accountType === 'NORMAL');
    const specialAccount = accounts.find((a: any) => a.accountType === 'SPECIAL');

    const normalSavingsBalance = normalAccount?.balanceKobo || 0;
    const specialSavingsBalance = specialAccount?.balanceKobo || 0;
    const totalSavings = normalSavingsBalance + specialSavingsBalance;

    // Get savings transactions
    const savingsTransactions = (await db
      .select({
        date: transactions.createdAt,
        type: transactions.type,
        description: transactions.description,
        amount: transactions.amountKobo,
        balanceAfter: transactions.balanceAfterKobo,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.createdAt, dateRange.startDate),
          lte(transactions.createdAt, dateRange.endDate)
        )
      )
      .orderBy(desc(transactions.createdAt))) as any[];

    // Get loans
    const memberLoans = (await db
      .select({
        loanReference: loans.loanReference,
        loanType: loans.loanType,
        principalKobo: loans.principalKobo,
        outstandingKobo: loans.outstandingKobo,
        status: loans.status,
        disbursedAt: loans.disbursedAt,
      })
      .from(loans)
      .where(eq(loans.applicantId, userId))
      .orderBy(desc(loans.createdAt))) as any[];

    const totalLoansOutstanding = memberLoans
      .filter((l: any) => l.status === 'DISBURSED')
      .reduce((sum: number, l: any) => sum + l.outstandingKobo, 0);

    return ok({
      memberId: member.memberId,
      memberName: member.fullName,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      normalSavingsBalance,
      specialSavingsBalance,
      totalSavings,
      savingsTransactions,
      loans: memberLoans,
      totalLoansOutstanding,
    });
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
}
