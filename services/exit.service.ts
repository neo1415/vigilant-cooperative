import { db } from '../server/db/init';
import { memberExits, savingsAccounts, loans, loanGuarantors } from '../server/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { ok, err, type Result } from '../types/result';
import { generateReference } from '../utils/reference';

export interface ExitCalculation {
  normalSavingsBalanceKobo: number;
  specialSavingsBalanceKobo: number;
  outstandingLoansKobo: number;
  guarantorExposureKobo: number;
  finalPayoutKobo: number;
  canExit: boolean;
  blockingReasons: string[];
}

/**
 * Calculate member exit settlement
 */
export async function calculateExitSettlement(userId: string): Promise<Result<ExitCalculation, string>> {
  try {
    // Get savings balances
    const accounts = await db
      .select()
      .from(savingsAccounts)
      .where(and(eq(savingsAccounts.userId, userId), isNull(savingsAccounts.deletedAt)));

    const normalAccount = accounts.find(a => a.accountType === 'NORMAL');
    const specialAccount = accounts.find(a => a.accountType === 'SPECIAL');

    const normalSavingsBalanceKobo = normalAccount?.balanceKobo || 0;
    const specialSavingsBalanceKobo = specialAccount?.balanceKobo || 0;

    // Get outstanding loans
    const activeLoans = await db
      .select()
      .from(loans)
      .where(
        and(
          eq(loans.applicantId, userId),
          inArray(loans.status, ['SUBMITTED', 'APPROVED', 'DISBURSED', 'ACTIVE']),
          isNull(loans.deletedAt)
        )
      );

    const outstandingLoansKobo = activeLoans.reduce((sum, loan) => sum + loan.outstandingKobo, 0);

    // Get guarantor exposure
    const guaranteedLoans = await db
      .select({ loanId: loanGuarantors.loanId })
      .from(loanGuarantors)
      .where(and(eq(loanGuarantors.guarantorId, userId), eq(loanGuarantors.status, 'CONSENTED')));

    const guaranteedLoanIds = guaranteedLoans.map(g => g.loanId);
    let guarantorExposureKobo = 0;

    if (guaranteedLoanIds.length > 0) {
      const guaranteedLoanDetails = await db
        .select()
        .from(loans)
        .where(
          and(
            inArray(loans.id, guaranteedLoanIds),
            inArray(loans.status, ['DISBURSED', 'ACTIVE']),
            isNull(loans.deletedAt)
          )
        );

      guarantorExposureKobo = guaranteedLoanDetails.reduce((sum, loan) => sum + loan.outstandingKobo, 0);
    }

    // Calculate final payout
    const totalSavings = normalSavingsBalanceKobo + specialSavingsBalanceKobo;
    const finalPayoutKobo = Math.max(0, totalSavings - outstandingLoansKobo);

    // Check if member can exit
    const blockingReasons: string[] = [];
    if (outstandingLoansKobo > 0) {
      blockingReasons.push(`Outstanding loan balance: ₦${(outstandingLoansKobo / 100).toFixed(2)}`);
    }
    if (guarantorExposureKobo > 0) {
      blockingReasons.push(
        `Active guarantor obligations: ₦${(guarantorExposureKobo / 100).toFixed(2)}`
      );
    }

    const canExit = blockingReasons.length === 0;

    return ok({
      normalSavingsBalanceKobo,
      specialSavingsBalanceKobo,
      outstandingLoansKobo,
      guarantorExposureKobo,
      finalPayoutKobo,
      canExit,
      blockingReasons,
    });
  } catch (error) {
    return err(`Failed to calculate exit settlement: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Initiate member exit
 */
export async function initiateExit(userId: string): Promise<Result<string, string>> {
  try {
    // Calculate settlement
    const calculation = await calculateExitSettlement(userId);
    if (!calculation.success) {
      return err(calculation.error);
    }

    if (!calculation.value.canExit) {
      return err(`Cannot initiate exit: ${calculation.value.blockingReasons.join(', ')}`);
    }

    // Create exit record
    const exitReference = await generateReference('EXIT');
    const [exitRecord] = await db
      .insert(memberExits)
      .values({
        userId,
        exitReference,
        status: 'INITIATED',
        normalSavingsBalanceKobo: calculation.value.normalSavingsBalanceKobo,
        specialSavingsBalanceKobo: calculation.value.specialSavingsBalanceKobo,
        outstandingLoansKobo: calculation.value.outstandingLoansKobo,
        guarantorExposureKobo: calculation.value.guarantorExposureKobo,
        finalPayoutKobo: calculation.value.finalPayoutKobo,
        settlementPdfUrl: null,
        initiatedAt: new Date(),
      })
      .returning();

    // Lock savings accounts
    await db
      .update(savingsAccounts)
      .set({ isLocked: true })
      .where(and(eq(savingsAccounts.userId, userId), isNull(savingsAccounts.deletedAt)));

    return ok(exitRecord!.id);
  } catch (error) {
    return err(`Failed to initiate exit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Approve member exit (treasurer only)
 */
export async function approveExit(exitId: string, treasurerId: string): Promise<Result<void, string>> {
  try {
    await db
      .update(memberExits)
      .set({
        status: 'APPROVED',
        approvedBy: treasurerId,
        approvedAt: new Date(),
      })
      .where(eq(memberExits.id, exitId));

    return ok(undefined);
  } catch (error) {
    return err(`Failed to approve exit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
