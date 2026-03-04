import { Card } from './ui/card';
import { MoneyDisplayKobo } from './money-display';
import { cn } from '@/lib/utils';

interface SavingsCardProps {
  accountType: 'NORMAL' | 'SPECIAL';
  balanceKobo: number;
  isLocked?: boolean;
  className?: string;
}

export function SavingsCard({
  accountType,
  balanceKobo,
  isLocked = false,
  className,
}: SavingsCardProps) {
  const isNormal = accountType === 'NORMAL';

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-text-secondary mb-1">
            {isNormal ? 'Normal Savings' : 'Special Savings'}
          </p>
          <MoneyDisplayKobo kobo={balanceKobo} size="xl" />
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            isNormal ? 'bg-blue-500/10' : 'bg-purple-500/10'
          )}
        >
          <svg
            className={cn('w-6 h-6', isNormal ? 'text-blue-500' : 'text-purple-500')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
      </div>

      {isLocked && (
        <div className="flex items-center space-x-2 text-sm text-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Account locked</span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-text-secondary">
          {isNormal
            ? 'Available for withdrawals and loan applications'
            : 'Special savings for long-term goals'}
        </p>
      </div>
    </Card>
  );
}

interface LoanCardProps {
  loanReference: string;
  loanType: 'SHORT_TERM' | 'LONG_TERM';
  principalKobo: number;
  outstandingKobo: number;
  status: string;
  monthlyInstallmentKobo: number;
  className?: string;
  onClick?: () => void;
}

export function LoanCard({
  loanReference,
  loanType,
  principalKobo,
  outstandingKobo,
  status,
  monthlyInstallmentKobo,
  className,
  onClick,
}: LoanCardProps) {
  const statusColors: Record<string, string> = {
    SUBMITTED: 'bg-blue-500/10 text-blue-500',
    PENDING_GUARANTORS: 'bg-yellow-500/10 text-yellow-500',
    PENDING_PRESIDENT: 'bg-yellow-500/10 text-yellow-500',
    PENDING_COMMITTEE: 'bg-yellow-500/10 text-yellow-500',
    PENDING_TREASURER: 'bg-yellow-500/10 text-yellow-500',
    APPROVED: 'bg-green-500/10 text-green-500',
    DISBURSED: 'bg-green-500/10 text-green-500',
    ACTIVE: 'bg-green-500/10 text-green-500',
    COMPLETED: 'bg-gray-500/10 text-gray-500',
    REJECTED: 'bg-red-500/10 text-red-500',
    CANCELLED: 'bg-gray-500/10 text-gray-500',
  };

  const progress = principalKobo > 0 ? ((principalKobo - outstandingKobo) / principalKobo) * 100 : 0;

  return (
    <Card
      className={cn('p-6 cursor-pointer hover:border-accent-primary transition-colors', className)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-text-secondary mb-1">{loanReference}</p>
          <p className="font-semibold text-lg mb-1">
            {loanType === 'SHORT_TERM' ? 'Short-term Loan' : 'Long-term Loan'}
          </p>
          <span
            className={cn(
              'inline-block px-2 py-1 rounded text-xs font-medium',
              statusColors[status] || 'bg-gray-500/10 text-gray-500'
            )}
          >
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Principal</span>
          <MoneyDisplayKobo kobo={principalKobo} size="sm" />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Outstanding</span>
          <MoneyDisplayKobo kobo={outstandingKobo} size="sm" />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Monthly Payment</span>
          <MoneyDisplayKobo kobo={monthlyInstallmentKobo} size="sm" />
        </div>

        {status === 'ACTIVE' || status === 'DISBURSED' ? (
          <div className="pt-2">
            <div className="flex justify-between text-xs text-text-secondary mb-1">
              <span>Repayment Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full gradient-bg transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

interface TransactionRowProps {
  type: string;
  description: string;
  amountKobo: number;
  direction: 'CREDIT' | 'DEBIT';
  date: string;
  balanceAfterKobo: number;
  className?: string;
}

export function TransactionRow({
  type,
  description,
  amountKobo,
  direction,
  date,
  balanceAfterKobo,
  className,
}: TransactionRowProps) {
  const isCredit = direction === 'CREDIT';

  return (
    <div className={cn('flex items-center justify-between py-4 border-b border-border last:border-0', className)}>
      <div className="flex items-center space-x-4 flex-1">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            isCredit ? 'bg-green-500/10' : 'bg-red-500/10'
          )}
        >
          <svg
            className={cn('w-5 h-5', isCredit ? 'text-green-500' : 'text-red-500')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isCredit ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            )}
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{description}</p>
          <p className="text-sm text-text-secondary">{type.replace(/_/g, ' ')}</p>
          <p className="text-xs text-text-secondary mt-1">
            {new Date(date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
      <div className="text-right">
        <MoneyDisplayKobo kobo={amountKobo} size="md" colorCoded showSign={isCredit} />
        <p className="text-xs text-text-secondary mt-1">
          Balance: <MoneyDisplayKobo kobo={balanceAfterKobo} size="sm" />
        </p>
      </div>
    </div>
  );
}
