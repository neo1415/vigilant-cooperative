'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatNaira } from '@/utils/financial';
import { toKoboAmount } from '@/types/branded';

interface SavingsAccount {
  id: string;
  accountType: 'NORMAL' | 'SPECIAL';
  balanceKobo: string;
  withdrawalLimitKobo: string;
  balanceFormatted: string;
  isLocked: boolean;
}

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
}

export default function SavingsPage() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  const normalAccount = accounts.find(a => a.accountType === 'NORMAL');
  const specialAccount = accounts.find(a => a.accountType === 'SPECIAL');

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  async function fetchAccounts() {
    try {
      const response = await fetch('/api/v1/savings/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.data.accounts);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }

  async function fetchTransactions() {
    try {
      const response = await fetch('/api/v1/savings/transactions?limit=10', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalSavingsKobo = accounts.reduce((sum, acc) => sum + parseInt(acc.balanceKobo), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'rgb(var(--color-primary))' }}></div>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading savings...</p>
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
            <h1 className="font-display text-4xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>Savings Overview</h1>
            <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Manage your cooperative savings accounts</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => window.location.href = '/savings/transactions'}
          >
            View All Transactions
          </Button>
        </div>

        {/* Total Savings Card */}
        <Card variant="glass" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <CardContent className="relative z-10 py-8">
            <p className="text-sm mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>Total Savings</p>
            <p className="font-mono text-6xl font-bold gradient-text mb-6">
              {formatNaira(toKoboAmount(totalSavingsKobo))}
            </p>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Normal Savings</p>
                <p className="font-mono text-2xl font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {normalAccount ? formatNaira(toKoboAmount(parseInt(normalAccount.balanceKobo))) : '₦0.00'}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Special Deposits</p>
                <p className="font-mono text-2xl font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {specialAccount ? formatNaira(toKoboAmount(parseInt(specialAccount.balanceKobo))) : '₦0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Normal Savings */}
          {normalAccount && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Normal Savings</span>
                  <span className="text-sm font-normal px-3 py-1 rounded-full bg-primary/10 text-primary">
                    Mandatory
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-tertiary mb-1">Current Balance</p>
                  <p className="font-mono text-3xl font-bold">
                    {normalAccount.balanceFormatted}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-surface border border-border">
                  <p className="text-sm text-secondary mb-2">
                    <span className="font-semibold">Withdrawal Limit:</span> You may withdraw up to 25% at a time
                  </p>
                  <p className="font-mono text-lg font-semibold text-primary">
                    {formatNaira(toKoboAmount(parseInt(normalAccount.withdrawalLimitKobo)))} available
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setWithdrawalModalOpen(true)}
                  disabled={normalAccount.isLocked || parseInt(normalAccount.balanceKobo) === 0}
                >
                  Request Withdrawal
                </Button>
                <p className="text-xs text-tertiary">
                  • Automatically serves as collateral for loans<br />
                  • Cannot be fully withdrawn while an active member
                </p>
              </CardContent>
            </Card>
          )}

          {/* Special Deposits */}
          {specialAccount && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Special Deposits</span>
                  <span className="text-sm font-normal px-3 py-1 rounded-full bg-secondary/10 text-secondary">
                    Voluntary
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-tertiary mb-1">Current Balance</p>
                  <p className="font-mono text-3xl font-bold">
                    {specialAccount.balanceFormatted}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-surface border border-border">
                  <p className="text-sm text-secondary">
                    Flexible deposits with no mandatory contributions. Withdraw anytime subject to cooperative policy.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setDepositModalOpen(true)}
                  disabled={specialAccount.isLocked}
                >
                  Make a Deposit
                </Button>
                <p className="text-xs text-tertiary">
                  • No withdrawal cap unless set by policy<br />
                  • Can be linked to specific products
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Button
                variant="ghost"
                onClick={() => window.location.href = '/savings/transactions'}
                className="text-sm"
              >
                View All →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-secondary">No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-secondary">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-secondary">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-secondary">Description</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">Amount</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-secondary">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="border-b border-border hover:bg-surface transition-colors">
                        <td className="py-3 px-4 text-sm">
                          {new Date(txn.createdAt).toLocaleDateString('en-NG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            txn.direction === 'CREDIT'
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-accent/10 text-accent'
                          }`}>
                            {txn.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{txn.description}</td>
                        <td className={`py-3 px-4 text-right font-mono font-semibold ${
                          txn.direction === 'CREDIT' ? 'text-secondary' : 'text-accent'
                        }`}>
                          {txn.direction === 'CREDIT' ? '+' : '-'}{txn.amountFormatted}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          {formatNaira(toKoboAmount(parseInt(txn.balanceAfterKobo)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={withdrawalModalOpen}
        onClose={() => setWithdrawalModalOpen(false)}
        account={normalAccount || undefined}
        onSuccess={() => {
          fetchAccounts();
          fetchTransactions();
          setWithdrawalModalOpen(false);
        }}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        account={specialAccount || undefined}
        onSuccess={() => {
          fetchAccounts();
          fetchTransactions();
          setDepositModalOpen(false);
        }}
      />
    </div>
  );
}

// Withdrawal Modal Component
function WithdrawalModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  account: SavingsAccount | undefined;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setAmount('');
      setDescription('');
      setError('');
      setSuccess('');
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [isOpen]);

  if (!account) return null;

  const maxWithdrawal = parseInt(account.withdrawalLimitKobo);
  const amountKobo = Math.floor(parseFloat(amount || '0') * 100);
  const isWithinLimit = amountKobo > 0 && amountKobo <= maxWithdrawal;
  const newBalance = parseInt(account.balanceKobo) - amountKobo;

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (amountKobo <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountKobo > maxWithdrawal) {
      setError(`Amount exceeds withdrawal limit of ${formatNaira(toKoboAmount(maxWithdrawal))}`);
      return;
    }

    setStep('confirm');
  }

  async function handleConfirm() {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/savings/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          accountId: account?.id,
          amountKobo: amountKobo.toString(),
          description: description || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Withdrawal of ${formatNaira(toKoboAmount(amountKobo))} successful!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(data.error?.message || 'Withdrawal failed');
        setStep('form');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Withdrawal" size="md">
      {success ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-secondary">{success}</p>
        </div>
      ) : step === 'form' ? (
        <form onSubmit={handleContinue} className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm">
              <strong>Available Balance:</strong> {account.balanceFormatted}
            </p>
            <p className="text-sm mt-1">
              <strong>Withdrawal Limit:</strong> {formatNaira(toKoboAmount(maxWithdrawal))} (25% of balance)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (₦)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={maxWithdrawal / 100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
              required
            />
            {amount && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${isWithinLimit ? 'text-secondary' : 'text-accent'}`}>
                {isWithinLimit ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Amount is within limit</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>Amount exceeds limit</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Purpose of withdrawal..."
              maxLength={500}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-surface border border-border space-y-3">
            <h3 className="font-semibold text-lg">Confirm Withdrawal</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Withdrawal Amount:</span>
                <span className="font-mono font-semibold">{formatNaira(toKoboAmount(amountKobo))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Current Balance:</span>
                <span className="font-mono">{account.balanceFormatted}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-tertiary">New Balance:</span>
                <span className="font-mono font-semibold">{formatNaira(toKoboAmount(newBalance))}</span>
              </div>
              {description && (
                <div className="border-t border-border pt-2">
                  <span className="text-tertiary">Description:</span>
                  <p className="mt-1">{description}</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep('form')} className="flex-1" disabled={loading}>
              Back
            </Button>
            <Button type="button" variant="primary" onClick={handleConfirm} disabled={loading} className="flex-1">
              {loading ? 'Processing...' : 'Confirm Withdrawal'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Deposit Modal Component
function DepositModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  account: SavingsAccount | undefined;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setAmount('');
      setDescription('');
      setError('');
      setSuccess('');
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [isOpen]);

  if (!account) return null;

  const amountKobo = Math.floor(parseFloat(amount || '0') * 100);
  const newBalance = parseInt(account.balanceKobo) + amountKobo;

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (amountKobo <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setStep('confirm');
  }

  async function handleConfirm() {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/savings/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          amountKobo: amountKobo.toString(),
          description: description || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Deposit of ${formatNaira(toKoboAmount(amountKobo))} successful!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(data.error?.message || 'Deposit failed');
        setStep('form');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Make a Deposit" size="md">
      {success ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-secondary">{success}</p>
        </div>
      ) : step === 'form' ? (
        <form onSubmit={handleContinue} className="space-y-4">
          <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
            <p className="text-sm">
              <strong>Note:</strong> This is a voluntary deposit to your Special Deposits account. 
              Funds can be withdrawn anytime subject to cooperative policy.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm">
              <strong>Current Balance:</strong> {account.balanceFormatted}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (₦)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0.00"
              required
            />
            {amount && amountKobo > 0 && (
              <div className="text-xs mt-1 flex items-center gap-1 text-secondary">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Valid deposit amount</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Purpose of deposit..."
              maxLength={500}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Continue
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-surface border border-border space-y-3">
            <h3 className="font-semibold text-lg">Confirm Deposit</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-tertiary">Deposit Amount:</span>
                <span className="font-mono font-semibold">{formatNaira(toKoboAmount(amountKobo))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Current Balance:</span>
                <span className="font-mono">{account.balanceFormatted}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-tertiary">New Balance:</span>
                <span className="font-mono font-semibold">{formatNaira(toKoboAmount(newBalance))}</span>
              </div>
              {description && (
                <div className="border-t border-border pt-2">
                  <span className="text-tertiary">Description:</span>
                  <p className="mt-1">{description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm">
            <p>
              <strong>Payment Instructions:</strong> Please transfer the exact amount to your assigned virtual account number 
              or use the payment link provided after confirmation.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep('form')} className="flex-1" disabled={loading}>
              Back
            </Button>
            <Button type="button" variant="primary" onClick={handleConfirm} disabled={loading} className="flex-1">
              {loading ? 'Processing...' : 'Confirm Deposit'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
