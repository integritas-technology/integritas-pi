import { HardDrive, Layers3, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  MinimaCommandResult,
  MinimaConfig,
  MinimaNodeStatus,
} from '../../app/types';
import { Card } from '../../components/Card';
import { JsonPreview } from '../../components/JsonPreview';
import { cx } from '../../lib/cx';
import { formatNodeState, formatSyncState } from './minimaFormat';

function SummaryCard({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children?: React.ReactNode;
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
  config,
  loading,
  busy,
  result,
  onResync,
}: {
  status: MinimaNodeStatus | null;
  config: MinimaConfig | null;
  loading: boolean;
  busy: boolean;
  result: MinimaCommandResult | null;
  onResync: () => void;
}) {
  const megammrHost =
    config?.megammrHost ??
    status?.config.megammrHost ??
    'megammr.minima.global:9001';
  const storageLabel = status?.storage.chainDataDisk
    ? `${status.storage.chainDataDisk} chain data`
    : status?.node.memoryDisk
      ? `${status.node.memoryDisk} chain data`
      : loading
        ? 'Checking…'
        : 'Unavailable';

  return (
    <div className={cx('grid gap-4 md:grid-cols-2 lg:grid-cols-3')}>
      <SummaryCard
        icon={Layers3}
        title='Minima'
        text={formatNodeState(status?.state ?? null, loading)}
      />

      <SummaryCard
        icon={RefreshCw}
        title='Sync status'
        text={formatSyncState(status?.sync.synced, loading)}
      >
        <div className='mt-4 grid gap-2'>
          <p className='m-0 text-xs leading-5 text-slate-500'>
            Megammr host <code className='text-slate-700'>{megammrHost}</code>
          </p>
          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='button'
              className='w-fit rounded-[14px] border-0 bg-slate-950 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60'
              disabled={busy}
              onClick={onResync}
            >
              Resync
            </button>
            {result && (
              <JsonPreview value={result} label='View resync result' />
            )}
          </div>
        </div>
      </SummaryCard>

      <SummaryCard icon={HardDrive} title='Local storage' text={storageLabel} />
    </div>
  );
}
