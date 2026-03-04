/**
 * Treasurer Loan Disbursement Interface
 * 
 * Allows treasurer to disburse approved loans.
 * Displays loans approved and ready for disbursement.
 * 
 * @module app/(dashboard)/loans/disburse/page
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { apiClient, get } from '@/lib/api-client';

interface LoanForDisbursement {
  id: string;
  loanReference: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: number;
  principalFormatted: string;
  totalRepayableFormatted: string;
  monthlyInstallmentFormatted: string;
  repaymentMonths: number;
  status: string;
  submittedAt: string;
  applicant: {
    id: string;
    memberId: string;
    fullName: string;
    bankAccountNumber?: string;
    bankName?: string;
    monnifyAccountNumber?: string;
  };
  approvalHistory: Array<{
    approverName: string;
    approverRole: string;
    action: string;
    createdAt: string;
  }>;
}

export default function LoanDisbursementPage() {
  const router = useRouter();
  
  const [loans, setLoans] = useState<LoanForDisbursement[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanForDisbursement | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disbursementError, setDisbursementError] = useState('');

  const fetchApprovedLoans = useCallback(async () => {
    setLoading(true);
    try {
      const result = await get<{ loans: LoanForDisbursement[] }>('/api/v1/loans/approved-for-disbursement');
      
      if (result.success && result.data) {
        setLoans(result.data.loans || []);
      }
    } catch {
      console.error('Failed to fetch approved loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovedLoans();
  }, [fetchApprovedLoans]);

  async function handleDisburse() {
    if (!selectedLoan) return;
    
    setDisbursementError('');
    setActionLoading(true);
    
    try {
      const response = await apiClient(`/api/v1/loans/${selectedLoan.id}/disburse`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to disburse loan');
      }
      
      // Success - refresh list
      await fetchApprovedLoans();
      setShowDisburseModal(false);
      setSelectedLoan(null);
      
      // Show success message
      alert(`Loan ${selectedLoan.loanReference} disbursed successfully!`);
    } catch (err) {
      setDisbursementError(err instanceof Error ? err.message : 'An error occurred');
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

  function openDisburseModal(loan: LoanForDisbursement) {
    setSelectedLoan(loan);
    setDisbursementError('');
    setShowDisburseModal(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading approved loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-4xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
            Loan Disbursement
          </h1>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Disburse approved loans to members
          </p>
        </div>

        {/* Approved Loans List */}
        <Card>
          <CardHeader>
            <CardTitle>Ready for Disbursement ({loans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loans.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  No loans ready for disbursement
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-6 rounded-lg border"
                    style={{ 
                      backgroundColor: 'rgb(var(--color-surface-elevated))',
                      borderColor: 'rgb(var(--color-border))'
                    }}
                  >
                    {/* Loan Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-mono text-sm font-semibold mb-1" style={{ color: 'rgb(var(--color-primary))' }}>
                          {loan.loanReference}
                        </p>
                        <p className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {loan.loanType === 'SHORT_TERM' ? 'Short-Term Loan' : 'Long-Term Loan'}
                        </p>
                        <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Submitted: {formatDate(loan.submittedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Disbursement Amount</p>
                        <p className="font-mono text-3xl font-bold" style={{ color: 'rgb(var(--color-primary))' }}>
                          {loan.principalFormatted}
                        </p>
                      </div>
                    </div>

                    {/* Applicant Information */}
                    <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Applicant Information
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Member ID</p>
                          <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.memberId}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Name</p>
                          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.fullName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Bank Account</p>
                          <p className="text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.bankAccountNumber || 'Not provided'}
                          </p>
                          {loan.applicant.bankName && (
                            <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                              {loan.applicant.bankName}
                            </p>
                          )}
                        </div>
                      </div>
                      {loan.applicant.monnifyAccountNumber && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgb(var(--color-border))' }}>
                          <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            Monnify Virtual Account
                          </p>
                          <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-primary))' }}>
                            {loan.applicant.monnifyAccountNumber}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Loan Details */}
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Total Repayable</p>
                        <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-secondary))' }}>
                          {loan.totalRepayableFormatted}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Monthly Installment</p>
                        <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {loan.monthlyInstallmentFormatted}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Repayment Period</p>
                        <p className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {loan.repaymentMonths} months
                        </p>
                      </div>
                    </div>

                    {/* Approval History */}
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Approval History
                      </p>
                      <div className="space-y-2">
                        {loan.approvalHistory.map((approval, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded text-sm"
                            style={{ backgroundColor: 'rgb(var(--color-background))' }}
                          >
                            <span className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                              {approval.approverName}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {approval.approverRole}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {approval.action}
                            </span>
                            <span className="text-xs ml-auto" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                              {formatDate(approval.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Disburse Button */}
                    <Button
                      variant="primary"
                      onClick={() => openDisburseModal(loan)}
                      className="w-full"
                    >
                      Disburse Loan
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disburse Confirmation Modal */}
        <Modal
          isOpen={showDisburseModal}
          onClose={() => setShowDisburseModal(false)}
          title="Confirm Loan Disbursement"
          size="md"
        >
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Confirm Disbursement
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  You are about to disburse {selectedLoan.principalFormatted} to {selectedLoan.applicant.fullName}.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Loan Reference: {selectedLoan.loanReference}
                </p>
              </div>

              {selectedLoan.applicant.monnifyAccountNumber ? (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    Transfer Details
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Account Number:</span>
                      <span className="font-mono font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                        {selectedLoan.applicant.monnifyAccountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Amount:</span>
                      <span className="font-mono font-semibold" style={{ color: 'rgb(var(--color-primary))' }}>
                        {selectedLoan.principalFormatted}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ No Monnify account found. Manual transfer may be required.
                  </p>
                </div>
              )}

              {disbursementError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">{disbursementError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowDisburseModal(false)}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDisburse}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Disbursement'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
