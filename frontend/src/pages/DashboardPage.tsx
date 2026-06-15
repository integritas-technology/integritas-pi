import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  RadioTower,
  Server,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Page } from '../components/Page';
import { Pill } from '../components/Pill';
import { listDataReads } from '../features/data-reads/dataReadsApi';
import type { DataSourceRead } from '../features/data-reads/dataReadTypes';
import { getHistory } from '../features/integritas/integritasApi';
import type { IntegritasProofRecord } from '../features/integritas/integritasTypes';
import { useIntegritasHistoryAutoRefresh } from '../features/integritas/useIntegritasHistoryAutoRefresh';
import { getDeviceStatus } from '../features/status/statusApi';
import type {
  DeviceNodeState,
  DeviceStatus,
} from '../features/status/statusTypes';
import { getWalletStatus } from '../features/wallet/walletApi';
import { MinimaIcon } from '../components/MinimaIcon';
import { cx } from '../lib/cx';
import { formatLocalTime } from '../lib/time';

type ActivityItem = {
  id: string;
  createdAt: string;
  category: string;
  message: string;
  status: string;
  good: boolean;
};

const useCaseSteps = [
  {
    number: '01',
    title: 'Connect data',
    text: 'Sensor, file, API, webhook, or device log',
    icon: Database,
  },
  {
    number: '02',
    title: 'Prove data',
    text: 'Integritas timestamp, integrity check, and provenance',
    icon: ShieldCheck,
  },
  {
    number: '03',
    title: 'Trigger action',
    text: 'Run workflows from data, proofs, or token events',
    icon: Zap,
  },
  {
    number: '04',
    title: 'Settle value',
    text: 'Wallet payments, token access, and future marketplace revenue',
    icon: Wallet,
  },
];

const buildSteps = [
  {
    number: '1',
    title: 'Deploy Edge Stack',
    text: 'Install the Raspberry Pi Edition bundle and open Edge Workbench.',
  },
  {
    number: '2',
    title: 'Create wallet',
    text: 'Create or import a Minima wallet for payments, tokens, and future marketplace revenue.',
  },
  {
    number: '3',
    title: 'Connect data',
    text: 'Bring in sensor streams, device logs, local files, or APIs.',
  },
  {
    number: '4',
    title: 'Verify with Integritas',
    text: 'Timestamp and attest selected data so it can be trusted.',
  },
  {
    number: '5',
    title: 'Automate events',
    text: 'Trigger actions when payments, tokens, data, or proofs change.',
  },
  {
    number: '6',
    title: 'Build the use case',
    text: 'Combine node, wallet, data, proof, and automation tools into a working edge workflow.',
  },
];

