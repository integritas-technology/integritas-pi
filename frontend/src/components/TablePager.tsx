import { RefreshCcwIcon } from 'lucide-react';
import { TableIconButton } from './DataTable';
import { DEFAULT_PAGE_SIZE_OPTIONS, listRangeLabel } from '../lib/paginated';

export function TablePager({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  refreshing = false,
  disabled = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  disabled?: boolean;
}) {
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div className='flex items-center gap-2'>
        <p className='text-sm text-slate-500'>
          {listRangeLabel(currentPage, pageSize, total)}
        </p>
        {onRefresh && (
          <TableIconButton
            aria-label='Refresh'
            disabled={disabled || refreshing}
            onClick={onRefresh}
          >
            <RefreshCcwIcon size={16} className={refreshing ? 'animate-spin' : undefined} />
          </TableIconButton>
        )}
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <label className='flex items-center gap-2 text-sm'>
          <span className='text-slate-500'>Rows</span>
          <select
            className='rounded-md border border-slate-200 bg-white px-2 py-1'
            value={pageSize}
            disabled={disabled}
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
          disabled={disabled || currentPage <= 1}
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
          disabled={disabled || totalPages === 0 || currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
