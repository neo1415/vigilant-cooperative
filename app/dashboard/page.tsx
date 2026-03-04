'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api-client';
import { getUserFromToken } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FinancialSummary {
  totalSavings: number;
  normalSavings: number;
  specialSavings: number;
  activeLoansCount: number;
  totalLoanAmount: number;
  outstandingLoanAmount: number;
  availableCredit: number;
}

interface Transaction {
  id: string;
  type: string;
  amountKobo: string;
  direction: 'CREDIT' | 'DEBIT';
  createdAt: string;
  description: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = getUserFromToken();

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch savings accounts
        const savingsResponse = await get('/api/v1/savings/accounts');
        const savings = savingsResponse.data?.accounts || [];
        
        const normalAccount = savings.find((acc: any) => acc.accountType === 'NORMAL');
        const specialAccount = savings.find((acc: any) => acc.accountType === 'SPECIAL');
        
        const normalSavings = parseInt(normalAccount?.balanceKobo || '0', 10);
        const specialSavings = parseInt(specialAccount?.balanceKobo || '0', 10);
        const totalSavings = normalSavings + specialSavings;

        // Fetch loans
        const loansResponse = await get('/api/v1/loans');
        const loans = loansResponse.data?.loans || [];
        const activeLoans = loans.filter((loan: any) => 
          ['SUBMITTED', 'APPROVED', 'DISBURSED'].includes(loan.status)
        );
        
        const totalLoanAmount = activeLoans.reduce((sum: number, loan: any) => 
          sum + (loan.principalKobo || 0), 0
        );
        const outstandingLoanAmount = activeLoans.reduce((sum: number, loan: any) => 
          sum + (loan.outstandingKobo || 0), 0
        );

        // Calculate available credit (simplified - 2x normal savings minus outstanding)
        const availableCredit = Math.max(0, (normalSavings * 2) - outstandingLoanAmount);

        setSummary({
          totalSavings,
          normalSavings,
          specialSavings,
          activeLoansCount: activeLoans.length,
          totalLoanAmount,
          outstandingLoanAmount,
          availableCredit,
        });

        // Fetch recent transactions
        const transactionsResponse = await get('/api/v1/savings/transactions?limit=5');
        setRecentTransactions(transactionsResponse.data?.transactions || []);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const formatNaira = (kobo: number) => {
    const naira = kobo / 100;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(naira);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Dashboard</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">
          Welcome back, {user?.fullName?.split(' ')[0] || 'Member'}!
        </h1>
        <p className="text-text-secondary">
          Here's an overview of your cooperative account
        </p>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-1">Total Savings</p>
          <p className="text-2xl font-mono font-bold gradient-text">
            {formatNaira(summary?.totalSavings || 0)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-1">Active Loans</p>
          <p className="text-2xl font-mono font-bold">
            {summary?.activeLoansCount || 0}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Outstanding: {formatNaira(summary?.outstandingLoanAmount || 0)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-1">Available Credit</p>
          <p className="text-2xl font-mono font-bold text-green-500">
            {formatNaira(summary?.availableCredit || 0)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-1">Member ID</p>
          <p className="text-xl font-mono font-bold">
            {user?.memberId}
          </p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/dashboard/loans/apply">
            <Button variant="secondary" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Apply for Loan
            </Button>
          </Link>
          <Link href="/dashboard/savings">
            <Button variant="secondary" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              View Savings
            </Button>
          </Link>
          <Link href="/dashboard/loans">
            <Button variant="secondary" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              My Loans
            </Button>
          </Link>
          <Link href="/dashboard/members/profile">
            <Button variant="secondary" className="w-full">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              View Profile
            </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Transactions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <Link href="/dashboard/savings/transactions">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="text-text-secondary text-center py-8">No recent transactions</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-elevated transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${transaction.direction === 'CREDIT' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <svg className={`w-5 h-5 ${transaction.direction === 'CREDIT' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {transaction.direction === 'CREDIT' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0l-4-4m4 4l4-4" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 0l4 4m-4-4l-4 4" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">{transaction.description || transaction.type}</p>
                    <p className="text-sm text-text-secondary">{formatDate(transaction.createdAt)}</p>
                  </div>
                </div>
                <p className={`font-mono font-semibold ${transaction.direction === 'CREDIT' ? 'text-green-500' : 'text-red-500'}`}>
                  {transaction.direction === 'CREDIT' ? '+' : '-'}{formatNaira(parseInt(transaction.amountKobo, 10))}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
