'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { get } from '../../../../lib/api-client';

interface MemberStatement {
  memberId: string;
  memberName: string;
  startDate: string;
  endDate: string;
  normalSavingsBalance: number;
  specialSavingsBalance: number;
  totalSavings: number;
  savingsTransactions: Array<{
    date: string;
    type: string;
    description: string;
    amount: number;
    balanceAfter: number;
  }>;
  loans: Array<{
    loanReference: string;
    loanType: string;
    principalKobo: number;
    outstandingKobo: number;
    status: string;
    disbursedAt: string | null;
  }>;
  totalLoansOutstanding: number;
}

export default function MemberStatementPage() {
  const [statement, setStatement] = useState<MemberStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Last 3 months
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await get(
        `/api/v1/reports/member-statement?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`
      );
      setStatement(response.data);
    } catch (err) {
      setError('Failed to load member statement');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Member Statement</h1>
        <Button onClick={handleExportPDF} variant="secondary">
          Export PDF
        </Button>
      </div>

      {/* Date Range Selector */}
      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <label className="font-medium">Start Date:</label>
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
          <Button onClick={fetchStatement}>Generate Statement</Button>
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
          <p className="mt-2 text-gray-600">Loading statement...</p>
        </div>
      )}

      {!loading && statement && (
        <>
          {/* Member Info */}
          <Card className="p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">Member Financial Statement</h2>
              <p className="text-gray-600">
                {new Date(statement.startDate).toLocaleDateString()} - {new Date(statement.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-600">Member ID</p>
                <p className="font-medium">{statement.memberId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Member Name</p>
                <p className="font-medium">{statement.memberName}</p>
              </div>
            </div>
          </Card>

          {/* Savings Summary */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Savings Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Normal Savings</p>
                <p className="text-xl font-bold">{formatCurrency(statement.normalSavingsBalance)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Special Savings</p>
                <p className="text-xl font-bold">{formatCurrency(statement.specialSavingsBalance)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Savings</p>
                <p className="text-xl font-bold">{formatCurrency(statement.totalSavings)}</p>
              </div>
            </div>
          </Card>

          {/* Savings Transactions */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Savings Transactions</h3>
            {statement.savingsTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No transactions in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Amount</th>
                      <th className="text-right py-2">Balance After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.savingsTransactions.map((txn, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="py-2">{txn.type}</td>
                        <td className="py-2">{txn.description}</td>
                        <td className={`text-right py-2 ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(txn.amount))}
                        </td>
                        <td className="text-right py-2">{formatCurrency(txn.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Loans Summary */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Loans Summary</h3>
            <div className="mb-4 bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Outstanding Loans</p>
              <p className="text-xl font-bold">{formatCurrency(statement.totalLoansOutstanding)}</p>
            </div>

            {statement.loans.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No loans</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Loan Reference</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-right py-2">Principal</th>
                      <th className="text-right py-2">Outstanding</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Disbursed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.loans.map((loan) => (
                      <tr key={loan.loanReference} className="border-b">
                        <td className="py-2">{loan.loanReference}</td>
                        <td className="py-2">{loan.loanType.replace('_', ' ')}</td>
                        <td className="text-right py-2">{formatCurrency(loan.principalKobo)}</td>
                        <td className="text-right py-2">{formatCurrency(loan.outstandingKobo)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            loan.status === 'DISBURSED' ? 'bg-green-100 text-green-800' :
                            loan.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="py-2">
                          {loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Net Position */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Net Financial Position</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Savings</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(statement.totalSavings)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Loans</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(statement.totalLoansOutstanding)}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Net Position</p>
                <p className={`text-xl font-bold ${
                  statement.totalSavings - statement.totalLoansOutstanding >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(statement.totalSavings - statement.totalLoansOutstanding)}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
