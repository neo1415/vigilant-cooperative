/**
 * Loan List Page
 * 
 * Displays all loans with filtering and search capabilities.
 * Members see only their own loans, officers see all loans.
 * 
 * @module app/(dashboard)/loans/list/page
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface Loan {
  id: string;
  loanReference: string;
  applicantId: string;
  applicantName: string;
  applicantMemberId: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: number;
  principalFormatted: string;
  totalRepayableKobo: number;
  totalRepayableFormatted: string;
  outstandingKobo: number;
  outstandingFormatted: string;
  status: string;
  submittedAt: string;
  disbursedAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
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

export default function LoanListPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    loanType: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    fetchLoans();
  }, [pagination.page, pagination.limit]);

  async function fetchLoans() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.status) params.append('status', filters.status);
      if (filters.loanType) params.append('loanType', filters.loanType);
      if (filters.startDate) params.append('startDate', new Date(filters.startDate).toISOString());
      if (filters.endDate) params.append('endDate', new Date(filters.endDate).toISOString());
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/v1/loans?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setLoans(data.data.loans);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch loans:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function applyFilters() {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLoans();
  }

  function clearFilters() {
    setFilters({
      status: '',
      loanType: '',
      startDate: '',
      endDate: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => fetchLoans(), 0);
  }

  function handleRowClick(loanId: string) {
    router.push(`/loans/${loanId}`);
  }

  if (loading && loans.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
              Loans
            </h1>
            <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
              View and manage loan applications
            </p>
          </div>
          <Button variant="primary" onClick={() => router.push('/loans/apply')}>
            Apply for Loan
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Status
                </label>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'SUBMITTED', label: 'Submitted' },
                    { value: 'GUARANTOR_CONSENT', label: 'Awaiting Guarantors' },
                    { value: 'PRESIDENT_REVIEW', label: 'President Review' },
                    { value: 'COMMITTEE_REVIEW', label: 'Committee Review' },
                    { value: 'TREASURER_REVIEW', label: 'Treasurer Review' },
                    { value: 'DISBURSED', label: 'Disbursed' },
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Loan Type
                </label>
                <Select
                  value={filters.loanType}
                  onChange={(e) => handleFilterChange('loanType', e.target.value)}
                  options={[
                    { value: '', label: 'All Types' },
                    { value: 'SHORT_TERM', label: 'Short-Term' },
                    { value: 'LONG_TERM', label: 'Long-Term' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Start Date
                </label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  End Date
                </label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Search
                </label>
                <Input
                  type="text"
                  placeholder="Loan reference..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="primary" onClick={applyFilters}>
                Apply Filters
              </Button>
              <Button variant="ghost" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loans Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Loans ({pagination.total})
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Show:
                </span>
                <Select
                  value={pagination.limit.toString()}
                  onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                  className="w-20"
                  options={[
                    { value: '10', label: '10' },
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                  ]}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loans.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {filters.status || filters.loanType || filters.startDate || filters.endDate || filters.search
                    ? 'No loans match your filters'
                    : 'No loans yet'}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead align="right">Amount</TableHead>
                      <TableHead align="right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow key={loan.id} onClick={() => handleRowClick(loan.id)}>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold">{loan.loanReference}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{loan.applicantName}</div>
                            <div className="text-xs text-muted-foreground">{loan.applicantMemberId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {loan.loanType === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term'}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-mono font-semibold">{loan.principalFormatted}</span>
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-mono">{loan.outstandingFormatted}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[loan.status] || loan.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(loan.submittedAt).toLocaleDateString('en-NG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                  <div className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} loans
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1 || loading}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? 'primary' : 'ghost'}
                            onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                            disabled={loading}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={!pagination.hasMore || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
