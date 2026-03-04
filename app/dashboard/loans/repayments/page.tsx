/**
 * Loan Repayment Recording Interface
 * 
 * Allows officers to record loan repayments.
 * Displays active loans with outstanding balances.
 * 
 * @module app/(dashboard)/loans/repayments/page
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiClient, get } from '@/lib/api-client';

interface ActiveLoan {
  id: string;
  loanReference: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalFormatted: string;
  totalRepayableFormatted: string;
  outstandingKobo: number;
  outstandingFormatted: string;
  monthlyInstallmentFormatted: string;
  disbursedAt: string;
  applicant: {
    memberId: string;
    fullName: string;
  };
  repayments: Array<{
    id: string;
    amountFormatted: string;
    paymentDate: string;
    paymentReference: string;
    paymentMethod: string;
  }>;
}

export default function LoanRepaymentsPage() {
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  
  const [repaymentForm, setRepaymentForm] = useState({
    amountNaira: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentReference: '',
    paymentMethod: 'PAYROLL_DEDUCTION',
  });
  const [repaymentError, setRepaymentError] = useState('');

  const fetchActiveLoans = useCallback(async () => {
    setLoading(true);
    try {
      const result = await get<{ loans: ActiveLoan[] }>('/api/v1/loans/active');
      
      if (result.success && result.data) {
        setLoans(result.data.loans || []);
      }
    } catch {
      console.error('Failed to fetch active loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveLoans();
  }, [fetchActiveLoans]);

  async function handleRecordRepayment() {
    if (!selectedLoan) return;
    
    setRepaymentError('');
    
    // Validation
    const amountNaira = parseFloat(repaymentForm.amountNaira);
    if (!amountNaira || amountNaira <= 0) {
      setRepaymentError('Please enter a valid amount');
      return;
    }
    
    if (!repaymentForm.paymentReference || repaymentForm.paymentReference.trim().length < 3) {
      setRepaymentError('Please enter a valid payment reference (at least 3 characters)');
      return;
    }
    
    if (!repaymentForm.paymentDate) {
      setRepaymentError('Please select a payment date');
      return;
    }
    
    setActionLoading(true);
    
    try {
      const amountKobo = Math.floor(amountNaira * 100);
      
      const response = await apiClient(`/api/v1/loans/${selectedLoan.id}/repayments`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          amountKobo,
          paymentDate: repaymentForm.paymentDate,
          paymentReference: repaymentForm.paymentReference.trim(),
          paymentMethod: repaymentForm.paymentMethod,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to record repayment');
      }
      
      // Success - refresh list
      await fetchActiveLoans();
      setShowRepaymentModal(false);
      setSelectedLoan(null);
      setRepaymentForm({
        amountNaira: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentReference: '',
        paymentMethod: 'PAYROLL_DEDUCTION',
      });
      
      alert('Repayment recorded successfully!');
    } catch (err) {
      setRepaymentError(err instanceof Error ? err.message : 'An error occurred');
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

  function openRepaymentModal(loan: ActiveLoan) {
    setSelectedLoan(loan);
    setRepaymentError('');
    setRepaymentForm({
      amountNaira: (loan.outstandingKobo / 100).toFixed(2),
      paymentDate: new Date().toISOString().split('T')[0],
      paymentReference: '',
      paymentMethod: 'PAYROLL_DEDUCTION',
    });
    setShowRepaymentModal(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading active loans...</p>
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
            Loan Repayments
          </h1>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Record loan repayments and view repayment history
          </p>
        </div>

        {/* Active Loans List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Loans ({loans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loans.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  No active loans
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead align="right">Total</TableHead>
                    <TableHead align="right">Outstanding</TableHead>
                    <TableHead>Disbursed</TableHead>
                    <TableHead align="center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold">{loan.loanReference}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{loan.applicant.fullName}</div>
                          <div className="text-xs text-muted-foreground">{loan.applicant.memberId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {loan.loanType === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term'}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono font-semibold">{loan.totalRepayableFormatted}</span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono font-bold" style={{ color: 'rgb(var(--color-accent))' }}>
                          {loan.outstandingFormatted}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDate(loan.disbursedAt)}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="primary"
                          onClick={() => openRepaymentModal(loan)}
                          className="text-xs px-3 py-1"
                        >
                          Record Payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Repayment Modal */}
        <Modal
          isOpen={showRepaymentModal}
          onClose={() => setShowRepaymentModal(false)}
          title="Record Loan Repayment"
          size="md"
        >
          {selectedLoan && (
            <div className="space-y-4">
              {/* Loan Summary */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Loan Details
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Reference:</span>
                    <span className="font-mono font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {selectedLoan.loanReference}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Applicant:</span>
                    <span className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {selectedLoan.applicant.fullName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Outstanding Balance:</span>
                    <span className="font-mono font-bold" style={{ color: 'rgb(var(--color-accent))' }}>
                      {selectedLoan.outstandingFormatted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Monthly Installment:</span>
                    <span className="font-mono font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {selectedLoan.monthlyInstallmentFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Repayment Form */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Amount (₦) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={repaymentForm.amountNaira}
                  onChange={(e) => setRepaymentForm(prev => ({ ...prev, amountNaira: e.target.value }))}
                  placeholder="0.00"
                />
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Maximum: {selectedLoan.outstandingFormatted}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Payment Date *
                </label>
                <Input
                  type="date"
                  value={repaymentForm.paymentDate}
                  onChange={(e) => setRepaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Payment Reference *
                </label>
                <Input
                  type="text"
                  value={repaymentForm.paymentReference}
                  onChange={(e) => setRepaymentForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                  placeholder="e.g., PAY-2026-001, TXN-12345"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Payment Method *
                </label>
                <Select
                  value={repaymentForm.paymentMethod}
                  onChange={(e) => setRepaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  options={[
                    { value: 'PAYROLL_DEDUCTION', label: 'Payroll Deduction' },
                    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                    { value: 'CASH', label: 'Cash' },
                    { value: 'MANUAL', label: 'Manual' },
                  ]}
                />
              </div>

              {repaymentError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">{repaymentError}</p>
                </div>
              )}

              {/* Repayment History */}
              {selectedLoan.repayments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Recent Repayments
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {selectedLoan.repayments.slice(0, 5).map((repayment) => (
                      <div
                        key={repayment.id}
                        className="p-2 rounded text-xs"
                        style={{ backgroundColor: 'rgb(var(--color-surface-elevated))' }}
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-mono font-semibold" style={{ color: 'rgb(var(--color-primary))' }}>
                            {repayment.amountFormatted}
                          </span>
                          <span style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            {formatDate(repayment.paymentDate)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            {repayment.paymentMethod.replace('_', ' ')}
                          </span>
                          <span className="font-mono" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                            {repayment.paymentReference}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowRepaymentModal(false)}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRecordRepayment}
                  className="flex-1"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Record Repayment'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
