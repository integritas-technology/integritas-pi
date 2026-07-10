import { useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE_OPTIONS, listRangeLabel } from '../lib/paginated';

type ListPagerFilterStatusOption = {
  value: string;
  label: string;
};

type ListPagerFilterBarProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status: string;
  q: string;
  statusOptions: readonly ListPagerFilterStatusOption[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onStatusChange: (status: string) => void;
  onQueryChange: (q: string) => void;
};

export function ListPagerFilterBar({
  page,
  pageSize,
  total,
  totalPages,
  status,
  q,
  statusOptions,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onQueryChange,
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

  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  return (
    <div className='mb-4 space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='flex min-w-40 flex-col gap-1 text-sm'>
          <span className='font-medium text-slate-700'>Status</span>
          <select
            className='rounded-md border border-slate-200 bg-white px-3 py-2'
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className='flex min-w-56 flex-1 flex-col gap-1 text-sm'>
          <span className='font-medium text-slate-700'>Search</span>
          <input
            className='rounded-md border border-slate-200 bg-white px-3 py-2'
            type='search'
            placeholder='Hash, UID, or source name'
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-slate-500'>
          {listRangeLabel(currentPage, pageSize, total)}
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          <label className='flex items-center gap-2 text-sm'>
            <span className='text-slate-500'>Rows</span>
            <select
              className='rounded-md border border-slate-200 bg-white px-2 py-1'
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {DEFAULT_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            className='w-fit rounded-xl border-0 bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-55'
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span className='text-sm text-slate-600'>
            Page {currentPage}
            {totalPages > 0 ? ` of ${totalPages}` : ''}
          </span>
          <button
            type='button'
            className='w-fit rounded-xl border-0 bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-55'
            disabled={totalPages === 0 || currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
