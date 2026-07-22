import type {
  ButtonHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
} from 'react';
import { Card } from './Card';
import { StatusRow } from './StatusRow';
import { MutedText } from './Text';
import { cx } from '../lib/cx';

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'overflow-x-auto rounded-2xl border border-slate-200 bg-white',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataTable({
  children,
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <table
      className={cx(
        'w-full min-w-190 border-collapse text-left text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </table>
  );
}

export function TableCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx('grid gap-4', className)}>
      <StatusRow className='sm:items-start'>
        <div>
          <strong>{title}</strong>
          {description && (
            <MutedText className='m-0 mt-1'>{description}</MutedText>
          )}
        </div>
        {actions}
      </StatusRow>
      {children}
    </Card>
  );
}

export function EmptyTableState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <MutedText className={className}>{children}</MutedText>;
}

export function RowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function TableIconButton({
  children,
  className,
  danger,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45',
        danger && 'text-red-700 hover:border-red-300 hover:text-red-800',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const tableHeadRowClass =
  'bg-slate-50 text-xs uppercase tracking-wide text-slate-500';
export const tableHeaderCellClass = 'px-4 py-3 text-left font-black';
export const tableRowClass = 'border-t border-slate-200 align-top';
export const tableCellClass = 'px-4 py-3 align-top';
