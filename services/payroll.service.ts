import { db } from '../server/db/init';
import { payrollImports, payrollDeductions, users, savingsAccounts, loans, transactions } from '../server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ok, err, type Result } from '../types/result';
import { generateReference } from '../utils/reference';

export interface PayrollRow {
  memberId: string;
  employeeId: string;
  normalSavingsKobo: number;
  specialSavingsKobo: number;
  loanRepaymentKobo: number;
  otherDeductionsKobo: number;
  otherDescription?: string;
}

export interface PayrollValidationError {
  row: number;
  memberId: string;
  field: string;
  error: string;
}

export interface PayrollProcessingResult {
  importId: string;
  totalMembers: number;
  successCount: number;
  failureCount: number;
  totalAmountKobo: number;
  errors: PayrollValidationError[];
}

/**
 * Parse CSV file content into payroll rows
 */
export function parsePayrollCSV(csvContent: string): Result<PayrollRow[], string> {
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return err('CSV file is empty or has no data rows');
    }

    const header = lines[0]!.toLowerCase().split(',').map(h => h.trim());
    const requiredColumns = ['member_id', 'employee_id', 'normal_savings', 'special_savings', 'loan_repayment'];
    
    const missingColumns = requiredColumns.filter(col => !header.includes(col));
    if (missingColumns.length > 0) {
      return err(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const rows: PayrollRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      header.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });

      rows.push({
        memberId: row.member_id || '',
        employeeId: row.employee_id || '',
        normalSavingsKobo: Math.round(parseFloat(row.normal_savings || '0') * 100),
        specialSavingsKobo: Math.round(parseFloat(row.special_savings || '0') * 100),
        loanRepaymentKobo: Math.round(parseFloat(row.loan_repayment || '0') * 100),
        otherDeductionsKobo: Math.round(parseFloat(row.other_deductions || '0') * 100),
        ...(row.other_description && { otherDescription: row.other_description }),
      });
    }

    return ok(rows);
  } catch (error) {
    return err(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate payroll data against database
 */
export async function validatePayrollData(
  rows: PayrollRow[]
): Promise<Result<{ validRows: PayrollRow[]; errors: PayrollValidationError[] }, string>> {
  try {
    const validRows: PayrollRow[] = [];
    const errors: PayrollValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      let hasError = false;

      // Validate member exists
      const member = await db
        .select({ id: users.id, memberId: users.memberId })
        .from(users)
        .where(and(eq(users.memberId, row.memberId), isNull(users.deletedAt)))
        .limit(1);

      if (member.length === 0) {
        errors.push({
          row: i + 2, // +2 because of header and 0-index
          memberId: row.memberId,
          field: 'member_id',
          error: 'Member not found',
        });
        hasError = true;
      }

      // Validate amounts are non-negative
      if (row.normalSavingsKobo < 0) {
        errors.push({
          row: i + 2,
          memberId: row.memberId,
          field: 'normal_savings',
          error: 'Amount cannot be negative',
        });
        hasError = true;
      }

      if (row.specialSavingsKobo < 0) {
        errors.push({
          row: i + 2,
          memberId: row.memberId,
          field: 'special_savings',
          error: 'Amount cannot be negative',
        });
        hasError = true;
      }

      if (row.loanRepaymentKobo < 0) {
        errors.push({
          row: i + 2,
          memberId: row.memberId,
          field: 'loan_repayment',
          error: 'Amount cannot be negative',
        });
        hasError = true;
      }

      if (!hasError) {
        validRows.push(row);
      }
    }

    return ok({ validRows, errors });
  } catch (error) {
    return err(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process payroll batch - create transactions and update balances
 */
export async function processPayrollBatch(
  importId: string,
  rows: PayrollRow[],
  periodMonth: number,
  periodYear: number
): Promise<Result<PayrollProcessingResult, string>> {
  try {
    let successCount = 0;
    let failureCount = 0;
    let totalAmountKobo = 0;
    const errors: PayrollValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      try {
        // Get member
        const member = await db
          .select({ id: users.id, memberId: users.memberId })
          .from(users)
          .where(and(eq(users.memberId, row.memberId), isNull(users.deletedAt)))
          .limit(1);

        if (member.length === 0) {
          throw new Error('Member not found');
        }

        const userId = member[0]!.id;

        // Get savings accounts
        const accounts = await db
          .select()
          .from(savingsAccounts)
          .where(and(eq(savingsAccounts.userId, userId), isNull(savingsAccounts.deletedAt)));

        const normalAccount = accounts.find(a => a.accountType === 'NORMAL');
        const specialAccount = accounts.find(a => a.accountType === 'SPECIAL');

        if (!normalAccount || !specialAccount) {
          throw new Error('Savings accounts not found');
        }

        // Process normal savings
        if (row.normalSavingsKobo > 0) {
          const newBalance = normalAccount.balanceKobo + row.normalSavingsKobo;
          await db
            .update(savingsAccounts)
            .set({ balanceKobo: newBalance })
            .where(eq(savingsAccounts.id, normalAccount.id));

          const txnRef = await generateReference('TXN', 8);
          await db.insert(transactions).values({
            userId,
            accountId: normalAccount.id,
            direction: 'CREDIT',
            amountKobo: row.normalSavingsKobo,
            balanceAfterKobo: newBalance,
            reference: txnRef,
            type: 'PAYROLL_DEDUCTION',
            description: `Payroll deduction - ${periodYear}-${String(periodMonth).padStart(2, '0')}`,
            metadata: { importId, periodMonth, periodYear },
          });
        }

        // Process special savings
        if (row.specialSavingsKobo > 0) {
          const newBalance = specialAccount.balanceKobo + row.specialSavingsKobo;
          await db
            .update(savingsAccounts)
            .set({ balanceKobo: newBalance })
            .where(eq(savingsAccounts.id, specialAccount.id));

          const txnRef = await generateReference('TXN', 8);
          await db.insert(transactions).values({
            userId,
            accountId: specialAccount.id,
            direction: 'CREDIT',
            amountKobo: row.specialSavingsKobo,
            balanceAfterKobo: newBalance,
            reference: txnRef,
            type: 'PAYROLL_DEDUCTION',
            description: `Special savings - ${periodYear}-${String(periodMonth).padStart(2, '0')}`,
            metadata: { importId, periodMonth, periodYear },
          });
        }

        // Process loan repayment
        if (row.loanRepaymentKobo > 0) {
          // Find active loan
          const activeLoans = await db
            .select()
            .from(loans)
            .where(
              and(
                eq(loans.applicantId, userId),
                eq(loans.status, 'ACTIVE'),
                isNull(loans.deletedAt)
              )
            )
            .limit(1);

          if (activeLoans.length > 0) {
            const loan = activeLoans[0]!;
            const newOutstanding = Math.max(0, loan.outstandingKobo - row.loanRepaymentKobo);
            const newStatus = newOutstanding === 0 ? 'COMPLETED' : 'ACTIVE';

            await db
              .update(loans)
              .set({ outstandingKobo: newOutstanding, status: newStatus })
              .where(eq(loans.id, loan.id));

            // Record repayment (would need loan_repayments table)
          }
        }

        // Record deduction
        const totalDeduction = row.normalSavingsKobo + row.specialSavingsKobo + row.loanRepaymentKobo + row.otherDeductionsKobo;
        await db.insert(payrollDeductions).values({
          importId,
          userId,
          normalSavingsKobo: row.normalSavingsKobo,
          specialSavingsKobo: row.specialSavingsKobo,
          loanRepaymentKobo: row.loanRepaymentKobo,
          loanId: null, // Would need to track which loan
          otherDeductionsKobo: row.otherDeductionsKobo,
          otherDescription: row.otherDescription || null,
          totalDeductionKobo: totalDeduction,
          discrepancyFlag: false,
          discrepancyReason: null,
        });

        totalAmountKobo += totalDeduction;
        successCount++;
      } catch (error) {
        errors.push({
          row: i + 2,
          memberId: row.memberId,
          field: 'processing',
          error: error instanceof Error ? error.message : 'Processing failed',
        });
        failureCount++;
      }
    }

    // Update import record
    await db
      .update(payrollImports)
      .set({
        status: errors.length === 0 ? 'CONFIRMED' : 'PARSED',
        totalMembers: rows.length,
        totalAmountKobo,
        parsedAt: new Date(),
        errorLog: errors.length > 0 ? errors : null,
      })
      .where(eq(payrollImports.id, importId));

    return ok({
      importId,
      totalMembers: rows.length,
      successCount,
      failureCount,
      totalAmountKobo,
      errors,
    });
  } catch (error) {
    return err(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
