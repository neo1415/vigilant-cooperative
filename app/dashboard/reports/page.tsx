'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { get } from '../../../lib/api-client';

type ReportType = 'balance-sheet' | 'income-statement' | 'trial-balance';

interface AccountBalance {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceKobo: number;
  debitBalance?: number;
  creditBalance?: number;
}

interface BalanceSheet {
  asOfDate: string;
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

interface IncomeStatement {
  startDate: string;
  endDate: string;
  revenue: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

interface TrialBalance {
  asOfDate: string;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export default function FinancialReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('balance-sheet');
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Date range for income statement
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await get(`/api/v1/reports/balance-sheet?asOfDate=${asOfDate}`);
      setBalanceSheet(response.data);
    } catch (err) {
      setError('Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  const fetchIncomeStatement = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await get(
        `/api/v1/reports/income-statement?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`
      );
      setIncomeStatement(response.data);
    } catch (err) {
      setError('Failed to load income statement');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await get(`/api/v1/reports/trial-balance?asOfDate=${asOfDate}`);
      setTrialBalance(response.data);
    } catch (err) {
      setError('Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    if (reportType === 'balance-sheet') {
      fetchBalanceSheet();
    } else if (reportType === 'income-statement') {
      fetchIncomeStatement();
    } else if (reportType === 'trial-balance') {
      fetchTrialBalance();
    }
  }, [reportType, fetchBalanceSheet, fetchIncomeStatement, fetchTrialBalance]);

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(kobo / 100);
  };

  const handleExportPDF = () => {
    alert('PDF export functionality to be implemented');
  };

  const handleExportExcel = () => {
    alert('Excel export functionality to be implemented');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="secondary">
            Export PDF
          </Button>
          <Button onClick={handleExportExcel} variant="secondary">
            Export Excel
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <label className="font-medium">Report Type:</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="balance-sheet">Balance Sheet</option>
            <option value="income-statement">Income Statement</option>
            <option value="trial-balance">Trial Balance</option>
          </select>

          {reportType === 'income-statement' ? (
            <>
              <label className="font-medium ml-4">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
              <label className="font-medium">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
            </>
          ) : (
            <>
              <label className="font-medium ml-4">As of Date:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
            </>
          )}
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading report...</p>
        </div>
      )}

      {/* Balance Sheet */}
      {!loading && reportType === 'balance-sheet' && balanceSheet && (
        <Card className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">Balance Sheet</h2>
            <p className="text-gray-600">As of {new Date(balanceSheet.asOfDate).toLocaleDateString()}</p>
          </div>

          <div className="space-y-6">
            {/* Assets */}
            <div>
              <h3 className="font-bold text-lg mb-2">Assets</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Account</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceSheet.assets.map((account) => (
                    <tr key={account.accountCode} className="border-b">
                      <td className="py-2">{account.accountCode} - {account.accountName}</td>
                      <td className="text-right py-2">{formatCurrency(account.balanceKobo)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Assets</td>
                    <td className="text-right py-2">{formatCurrency(balanceSheet.totalAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liabilities */}
            <div>
              <h3 className="font-bold text-lg mb-2">Liabilities</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Account</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceSheet.liabilities.map((account) => (
                    <tr key={account.accountCode} className="border-b">
                      <td className="py-2">{account.accountCode} - {account.accountName}</td>
                      <td className="text-right py-2">{formatCurrency(account.balanceKobo)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Liabilities</td>
                    <td className="text-right py-2">{formatCurrency(balanceSheet.totalLiabilities)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Equity */}
            <div>
              <h3 className="font-bold text-lg mb-2">Equity</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Account</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceSheet.equity.map((account) => (
                    <tr key={account.accountCode} className="border-b">
                      <td className="py-2">{account.accountCode} - {account.accountName}</td>
                      <td className="text-right py-2">{formatCurrency(account.balanceKobo)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Equity</td>
                    <td className="text-right py-2">{formatCurrency(balanceSheet.totalEquity)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Balance Check */}
            <div className={`p-4 rounded ${balanceSheet.isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="font-bold">
                {balanceSheet.isBalanced ? '✓ Balanced' : '✗ Not Balanced'}
              </p>
              <p className="text-sm">
                Assets = Liabilities + Equity: {formatCurrency(balanceSheet.totalAssets)} = {formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Income Statement */}
      {!loading && reportType === 'income-statement' && incomeStatement && (
        <Card className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">Income Statement</h2>
            <p className="text-gray-600">
              {new Date(incomeStatement.startDate).toLocaleDateString()} - {new Date(incomeStatement.endDate).toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-6">
            {/* Revenue */}
            <div>
              <h3 className="font-bold text-lg mb-2">Revenue</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Account</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeStatement.revenue.map((account) => (
                    <tr key={account.accountCode} className="border-b">
                      <td className="py-2">{account.accountCode} - {account.accountName}</td>
                      <td className="text-right py-2">{formatCurrency(account.balanceKobo)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Revenue</td>
                    <td className="text-right py-2">{formatCurrency(incomeStatement.totalRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expenses */}
            <div>
              <h3 className="font-bold text-lg mb-2">Expenses</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Account</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeStatement.expenses.map((account) => (
                    <tr key={account.accountCode} className="border-b">
                      <td className="py-2">{account.accountCode} - {account.accountName}</td>
                      <td className="text-right py-2">{formatCurrency(account.balanceKobo)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Expenses</td>
                    <td className="text-right py-2">{formatCurrency(incomeStatement.totalExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Income */}
            <div className={`p-4 rounded ${incomeStatement.netIncome >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="font-bold text-lg">
                Net Income: {formatCurrency(incomeStatement.netIncome)}
              </p>
              <p className="text-sm">
                Revenue - Expenses = {formatCurrency(incomeStatement.totalRevenue)} - {formatCurrency(incomeStatement.totalExpenses)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Trial Balance */}
      {!loading && reportType === 'trial-balance' && trialBalance && (
        <Card className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">Trial Balance</h2>
            <p className="text-gray-600">As of {new Date(trialBalance.asOfDate).toLocaleDateString()}</p>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Account Code</th>
                <th className="text-left py-2">Account Name</th>
                <th className="text-right py-2">Debit</th>
                <th className="text-right py-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.accounts.map((account) => (
                <tr key={account.accountCode} className="border-b">
                  <td className="py-2">{account.accountCode}</td>
                  <td className="py-2">{account.accountName}</td>
                  <td className="text-right py-2">
                    {account.debitBalance > 0 ? formatCurrency(account.debitBalance) : '-'}
                  </td>
                  <td className="text-right py-2">
                    {account.creditBalance > 0 ? formatCurrency(account.creditBalance) : '-'}
                  </td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td className="py-2" colSpan={2}>Totals</td>
                <td className="text-right py-2">{formatCurrency(trialBalance.totalDebits)}</td>
                <td className="text-right py-2">{formatCurrency(trialBalance.totalCredits)}</td>
              </tr>
            </tbody>
          </table>

          <div className={`mt-4 p-4 rounded ${trialBalance.isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="font-bold">
              {trialBalance.isBalanced ? '✓ Balanced' : '✗ Not Balanced'}
            </p>
            <p className="text-sm">
              Total Debits = Total Credits: {formatCurrency(trialBalance.totalDebits)} = {formatCurrency(trialBalance.totalCredits)}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
