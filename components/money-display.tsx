import { cn } from '@/lib/utils';

interface MoneyDisplayProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;
  className?: string;
  colorCoded?: boolean;
}

export function MoneyDisplay({
  amount,
  size = 'md',
  showSign = false,
  className,
  colorCoded = false,
}: MoneyDisplayProps) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const isNegative = numAmount < 0;
  const absAmount = Math.abs(numAmount);

  // Format with commas and 2 decimal places
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  const colorClass = colorCoded
    ? isNegative
      ? 'text-red-500'
      : numAmount > 0
        ? 'text-green-500'
        : 'text-text-primary'
    : 'text-text-primary';

  return (
    <span
      className={cn(
        'font-mono font-semibold tabular-nums',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {showSign && numAmount > 0 && '+'}
      {isNegative && '-'}₦{formatted}
    </span>
  );
}

// Utility function to format kobo to naira
export function formatKoboToNaira(kobo: number | string): string {
  const numKobo = typeof kobo === 'string' ? parseInt(kobo, 10) : kobo;
  return (numKobo / 100).toFixed(2);
}

// MoneyDisplay for kobo amounts
export function MoneyDisplayKobo({
  kobo,
  ...props
}: Omit<MoneyDisplayProps, 'amount'> & { kobo: number | string }) {
  const naira = formatKoboToNaira(kobo);
  return <MoneyDisplay amount={naira} {...props} />;
}
