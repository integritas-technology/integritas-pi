import { HardDrive, Layers3, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MinimaNodeStatus } from '../../app/types';
import { Card } from '../../components/Card';
import { LoadingDots } from '../../components/LoadingDots';
import { cx } from '../../lib/cx';
import { formatNodeState, formatSyncStatus } from './minimaFormat';

function SummaryCard({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className='flex flex-col p-5! transition hover:-translate-y-0.5 hover:shadow-md'>
      <Icon className='text-slate-700' size={24} />
      <h3 className='mt-4 mb-0 font-semibold text-slate-950'>{title}</h3>
      <p className='mt-1 mb-0 text-sm leading-6 text-slate-500'>{text}</p>
      {children}
    </Card>
  );
}

export function MinimaSummaryGrid({
  status,
  loading,
  busy,
  refreshing,
  onResync,
}: {
  status: MinimaNodeStatus | null;
  loading: boolean;
  busy: boolean;
  refreshing: boolean;
  onResync: () => void;
}) {
  const effectiveStatus = refreshing ? null : status;
  const effectiveLoading = loading || refreshing;

  const chainDataLabel = effectiveStatus?.storage.chainDataDisk
    ? `${effectiveStatus.storage.chainDataDisk} chain data`
    : effectiveStatus?.node.memoryDisk
      ? `${effectiveStatus.node.memoryDisk} chain data`
      : effectiveLoading
        ? <LoadingDots />
        : 'Unavailable';
  const containerDiskLabel = effectiveStatus?.storage.containerDisk
    ? `${effectiveStatus.storage.containerDisk} Docker container`
    : null;

  return (
    <div className={cx('grid gap-4 md:grid-cols-2 lg:grid-cols-3')}>
      <SummaryCard
        icon={Layers3}
        title='Minima'
        text={effectiveLoading && !effectiveStatus?.state ? <LoadingDots /> : formatNodeState(effectiveStatus?.state ?? null)}
      />

      <SummaryCard
        icon={RefreshCw}
        title='Sync status'
        text={
          effectiveLoading && !effectiveStatus?.sync.status ? (
            <LoadingDots />
          ) : (
            formatSyncStatus(effectiveStatus?.sync.status)
          )
        }
      >
        <button
          type='button'
          className='mt-4 w-fit rounded-[14px] border-0 bg-slate-950 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60'
          disabled={busy}
          onClick={onResync}
        >
          Resync
        </button>
      </SummaryCard>

      <SummaryCard icon={HardDrive} title='Local storage' text={chainDataLabel}>
        {containerDiskLabel && (
          <p className='mt-1 mb-0 text-sm leading-6 text-slate-500'>
            {containerDiskLabel}
          </p>
        )}
      </SummaryCard>
    </div>
  );
}
