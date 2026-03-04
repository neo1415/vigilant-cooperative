/**
 * Officer Loan Approval Interface
 * 
 * Allows officers (President, Committee, Treasurer) to review and approve/reject loans.
 * Displays pending loans for review based on user role.
 * 
 * @module app/(dashboard)/loans/approve/page
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiClient, get } from '@/lib/api-client';
import { getUserFromToken } from '@/lib/auth';

interface LoanForApproval {
  id: string;
  loanReference: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: number;
  principalFormatted: string;
  interestRateBps: number;
  interestFormatted: string;
  totalRepayableFormatted: string;
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
    department?: string;
    employmentStatus: string;
    normalSavingsBalance: string;
    specialSavingsBalance: string;
    activeLoanCount: number;
    outstandingLoansTotal: string;
  };
  guarantors: Array<{
    id: string;
    memberId: string;
    fullName: string;
    status: string;
    consentedAt: string | null;
  }>;
  approvalHistory: Array<{
    approverName: string;
    approverRole: string;
    action: string;
    comments?: string;
    createdAt: string;
  }>;
}

export default function LoanApprovalPage() {
  const router = useRouter();
  const currentUser = getUserFromToken();
  
  const [loans, setLoans] = useState<LoanForApproval[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanForApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [approvalComments, setApprovalComments] = useState('');

  const fetchPendingLoans = useCallback(async () => {
    setLoading(true);
    try {
      const result = await get<{ loans: LoanForApproval[] }>('/api/v1/loans/pending-approval');
      
      if (result.success && result.data) {
        setLoans(result.data.loans || []);
      }
    } catch {
      console.error('Failed to fetch pending loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingLoans();
  }, [fetchPendingLoans]);

  async function handleApprove() {
    if (!selectedLoan) return;
    
    setActionLoading(true);
    
    try {
      const response = await apiClient(`/api/v1/loans/${selectedLoan.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ 
          comments: approvalComments.trim() || undefined 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to approve loan');
      }
      
      // Success - refresh list
      await fetchPendingLoans();
      setShowApproveModal(false);
      setSelectedLoan(null);
      setApprovalComments('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedLoan) return;
    
    setRejectionError('');
    
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      setRejectionError('Please provide a reason (at least 10 characters)');
      return;
    }
    
    setActionLoading(true);
    
    try {
      const response = await apiClient(`/api/v1/loans/${selectedLoan.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ 
          reason: rejectionReason.trim()
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to reject loan');
      }
      
      // Success - refresh list
      await fetchPendingLoans();
      setShowRejectModal(false);
      setSelectedLoan(null);
      setRejectionReason('');
    } catch (err) {
      setRejectionError(err instanceof Error ? err.message : 'An error occurred');
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

  function openApproveModal(loan: LoanForApproval) {
    setSelectedLoan(loan);
    setApprovalComments('');
    setShowApproveModal(true);
  }

  function openRejectModal(loan: LoanForApproval) {
    setSelectedLoan(loan);
    setRejectionReason('');
    setRejectionError('');
    setShowRejectModal(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading pending loans...</p>
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
            Loan Approvals
          </h1>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Review and approve pending loan applications
          </p>
        </div>

        {/* Pending Loans List */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals ({loans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loans.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  No pending loan approvals
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
                        <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Amount</p>
                        <p className="font-mono text-2xl font-bold" style={{ color: 'rgb(var(--color-primary))' }}>
                          {loan.principalFormatted}
                        </p>
                      </div>
                    </div>

                    {/* Applicant Information */}
                    <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Applicant Information
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Department</p>
                          <p className="text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.department || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Status</p>
                          <p className="text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.employmentStatus}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Financial Summary
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Normal Savings</p>
                          <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.normalSavingsBalance}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Special Savings</p>
                          <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.specialSavingsBalance}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Active Loans</p>
                          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.activeLoanCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>Outstanding</p>
                          <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {loan.applicant.outstandingLoansTotal}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Loan Details */}
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Interest ({loan.interestRateBps / 100}%)</p>
                        <p className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {loan.interestFormatted}
                        </p>
                      </div>
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

                    {/* Purpose */}
                    <div className="mb-4">
                      <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Purpose</p>
                      <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>{loan.purpose}</p>
                      {loan.purposeDetail && (
                        <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          {loan.purposeDetail}
                        </p>
                      )}
                    </div>

                    {/* Guarantors */}
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Guarantors ({loan.guarantors.length})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {loan.guarantors.map((guarantor) => (
                          <div
                            key={guarantor.id}
                            className="flex items-center justify-between p-2 rounded"
                            style={{ backgroundColor: 'rgb(var(--color-background))' }}
                          >
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                                {guarantor.fullName}
                              </p>
                              <p className="text-xs font-mono" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                                {guarantor.memberId}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
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
                    </div>

                    {/* Approval History */}
                    {loan.approvalHistory.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Approval History
                        </p>
                        <div className="space-y-2">
                          {loan.approvalHistory.map((approval, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded text-sm"
                              style={{ backgroundColor: 'rgb(var(--color-background))' }}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                                  {approval.approverName}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {approval.approverRole}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  approval.action === 'APPROVED'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {approval.action}
                                </span>
                              </div>
                              {approval.comments && (
                                <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                                  {approval.comments}
                                </p>
                              )}
                              <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                                {formatDate(approval.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => openRejectModal(loan)}
                        className="flex-1 border-2 border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => openApproveModal(loan)}
                        className="flex-1"
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approve Modal */}
        <Modal
          isOpen={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          title="Approve Loan"
          size="md"
        >
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  Confirm Loan Approval
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You are about to approve loan {selectedLoan.loanReference} for {selectedLoan.principalFormatted}.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Comments (Optional)
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Add any comments about this approval..."
                  maxLength={500}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApprove}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Approval'}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Reject Modal */}
        <Modal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setRejectionReason('');
            setRejectionError('');
          }}
          title="Reject Loan"
          size="md"
        >
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="font-semibold text-red-800 dark:text-red-200 mb-2">
                  Confirm Loan Rejection
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  You are about to reject loan {selectedLoan.loanReference}. This action cannot be undone.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={4}
                  placeholder="Please explain why this loan is being rejected (minimum 10 characters)..."
                  maxLength={500}
                />
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {rejectionReason.length}/500 characters (minimum 10 required)
                </p>
              </div>

              {rejectionError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">{rejectionError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                    setRejectionError('');
                  }}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleReject}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