export function DashboardPage({ onStartSetup }: { onStartSetup: () => void }) {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [proofs, setProofs] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = () => getDeviceStatus().then(setDeviceStatus).catch(() => {});
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 30_000);

    getWalletStatus()
      .then((ws) => {
        const native = ws.tokens.find((t) => t.isNative);
        setWalletBalance(native?.confirmed ?? "0");
      })
      .catch(() => setWalletBalance(null));

    Promise.all([getHistory(), listDataReads()])
      .then(([proofHistory, readHistory]) => {
        setProofs(proofHistory.items);
        setReads(readHistory.items);
      })
      .catch((err: Error) => setActivityError(err.message));

    return () => clearInterval(statusInterval);
  }, []);

  useIntegritasHistoryAutoRefresh(proofs, setProofs);

  const activity = useMemo(() => buildActivity(proofs, reads), [proofs, reads]);

  return (
    <Page
      eyebrow='Dashboard'
      title='Minima Edge Workbench'
      desc='A browser-first workspace for trusted data, proofs, automation, and value flows at the edge.'
    >
      {deviceStatus && <DeviceStatusCard status={deviceStatus} walletBalance={walletBalance} />}

      <section className='hero-card use-case-hero'>
        <div className='hero-intro'>
          <div className='hero-pills'>
            <Pill>Pi Edition</Pill>
            <Pill>Edge Workbench</Pill>
            <Pill>Minima Core only</Pill>
          </div>
          <h1>Minima Edge Workbench</h1>
          <p>
            Turn a Raspberry Pi into a Minima-powered edge gateway. Run a node,
            manage wallet and token workflows, verify local data with
            Integritas, and automate trusted edge events from a simple browser
            UI.
          </p>
          <div className='hero-actions'>
            <button type='button' onClick={onStartSetup}>
              Start setup
            </button>
          </div>
        </div>
        <div className='use-case-panel'>
          <p className='eyebrow'>Use case builder</p>
          <h2>Data to value</h2>
          <p>Connect. Prove. Trigger. Settle.</p>
          {useCaseSteps.map((step) => (
            <article className='use-case-step' key={step.number}>
              <div className='use-case-icon'>
                <step.icon size={18} />
              </div>
              <span>{step.number}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Card className='build-flow-card'>
        <div>
          <p className='eyebrow'>Build flow</p>
          <h3>From setup to trusted edge workflow</h3>
          <p className='muted'>
            Each step has one job: deploy, connect, prove, automate, then build.
          </p>
        </div>
        <div className='build-flow-grid'>
          {buildSteps.map((step) => (
            <article className='build-flow-step' key={step.number}>
              <span>{step.number}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Card className='live-activity-card'>
        <div>
          <p className='eyebrow'>Live activity</p>
          <h3>Events, attestations, and actions</h3>
          <p className='muted'>
            A clear activity layer helps users understand what the Pi is doing
            in the background.
          </p>
        </div>
        {activityError && <p className='error-text'>{activityError}</p>}
        <div className='activity-list'>
          {activity.map((item) => (
            <article className='activity-item' key={item.id}>
              <div>
                <strong>{item.category}</strong>
                <p>{item.message}</p>
              </div>
              <time>{formatLocalTime(item.createdAt)}</time>
              <span className={item.good ? 'pill pill-good' : 'pill pill-warn'}>
                {item.status}
              </span>
            </article>
          ))}
        </div>
        {activity.length === 0 && !activityError && (
          <p className='muted'>No Diagnostics history entries yet.</p>
        )}
      </Card>
    </Page>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function pct(used: number, total: number) {
  return `${Math.round((used / total) * 100)}%`;
}

function nodeStateValueClass(state: DeviceNodeState) {
  if (state === 'running') return 'text-emerald-600';
  if (state === 'unknown') return 'text-slate-400';
  return 'text-amber-600';
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  valueClass = 'text-slate-950',
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: LucideIcon;
  valueClass?: string;
}) {
  return (
    <Card className='p-5!'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm text-slate-500'>{label}</p>
          <p
            className={cx(
              'mt-2 truncate text-2xl font-semibold tracking-tight',
              valueClass,
            )}
          >
            {value}
          </p>
          <p className='mt-1 text-sm text-slate-500'>{helper}</p>
        </div>
        <div className='shrink-0 rounded-2xl bg-slate-100 p-3 text-slate-700'>
          <Icon size={22} />
        </div>
      </div>
    </Card>
  );
}

function DeviceStatusCard({ status, walletBalance }: { status: DeviceStatus; walletBalance: string | null }) {
  const { device, app, node } = status;
  const cpuPct = `${Math.round((device.loadAvg[0] / device.cpuCount) * 100)}%`;
  const diskValue = device.disk ? formatBytes(device.disk.usedBytes) : 'N/A';
  const diskHelper = device.disk
    ? `of ${formatBytes(device.disk.totalBytes)} · ${pct(device.disk.usedBytes, device.disk.totalBytes)} used`
    : '/data unavailable';
  return (
    <div className='grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
      <MetricCard
        label='Device'
        value={device.hostname}
        helper={`${device.platform} · ${device.arch}`}
        icon={Server}
      />
      <MetricCard
        label='CPU'
        value={cpuPct}
        helper={`${device.cpuCount}-core · ${device.loadAvg[0].toFixed(2)} 1m avg`}
        icon={Cpu}
      />
      <MetricCard
        label='Memory'
        value={formatBytes(device.memory.usedBytes)}
        helper={`of ${formatBytes(device.memory.totalBytes)} · ${pct(device.memory.usedBytes, device.memory.totalBytes)} used`}
        icon={MemoryStick}
      />
      <MetricCard
        label='Disk'
        value={diskValue}
        helper={diskHelper}
        icon={HardDrive}
      />
      <MetricCard
        label='Node status'
        value={node.state.charAt(0).toUpperCase() + node.state.slice(1)}
        helper='Minima node'
        icon={RadioTower}
        valueClass={nodeStateValueClass(node.state)}
      />
      <MetricCard
        label='Integritas API'
        value={
          app.integritasConnected === null
            ? 'Not configured'
            : app.integritasConnected
              ? 'Connected'
              : 'Unreachable'
        }
        helper='API connection'
        icon={ShieldCheck}
        valueClass={
          app.integritasConnected === null
            ? 'text-slate-400'
            : app.integritasConnected
              ? 'text-emerald-600'
              : 'text-amber-600'
        }
      />
      <MetricCard
        label='Wallet balance'
        value={
          walletBalance === null ? (
            'Unavailable'
          ) : (
            <span className='inline-flex items-center gap-2'>
              <MinimaIcon size={20} className='shrink-0 text-slate-600' />
              {walletBalance}
            </span>
          )
        }
        helper='Primary Pi wallet'
        icon={Wallet}
        valueClass={walletBalance === null ? 'text-slate-400' : 'text-slate-950'}
      />
    </div>
  );
}

function buildActivity(
  proofs: IntegritasProofRecord[],
  reads: DataSourceRead[],
) {
  const proofItems: ActivityItem[] = proofs.map((proof) => ({
    id: `proof-${proof.id}`,
    createdAt: proof.created_at,
    category: 'Integritas API log',
    message: `Attestation created for ${proof.file_name ?? proof.hash.slice(0, 16)}`,
    status:
      proof.proof_status === 'ready'
        ? 'Success'
        : proof.proof_status === 'failed'
          ? 'Failed'
          : 'Pending',
    good: proof.proof_status !== 'failed',
  }));

  const readItems: ActivityItem[] = reads.map((read) => ({
    id: `read-${read.id}`,
    createdAt: read.createdAt,
    category:
      read.triggerType === 'automation' ? 'Trigger history' : 'Data read log',
    message: `${read.sourceName} ${read.triggerType === 'automation' ? 'automation poll' : 'manual read'}`,
    status: read.status === 'success' ? 'Success' : 'Failed',
    good: read.status === 'success',
  }));

  return [...proofItems, ...readItems]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 10);
}
