import { useEffect, useState } from 'react';
import { TablePager } from './TablePager';

type ListPagerFilterStatusOption = {
  value: string;
  label: string;
};

type ListPagerFilterBarProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status?: string;
  q: string;
  statusOptions?: readonly ListPagerFilterStatusOption[];
  statusLabel?: string;
  searchPlaceholder?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onStatusChange?: (status: string) => void;
  onQueryChange: (q: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  disabled?: boolean;
};

export function ListPagerFilterBar({
  page,
  pageSize,
  total,
  totalPages,
  status,
  q,
  statusOptions,
  statusLabel = 'Status',
  searchPlaceholder = 'Hash, UID, or source name',
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onQueryChange,
  onRefresh,
  refreshing = false,
  disabled = false,
}: ListPagerFilterBarProps) {
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput !== q) onQueryChange(searchInput);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput, q, onQueryChange]);

  return (
    <div className='mb-4 space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        {statusOptions && onStatusChange && (
          <label className='flex min-w-40 flex-col gap-1 text-sm'>
            <span className='font-medium text-slate-700'>{statusLabel}</span>
            <select
              className='rounded-md border border-slate-200 bg-white px-3 py-2'
              value={status ?? ''}
              disabled={disabled}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className='flex min-w-56 flex-1 flex-col gap-1 text-sm'>
          <span className='font-medium text-slate-700'>Search</span>
          <input
            className='rounded-md border border-slate-200 bg-white px-3 py-2'
            type='search'
            placeholder={searchPlaceholder}
            value={searchInput}
            disabled={disabled}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
      </div>
      <TablePager
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onRefresh={onRefresh}
        refreshing={refreshing}
        disabled={disabled}
      />
    </div>
  );
}
