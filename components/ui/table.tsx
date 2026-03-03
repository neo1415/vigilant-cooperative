/**
 * Table Component
 * 
 * Reusable table component with design system styling
 */

import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: TableProps) {
  return (
    <thead className={className}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }: TableProps) {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function TableRow({ children, className = '', onClick }: TableRowProps) {
  return (
    <tr 
      className={`border-b border-border hover:bg-surface transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableHead({ children, className = '', align = 'left' }: TableHeadProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  
  return (
    <th className={`py-3 px-4 text-sm font-semibold text-secondary ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableCell({ children, className = '', align = 'left' }: TableCellProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  
  return (
    <td className={`py-3 px-4 text-sm ${alignClass} ${className}`}>
      {children}
    </td>
  );
}
