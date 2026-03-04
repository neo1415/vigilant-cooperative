/**
 * Loan Details Page
 * 
 * Displays complete loan information including:
 * - Loan details and status
 * - Applicant information (officers only)
 * - Guarantor list with consent status
 * - Approval workflow progress
 * - Repayment schedule
 * - Transaction history
 * - Action buttons based on role and status
 * 
 * @module app/(dashboard)/loans/[id]/page
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';

interface LoanDetails {
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
  outstandingKobo: number;
  outstandingFormatted: string;
  repaymentMonths: number;
  purpose: string;
  purposeDetail?: string;
  status: string;
  submittedAt: string;
  disbursedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionReason?: string;
  applicant?: {
    id: string;
    memberId: string;
    fullName: string;
    email?: string;
    department?: string;
  };
  guarantors: Guarantor[];
  approvals: Approval[];
  repayments: Repayment[];
  repaymentSchedule: ScheduleItem[];
}

interface Guarantor {
  id: string;
  guarantorId: string;
  memberId: string;
  fullName: string;
  status: string;
  consentedAt: string | null;
  declinedAt: string | null;
  declineReason?: string;
}

interface Approval {
  id: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: string;
  previousAmountKobo?: number;
  previousAmountFormatted?: string;
  newAmountKobo?: number;
  newAmountFormatted?: string;
  comments?: string;
  createdAt: string;
}

interface Repayment {
  id: string;
  amountKobo: number;
  amountFormatted: string;
  paymentDate: string;
  paymentReference: string;
  paymentMethod: string;
  recordedBy: string;
  createdAt: string;
}

interface ScheduleItem {
  month: number;
  dueDate: string;
  installmentKobo: number;
  installmentFormatted: string;
  remainingBalanceKobo: number;
  remainingBalanceFormatted: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  GUARANTOR_CONSENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PRESIDENT_REVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  COMMITTEE_REVIEW: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  TREASURER_REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  DISBURSED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  GUARANTOR_CONSENT: 'Awaiting Guarantors',
  PRESIDENT_REVIEW: 'President Review',
  COMMITTEE_REVIEW: 'Committee Review',
  TREASURER_REVIEW: 'Treasurer Review',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const GUARANTOR_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  CONSENTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DECLINED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function LoanDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.id as string;
  
  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoanDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient(`/api/v1/loans/${loanId}`);

      if (response.ok) {
        const data = await response.json();
        setLoan(data.data);
      } else {
        const errorData = await response.json();
        setError(errorData.error?.message || 'Failed to load loan details');
      }
    } catch (err) {
      console.error('Failed to fetch loan details:', err);
      setError('Failed to load loan details');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchLoanDetails();
  }, [fetchLoanDetails]);

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
            <Button onClick={() => router.push('/loans/list')} className="w-full">
              Back to Loans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.push('/loans/list')} className="mb-2">
              ← Back to Loans
            </Button>
            <h1 className="font-display text-4xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
              Loan Details
            </h1>
            <p className="font-mono text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {loan.loanReference}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-800'}`}>
              {STATUS_LABELS[loan.status] || loan.status}
            </span>
          </div>
        </div>

        {/* Loan Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Loan Type</p>
                <p className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {loan.loanType === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term'}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Principal Amount</p>
                <p className="font-mono text-2xl font-bold" style={{ color: 'rgb(var(--color-primary))' }}>
                  {loan.principalFormatted}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Interest ({loan.interestRateBps / 100}%)</p>
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
              <div>
                <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Outstanding Balance</p>
                <p className="font-mono text-2xl font-bold" style={{ color: 'rgb(var(--color-accent))' }}>
                  {loan.outstandingFormatted}
                </p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgb(var(--color-border))' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Purpose</p>
                  <p className="text-lg" style={{ color: 'rgb(var(--color-text-primary))' }}>{loan.purpose}</p>
                  {loan.purposeDetail && (
                    <p className="text-sm mt-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      {loan.purposeDetail}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>Repayment Period</p>
                  <p className="text-lg" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {loan.repaymentMonths} months
                  </p>
                  <p className="text-sm mt-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Submitted: {formatDate(loan.submittedAt)}
                  </p>
                  {loan.disbursedAt && (
                    <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      Disbursed: {formatDate(loan.disbursedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applicant Details (Officers Only) */}
        {loan.applicant && (
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
        )}

        {/* Guarantors */}
        <Card>
          <CardHeader>
            <CardTitle>Guarantors ({loan.guarantors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loan.guarantors.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                No guarantors assigned
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loan.guarantors.map((guarantor) => (
                    <TableRow key={guarantor.id}>
                      <TableCell>
                        <span className="font-mono text-xs">{guarantor.memberId}</span>
                      </TableCell>
                      <TableCell>{guarantor.fullName}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${GUARANTOR_STATUS_COLORS[guarantor.status] || 'bg-gray-100 text-gray-800'}`}>
                          {guarantor.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {guarantor.consentedAt
                          ? formatDate(guarantor.consentedAt)
                          : guarantor.declinedAt
                          ? formatDate(guarantor.declinedAt)
                          : 'Pending'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Approval Workflow */}
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            {loan.approvals.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                No approvals yet
              </p>
            ) : (
              <div className="space-y-4">
                {loan.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {approval.approverName}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {approval.approverRole}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            approval.action === 'APPROVED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {approval.action}
                          </span>
                        </div>
                        {approval.comments && (
                          <p className="text-sm mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            {approval.comments}
                          </p>
                        )}
                        {approval.previousAmountKobo && approval.newAmountKobo && (
                          <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            Amount adjusted: {approval.previousAmountFormatted} → {approval.newAmountFormatted}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        {formatDate(approval.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repayment Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Repayment Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead align="right">Installment</TableHead>
                  <TableHead align="right">Remaining Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loan.repaymentSchedule.map((item) => (
                  <TableRow key={item.month}>
                    <TableCell>{item.month}</TableCell>
                    <TableCell>{formatDate(item.dueDate)}</TableCell>
                    <TableCell align="right">
                      <span className="font-mono">{item.installmentFormatted}</span>
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-mono">{item.remainingBalanceFormatted}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Repayment History */}
        <Card>
          <CardHeader>
            <CardTitle>Repayment History</CardTitle>
          </CardHeader>
          <CardContent>
            {loan.repayments.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                No repayments yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead align="right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loan.repayments.map((repayment) => (
                    <TableRow key={repayment.id}>
                      <TableCell>{formatDate(repayment.paymentDate)}</TableCell>
                      <TableCell align="right">
                        <span className="font-mono font-semibold">{repayment.amountFormatted}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{repayment.paymentMethod.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{repayment.paymentReference}</span>
                      </TableCell>
                      <TableCell>{repayment.recordedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
