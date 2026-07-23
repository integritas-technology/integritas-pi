import { HardDrive, Layers3, RefreshCw, RotateCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MinimaNodeStatus } from '../../app/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingDots } from '../../components/LoadingDots';
import { cx } from '../../lib/cx';
import { formatLocalTime, formatUtcTime } from '../../lib/time';
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
    <Card className='flex flex-col p-5!'>
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
  const checkedLabel = effectiveStatus?.checkedAt
    ? `Checked ${formatLocalTime(effectiveStatus.checkedAt)} local · ${formatUtcTime(effectiveStatus.checkedAt)} UTC`
    : null;

  return (
    <div className={cx('grid gap-4 md:grid-cols-2 lg:grid-cols-3')}>
      <SummaryCard
        icon={Layers3}
        title='Minima'
        text={effectiveLoading && !effectiveStatus?.state ? <LoadingDots /> : formatNodeState(effectiveStatus?.state ?? null)}
      >
        {checkedLabel && (
          <p className='mt-1 mb-0 text-sm leading-6 text-slate-500'>{checkedLabel}</p>
        )}
      </SummaryCard>

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
        <Button type='button' size='sm' variant='secondary' className='mt-4 w-full' disabled={busy} onClick={onResync}>
          <RotateCw size={16} />
          Resync
        </Button>
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
