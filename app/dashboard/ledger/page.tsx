/**
 * Ledger Overview Page
 * 
 * Displays chart of accounts with current balances, recent vouchers,
 * and reconciliation status.
 * 
 * @module app/(dashboard)/ledger/page
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { get } from '@/lib/api-client';

interface Account {
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balanceKobo: number;
  balanceFormatted: string;
  isActive: boolean;
}

interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: string;
  amountFormatted: string;
  description: string;
  status: string;
  createdAt: string;
}

interface ReconciliationStatus {
  lastReconciledAt: string | null;
  isReconciled: boolean;
  discrepancyCount: number;
}

export default function LedgerOverviewPage() {
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');

  const fetchLedgerData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsResult, vouchersResult, reconResult] = await Promise.all([
        get<{ accounts: Account[] }>('/api/v1/ledger/accounts'),
        get<{ vouchers: Voucher[] }>('/api/v1/ledger/vouchers?limit=10'),
        get<ReconciliationStatus>('/api/v1/ledger/reconciliation-status'),
      ]);
      
      if (accountsResult.success && accountsResult.data) {
        setAccounts(accountsResult.data.accounts || []);
      }
      
      if (vouchersResult.success && vouchersResult.data) {
        setVouchers(vouchersResult.data.vouchers || []);
      }
      
      if (reconResult.success && reconResult.data) {
        setReconciliation(reconResult.data);
      }
    } catch {
      console.error('Failed to fetch ledger data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const filteredAccounts = filter === 'ALL' 
    ? accounts 
    : accounts.filter(acc => acc.accountType === filter);

  const accountTypeColors: Record<string, string> = {
    ASSET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    LIABILITY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    EQUITY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    REVENUE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    EXPENSE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  const voucherStatusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    POSTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    REVERSED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading ledger data...</p>
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
              Ledger & Accounting
            </h1>
            <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Chart of accounts and financial ledger
            </p>
          </div>
          <Button variant="primary" onClick={() => router.push('/dashboard/reports')}>
            View Reports
          </Button>
        </div>

        {/* Reconciliation Status */}
        {reconciliation && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Reconciliation Status
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      reconciliation.isReconciled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {reconciliation.isReconciled ? '✓ Reconciled' : '⚠ Needs Reconciliation'}
                    </span>
                    {reconciliation.discrepancyCount > 0 && (
                      <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        {reconciliation.discrepancyCount} discrepancies found
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Last Reconciled
                  </p>
                  <p className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {reconciliation.lastReconciledAt ? formatDate(reconciliation.lastReconciledAt) : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart of Accounts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Chart of Accounts ({filteredAccounts.length})</CardTitle>
              <div className="flex gap-2">
                {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      filter === type
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  No accounts found
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead align="right">Balance</TableHead>
                    <TableHead align="center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.accountCode}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold">{account.accountCode}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{account.accountName}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${accountTypeColors[account.accountType]}`}>
                          {account.accountType}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <span className="font-mono font-semibold">{account.balanceFormatted}</span>
                      </TableCell>
                      <TableCell align="center">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          account.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Vouchers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Vouchers</CardTitle>
              <Button variant="ghost" onClick={() => router.push('/dashboard/ledger/vouchers')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {vouchers.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  No vouchers yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vouchers.map((voucher) => (
                  <div
                    key={voucher.id}
                    className="p-4 rounded-lg border cursor-pointer hover:border-primary transition-colors"
                    style={{ 
                      backgroundColor: 'rgb(var(--color-surface-elevated))',
                      borderColor: 'rgb(var(--color-border))'
                    }}
                    onClick={() => router.push(`/dashboard/ledger/vouchers/${voucher.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold" style={{ color: 'rgb(var(--color-primary))' }}>
                            {voucher.voucherNumber}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${voucherStatusColors[voucher.status]}`}>
                            {voucher.status}
                          </span>
                        </div>
                        <p className="text-sm mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {voucher.voucherType.replace('_', ' ')}
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          {voucher.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {voucher.amountFormatted}
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          {formatDate(voucher.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
