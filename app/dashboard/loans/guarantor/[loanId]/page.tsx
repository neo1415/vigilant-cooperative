/**
 * Guarantor Consent Page
 * 
 * Allows guarantors to review loan applications and provide consent or decline.
 * Displays loan details, applicant information, and guarantor's current exposure.
 * 
 * @module app/(dashboard)/loans/guarantor/[loanId]/page
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { apiClient, get } from '@/lib/api-client';
import { getUserFromToken } from '@/lib/auth';

interface LoanForGuarantor {
  id: string;
  loanReference: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: number;
  principalFormatted: string;
  interestRateBps: number;
  interestKobo: number;
  interestFormatted: string;
  totalRepayableKobo: number;
  totalRepayableFormatted: string;
  monthlyInstallmentKobo: number;
  monthlyInstallmentFormatted: string;
  repaymentMonths: number;
  purpose: string;
  purposeDetail?: string;
  status: string;
  submittedAt: string;
  applicant: {
    id: string;
    memberId: string;
    fullName: string;
    email?: string;
    department?: string;
  };
  guarantorStatus: 'PENDING' | 'CONSENTED' | 'DECLINED';
  guarantorExposureKobo: number;
  guarantorExposureFormatted: string;
  otherGuarantors: Array<{
    id: string;
    memberId: string;
    fullName: string;
    status: string;
  }>;
}

export default function GuarantorConsentPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string;

  const [loan, setLoan] = useState<LoanForGuarantor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineError, setDeclineError] = useState('');

  const currentUser = getUserFromToken();

  const fetchLoanDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await get<LoanForGuarantor>(`/api/v1/loans/${loanId}/guarantor`);

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load loan details');
      }

      setLoan(result.data);
    } catch (err) {
      console.error('Failed to fetch loan details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load loan details');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchLoanDetails();
  }, [fetchLoanDetails]);

  async function handleConsent() {
    setActionLoading(true);

    try {
      const response = await apiClient(`/api/v1/loans/${loanId}/guarantors/${currentUser?.id}/consent`, {
        method: 'POST',
        body: JSON.stringify({ consent: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to provide consent');
      }

      // Success - redirect to loans list
      router.push('/dashboard/loans/list?consent=success');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
      setShowConsentModal(false);
    }
  }

  async function handleDecline() {
    setDeclineError('');

    if (!declineReason || declineReason.trim().length < 10) {
      setDeclineError('Please provide a reason (at least 10 characters)');
      return;
    }

    setActionLoading(true);

    try {
      const response = await apiClient(`/api/v1/loans/${loanId}/guarantors/${currentUser?.id}/consent`, {
        method: 'POST',
        body: JSON.stringify({
          consent: false,
          declineReason: declineReason.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to decline');
      }

      // Success - redirect to loans list
      router.push('/dashboard/loans/list?declined=success');
    } catch (err) {
      setDeclineError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <Card className="max-w-md">
          <CardContent>
            <p className="text-center mb-4" style={{ color: 'rgb(var(--color-accent))' }}>
              {error || 'Loan not found'}
            </p>
            <Button onClick={() => router.push('/dashboard/loans/list')} className="w-full">
              Back to Loans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already responded
  const hasResponded = loan.guarantorStatus !== 'PENDING';

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard/loans/list')} className="mb-2">
            ← Back to Loans
          </Button>
          <h1 className="font-display text-4xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
            Guarantor Request
          </h1>
          <p className="font-mono text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {loan.loanReference}
          </p>
        </div>

        {/* Status Banner */}
        {hasResponded && (
          <div className={`p-4 rounded-lg border ${
            loan.guarantorStatus === 'CONSENTED'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <p className={`font-semibold ${
              loan.guarantorStatus === 'CONSENTED'
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}>
              {loan.guarantorStatus === 'CONSENTED'
                ? '✓ You have already provided consent for this loan'
                : '✗ You have declined this loan request'}
            </p>
          </div>
        )}

        {/* Applicant Information */}
        <Card>
          <CardHeader>
            <CardTitle>Applicant Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Member ID</p>
                <p className="font-mono font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {loan.applicant.memberId}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Full Name</p>
                <p className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {loan.applicant.fullName}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Department</p>
                <p style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {loan.applicant.department || 'Not provided'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Loan Type</p>
                  <p className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {loan.loanType === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term'}
                  </p>
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    {loan.repaymentMonths} months • {loan.interestRateBps / 100}% interest
                  </p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Application Date</p>
                  <p className="text-lg" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {formatDate(loan.submittedAt)}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Principal Amount</p>
                    <p className="font-mono text-2xl font-bold" style={{ color: 'rgb(var(--color-primary))' }}>
                      {loan.principalFormatted}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Interest</p>
                    <p className="font-mono text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {loan.interestFormatted}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Total Repayable</p>
                    <p className="font-mono text-2xl font-bold" style={{ color: 'rgb(var(--color-secondary))' }}>
                      {loan.totalRepayableFormatted}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Monthly Installment</p>
                    <p className="font-mono text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {loan.monthlyInstallmentFormatted}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Purpose</p>
                <p className="text-lg mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>{loan.purpose}</p>
                {loan.purposeDetail && (
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    {loan.purposeDetail}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Your Guarantor Exposure */}
        <Card>
          <CardHeader>
            <CardTitle>Your Guarantor Exposure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Current Total Exposure (including this loan if approved)
              </p>
              <p className="font-mono text-3xl font-bold text-yellow-800 dark:text-yellow-200">
                {loan.guarantorExposureFormatted}
              </p>
              <p className="text-xs mt-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                This is the total amount you would be liable for if all loans you guarantee default.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Other Guarantors */}
        {loan.otherGuarantors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Other Guarantors ({loan.otherGuarantors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loan.otherGuarantors.map((guarantor) => (
                  <div
                    key={guarantor.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}
                  >
                    <div>
                      <p className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                        {guarantor.fullName}
                      </p>
                      <p className="text-sm font-mono" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        {guarantor.memberId}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      guarantor.status === 'CONSENTED'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : guarantor.status === 'DECLINED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {guarantor.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {!hasResponded && (
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => setShowDeclineModal(true)}
              className="flex-1 border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              disabled={actionLoading}
            >
              Decline Request
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowConsentModal(true)}
              className="flex-1"
              disabled={actionLoading}
            >
              Provide Consent
            </Button>
          </div>
        )}

        {/* Consent Confirmation Modal */}
        <Modal
          isOpen={showConsentModal}
          onClose={() => setShowConsentModal(false)}
          title="Confirm Consent"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Important: Understand Your Responsibility
              </p>
              <ul className="text-sm space-y-1 text-yellow-700 dark:text-yellow-300">
                <li>• You are guaranteeing {loan.principalFormatted} for {loan.applicant.fullName}</li>
                <li>• If the applicant defaults, you may be liable for repayment</li>
                <li>• Your total exposure will be {loan.guarantorExposureFormatted}</li>
                <li>• This consent cannot be revoked once provided</li>
              </ul>
            </div>

            <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
              By providing consent, you confirm that you understand and accept the responsibilities of being a guarantor for this loan.
            </p>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowConsentModal(false)}
                className="flex-1"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConsent}
                className="flex-1"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'I Consent'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Decline Modal */}
        <Modal
          isOpen={showDeclineModal}
          onClose={() => {
            setShowDeclineModal(false);
            setDeclineReason('');
            setDeclineError('');
          }}
          title="Decline Guarantor Request"
          size="md"
        >
          <div className="space-y-4">
            <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Please provide a reason for declining this guarantor request. This will be shared with the applicant.
            </p>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                Reason for Declining *
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                placeholder="Please explain why you are declining this request (minimum 10 characters)..."
                maxLength={500}
              />
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                {declineReason.length}/500 characters (minimum 10 required)
              </p>
            </div>

            {declineError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">{declineError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineReason('');
                  setDeclineError('');
                }}
                className="flex-1"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDecline}
                className="flex-1 bg-red-500 hover:bg-red-600"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Decline Request'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

