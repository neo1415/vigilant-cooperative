'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatNaira } from '@/utils/financial';
import { toKoboAmount } from '@/types/branded';
import { apiClient } from '@/lib/api-client';

interface Transaction {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  amountKobo: string;
  balanceAfterKobo: string;
  reference: string;
  type: string;
  description: string;
  createdAt: string;
  amountFormatted: string;
  balanceAfterFormatted: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    accountType: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, pagination.limit]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.accountType) params.append('accountType', filters.accountType);
      if (filters.startDate) params.append('startDate', new Date(filters.startDate).toISOString());
      if (filters.endDate) params.append('endDate', new Date(filters.endDate).toISOString());

      const response = await apiClient(`/api/v1/savings/transactions?${params}`);

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data.transactions);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function applyFilters() {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchTransactions();
  }

  function clearFilters() {
    setFilters({
      accountType: '',
      startDate: '',
      endDate: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(() => fetchTransactions(), 0);
  }

  function exportToCSV() {
    const headers = ['Date', 'Type', 'Description', 'Reference', 'Amount', 'Balance After'];
    const rows = transactions.map(txn => [
      new Date(txn.createdAt).toLocaleDateString('en-NG'),
      txn.type.replace('_', ' '),
      txn.description || '',
      txn.reference,
      `${txn.direction === 'CREDIT' ? '+' : '-'}${txn.amountFormatted}`,
      txn.balanceAfterFormatted,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const filteredTransactions = filters.search
    ? transactions.filter(txn =>
        txn.reference.toLowerCase().includes(filters.search.toLowerCase()) ||
        txn.description?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : transactions;

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading transactions...</p>
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
              Transaction History
            </h1>
            <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
              View and export your complete transaction history
            </p>
          </div>
          <Button variant="secondary" onClick={exportToCSV} disabled={transactions.length === 0}>
            Export to CSV
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Account Type
                </label>
                <Select
                  value={filters.accountType}
                  onChange={(e) => handleFilterChange('accountType', e.target.value)}
                  options={[
                    { value: '', label: 'All Accounts' },
                    { value: 'NORMAL', label: 'Normal Savings' },
                    { value: 'SPECIAL', label: 'Special Deposits' },
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
                  Search by Reference
                </label>
                <Input
                  type="text"
                  placeholder="Search reference or description..."
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

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Transactions ({pagination.total})
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
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                  ]}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {filters.search || filters.accountType || filters.startDate || filters.endDate
                    ? 'No transactions match your filters'
                    : 'No transactions yet'}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead align="right">Amount</TableHead>
                      <TableHead align="right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          {new Date(txn.createdAt).toLocaleDateString('en-NG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            txn.direction === 'CREDIT'
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-accent/10 text-accent'
                          }`}>
                            {txn.type.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>{txn.description || '-'}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{txn.reference}</span>
                        </TableCell>
                        <TableCell align="right">
                          <span className={`font-mono font-semibold ${
                            txn.direction === 'CREDIT' ? 'text-secondary' : 'text-accent'
                          }`}>
                            {txn.direction === 'CREDIT' ? '+' : '-'}{txn.amountFormatted}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-mono">{txn.balanceAfterFormatted}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                  <div className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
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
