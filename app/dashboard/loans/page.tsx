/**
 * Loan Eligibility Check Page
 * 
 * Displays current loan eligibility status and available loan amounts.
 * Shows blockers if member is not eligible.
 * 
 * @module app/(dashboard)/loans/page
 */

'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { useRouter } from 'next/navigation';
import { get } from '@/lib/api-client';

interface EligibilityData {
  eligible: boolean;
  eligibilityKobo: number;
  eligibilityFormatted: string;
  blockers: string[];
  activeLongTermCount: number;
  activeShortTermCount: number;
  canApplyLongTerm: boolean;
  canApplyShortTerm: boolean;
  normalSavingsKobo: number;
  normalSavingsFormatted: string;
  outstandingLoansKobo: number;
  outstandingLoansFormatted: string;
}

const BLOCKER_MESSAGES: Record<string, string> = {
  EMPLOYMENT_INACTIVE: 'Your employment status is not active',
  ACCOUNT_NOT_APPROVED: 'Your account has not been approved yet',
  NO_SAVINGS_ON_FILE: 'You have no savings on file',
};

export default function LoanEligibilityPage() {
  const router = useRouter();
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEligibility();
  }, []);

  const fetchEligibility = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await get<EligibilityData>('/api/v1/loans/eligibility');
      
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to fetch eligibility');
      }

      setEligibility(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading eligibility...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2">Error Loading Eligibility</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchEligibility}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!eligibility) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Loan Eligibility</h1>
        <p className="text-muted-foreground">
          Check your current loan eligibility and apply for a loan
        </p>
      </div>

      {/* Eligibility Status Card */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Eligibility Status</h2>
            <div className="flex items-center gap-2">
              {eligibility.eligible ? (
                <>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    ✓ Eligible
                  </span>
                  <span className="text-muted-foreground">
                    You can apply for a loan
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    ✗ Not Eligible
                  </span>
                  <span className="text-muted-foreground">
                    Please resolve the issues below
                  </span>
                </>
              )}
            </div>
          </div>
          {eligibility.eligible && (
            <Button onClick={() => router.push('/loans/apply')}>
              Apply for Loan
            </Button>
          )}
        </div>

        {/* Blockers */}
        {eligibility.blockers.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              Eligibility Blockers:
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {eligibility.blockers.map((blocker, index) => (
                <li key={index} className="text-red-700 dark:text-red-300">
                  {BLOCKER_MESSAGES[blocker] || blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Eligibility Amount */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-primary/5 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              Maximum Eligible Amount
            </div>
            <div className="text-2xl font-bold text-primary">
              {eligibility.eligibilityFormatted}
            </div>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              Normal Savings Balance
            </div>
            <div className="text-2xl font-bold">
              {eligibility.normalSavingsFormatted}
            </div>
          </div>
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              Outstanding Loans
            </div>
            <div className="text-2xl font-bold">
              {eligibility.outstandingLoansFormatted}
            </div>
          </div>
        </div>

        {/* Loan Type Availability */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Short-Term Loans</h3>
              {eligibility.canApplyShortTerm ? (
                <span className="text-green-600 dark:text-green-400">✓ Available</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">✗ Unavailable</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Up to 6 months • 5% interest rate
            </div>
            <div className="text-sm">
              Active loans: {eligibility.activeShortTermCount} / 2
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Long-Term Loans</h3>
              {eligibility.canApplyLongTerm ? (
                <span className="text-green-600 dark:text-green-400">✓ Available</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">✗ Unavailable</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Up to 12 months • 10% interest rate
            </div>
            <div className="text-sm">
              Active loans: {eligibility.activeLongTermCount} / 1
            </div>
          </div>
        </div>
      </Card>

      {/* Information Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">How Loan Eligibility Works</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Eligibility Calculation:</strong> Your maximum loan amount is 3 times your
            Normal Savings balance, minus any outstanding loans.
          </p>
          <p>
            <strong>Short-Term Loans:</strong> Up to 6 months repayment period with 5% flat
            interest rate. You can have up to 2 active short-term loans.
          </p>
          <p>
            <strong>Long-Term Loans:</strong> Up to 12 months repayment period with 10% flat
            interest rate. You can have up to 1 active long-term loan.
          </p>
          <p>
            <strong>Guarantors:</strong> Short-term loans require 2 guarantors, long-term loans
            require 3 guarantors. Guarantors must be active, approved members.
          </p>
          <p>
            <strong>Approval Process:</strong> All loans go through a multi-stage approval process
            including guarantor consent, committee review, and treasurer approval.
          </p>
        </div>
      </Card>
    </div>
  );
}

