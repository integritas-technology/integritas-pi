import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DarkHeroCard } from "../components/DarkHeroCard";
import { Page } from "../components/Page";
import { Pill } from "../components/Pill";
import { ErrorText, Eyebrow, MutedText } from "../components/Text";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { getHistory } from "../features/integritas/integritasApi";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import { getDeviceStatus } from "../features/status/statusApi";
import type { DeviceNodeState, DeviceStatus } from "../features/status/statusTypes";
import { getWalletStatus } from "../features/wallet/walletApi";
import { LoadingDots } from "../components/LoadingDots";
import { MinimaIcon } from "../components/MinimaIcon";
import { cx } from "../lib/cx";
import { formatAmountThreshold } from "../lib/format";
import { formatLocalTime } from "../lib/time";
import { APP_NAME } from "../app/names";
import { DashboardNextAction } from "./DashboardNextAction";

const DASHBOARD_POLL_INTERVAL_MS = 30_000;
const STATUS_RESTARTING_INTERVAL_MS = 3_000;

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
    number: "01",
    title: "Connect data",
    text: "Sensor, file, API, webhook, or device log",
    icon: Database,
  },
  {
    number: "02",
    title: "Prove data",
    text: "Integritas timestamp, integrity check, and provenance",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Trigger action",
    text: "Run workflows from data, proofs, or token events",
    icon: Zap,
  },
  {
    number: "04",
    title: "Settle value",
    text: "Wallet payments, token access, and future marketplace revenue",
    icon: Wallet,
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [proofs, setProofs] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    // Wallet balance is only meaningful when the node can actually answer RPC calls,
    // so fetch it in lockstep with node status instead of on its own independent timer —
    // otherwise the two drift out of sync (e.g. wallet still shows a pre-restart balance
    // after the node status has already flipped to "restarting").
    const tick = () => {
      getDeviceStatus()
        .then((status) => {
          if (cancelled) return;
          setDeviceStatus(status);

          if (status.node.state === "restarting") {
            setWalletLoading(true);
            setWalletBalance(null);
            timer = window.setTimeout(tick, STATUS_RESTARTING_INTERVAL_MS);
            return;
          }

          getWalletStatus()
            .then((ws) => {
              if (cancelled) return;
              const native = ws.tokens.find((t) => t.isNative);
              setWalletBalance(native?.confirmed ?? "0");
            })
            .catch(() => {
              if (cancelled) return;
              setWalletBalance(null);
            })
            .finally(() => {
              if (cancelled) return;
              setWalletLoading(false);
              timer = window.setTimeout(tick, DASHBOARD_POLL_INTERVAL_MS);
            });
        })
        .catch(() => {
          if (cancelled) return;
          timer = window.setTimeout(tick, DASHBOARD_POLL_INTERVAL_MS);
        });
    };
    tick();

    Promise.all([getHistory({ page: 1, pageSize: 100 }), listDataReads({ page: 1, pageSize: 100 })])
      .then(([proofHistory, readHistory]) => {
        setProofs(proofHistory.items);
        setReads(readHistory.items);
      })
      .catch((err: Error) => setActivityError(err.message));

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useIntegritasHistoryAutoRefresh(proofs, setProofs, { query: { page: 1, pageSize: 100 } });

  const activity = useMemo(() => buildActivity(proofs, reads), [proofs, reads]);

  return (
    <Page
      eyebrow="Dashboard"
      title={APP_NAME}
      desc="A browser-first workspace for trusted data, proofs, automation, and value flows at the edge."
    >
      {/* <DarkHeroCard className='items-start lg:grid-cols-[1.35fr_0.65fr]'>
        <div className='relative z-10 grid content-start gap-[18px]'>
          <div className='flex flex-wrap gap-2'>
            <Pill>Pi Edition</Pill>
            <Pill>Edge Workbench</Pill>
            <Pill>Minima Core only</Pill>
          </div>
          <h1 className='m-0 mt-1.5 max-w-[760px] text-[clamp(2.25rem,6vw,3.6rem)] leading-none tracking-[-0.04em]'>Minima Edge Workbench</h1>
          <p className='max-w-[760px] leading-7 text-slate-300'>
            Turn a Raspberry Pi into a Minima-powered edge gateway. Run a node,
            manage wallet and token workflows, verify local data with
            Integritas, and automate trusted edge events from a simple browser
            UI.
          </p>
          <div className='flex flex-wrap gap-2.5'>
            <Button type='button' variant='secondary' className='border-transparent bg-white text-slate-950 hover:bg-slate-100' onClick={() => navigate("/setup")}>
              Start setup
            </Button>
          </div>
        </div>
        <div className='relative z-10 grid gap-3 rounded-[24px] border border-white/15 bg-gradient-to-br from-cyan-950/70 to-violet-950/70 p-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'>
          <Eyebrow className='text-slate-300'>Use case builder</Eyebrow>
          <h2 className='m-0 text-xl text-white'>Data to value</h2>
          <p className='m-0 mb-2 text-slate-300'>Connect. Prove. Trigger. Settle.</p>
          {useCaseSteps.map((step) => (
            <article className='grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-4' key={step.number}>
              <div className='grid size-[34px] place-items-center rounded-xl bg-white/15 text-white'>
                <step.icon size={18} />
              </div>
              <span className='text-xs font-black tracking-wide text-slate-300'>{step.number}</span>
              <div>
                <strong className='text-white'>{step.title}</strong>
                <p className='m-0 text-slate-300'>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </DarkHeroCard> */}

      <DashboardNextAction />

      <DeviceStatusCard status={deviceStatus} walletBalance={walletBalance} walletLoading={walletLoading} />

      <Card className="grid gap-5">
        <div>
          <Eyebrow>Live activity</Eyebrow>
          <h3 className="my-2 text-2xl text-slate-950">Events, attestations, and actions</h3>
          <MutedText className="m-0">
            A clear activity layer helps users understand what the Pi is doing in the background.
          </MutedText>
        </div>
        {activityError && <ErrorText>{activityError}</ErrorText>}
        <div className="grid gap-2.5">
          {activity.map((item) => (
            <article
              className="grid items-center gap-3.5 rounded-[18px] border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              key={item.id}
            >
              <div>
                <strong>{item.category}</strong>
                <MutedText className="m-0 mt-1.5 leading-relaxed">{item.message}</MutedText>
              </div>
              <time className="font-mono text-sm font-extrabold text-slate-600">
                {formatLocalTime(item.createdAt)}
              </time>
              <Pill tone={item.good ? "good" : "warn"}>{item.status}</Pill>
            </article>
          ))}
        </div>
        {activity.length === 0 && !activityError && (
          <MutedText>No Diagnostics history entries yet.</MutedText>
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
  if (state === "running") return "text-emerald-600";
  if (state === "restarting") return "text-blue-600";
  if (state === "unknown") return "text-slate-400";
  return "text-amber-600";
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  valueClass = "text-slate-950",
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: LucideIcon;
  valueClass?: string;
}) {
  return (
    <Card className="p-5!">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{label}</p>
          <p
            className={cx(
              "mt-2 min-w-0 truncate text-2xl font-semibold tracking-tight",
              valueClass,
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon size={22} />
        </div>
      </div>
    </Card>
  );
}

function DeviceStatusCard({
  status,
  walletBalance,
  walletLoading,
}: {
  status: DeviceStatus | null;
  walletBalance: string | null;
  walletLoading: boolean;
}) {
  const device = status?.device ?? null;
  const app = status?.app ?? null;
  const node = status?.node ?? null;
  const nodeRestarting = node?.state === "restarting";
  const cpuPct = device ? `${Math.round((device.loadAvg[0] / device.cpuCount) * 100)}%` : null;
  const diskValue = device ? (device.disk ? formatBytes(device.disk.usedBytes) : "N/A") : null;
  const diskHelper = device
    ? device.disk
      ? `of ${formatBytes(device.disk.totalBytes)} · ${pct(device.disk.usedBytes, device.disk.totalBytes)} used`
      : "/data unavailable"
    : "";
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Wallet balance"
          value={
            walletLoading && !nodeRestarting ? (
              <LoadingDots />
            ) : nodeRestarting || walletBalance === null ? (
              "Unavailable"
            ) : (
              <span className="flex min-w-0 items-center gap-2">
                <MinimaIcon size={20} className="shrink-0 text-slate-600" />
                <span className="min-w-0 truncate" title={walletBalance}>
                  {formatAmountThreshold(walletBalance)}
                </span>
              </span>
            )
          }
          helper="Primary Pi wallet"
          icon={Wallet}
          valueClass={
            walletLoading || walletBalance === null ? "text-slate-400" : "text-slate-950"
          }
        />
        <MetricCard
          label="Node status"
          value={node ? node.state.charAt(0).toUpperCase() + node.state.slice(1) : <LoadingDots />}
          helper="Minima node"
          icon={RadioTower}
          valueClass={node ? nodeStateValueClass(node.state) : "text-slate-400"}
        />
        <MetricCard
          label="Integritas API"
          value={
            !app ? (
              <LoadingDots />
            ) : app.integritasConnected === null ? (
              "Not configured"
            ) : app.integritasConnected ? (
              "Connected"
            ) : (
              "Unreachable"
            )
          }
          helper="API connection"
          icon={ShieldCheck}
          valueClass={
            !app || app.integritasConnected === null
              ? "text-slate-400"
              : app.integritasConnected
                ? "text-emerald-600"
                : "text-amber-600"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Device"
          value={device ? device.hostname : <LoadingDots />}
          helper={device ? `${device.platform} · ${device.arch}` : ""}
          icon={Server}
        />
        <MetricCard
          label="Device CPU"
          value={cpuPct ?? <LoadingDots />}
          helper={device ? `${device.cpuCount}-core · ${device.loadAvg[0].toFixed(2)} 1m avg` : ""}
          icon={Cpu}
        />
        <MetricCard
          label="Device Memory"
          value={device ? formatBytes(device.memory.usedBytes) : <LoadingDots />}
          helper={
            device
              ? `of ${formatBytes(device.memory.totalBytes)} · ${pct(device.memory.usedBytes, device.memory.totalBytes)} used`
              : ""
          }
          icon={MemoryStick}
        />
        <MetricCard
          label="Device Disk"
          value={diskValue ?? <LoadingDots />}
          helper={diskHelper}
          icon={HardDrive}
        />
      </div>
    </>
  );
}

function buildActivity(proofs: IntegritasProofRecord[], reads: DataSourceRead[]) {
  const proofItems: ActivityItem[] = proofs.map((proof) => ({
    id: `proof-${proof.id}`,
    createdAt: proof.created_at,
    category: "Integritas API log",
    message: `Attestation created for ${proof.file_name ?? proof.hash.slice(0, 16)}`,
    status:
      proof.proof_status === "ready"
        ? "Success"
        : proof.proof_status === "failed"
          ? "Failed"
          : "Pending",
    good: proof.proof_status !== "failed",
  }));

  const readItems: ActivityItem[] = reads.map((read) => ({
    id: `read-${read.id}`,
    createdAt: read.createdAt,
    category:
      read.triggerType === "automation"
        ? "Trigger history"
        : read.triggerType === "mqtt"
          ? "MQTT event"
          : read.triggerType === "webhook"
            ? "Webhook event"
            : read.triggerType === "gpio"
              ? "GPIO event"
              : "Data read log",
    message: `${read.sourceName} ${read.triggerType === "automation" ? "automation poll" : read.triggerType === "mqtt" ? "MQTT message received" : read.triggerType === "webhook" ? "webhook payload received" : read.triggerType === "gpio" ? "GPIO edge detected" : "manual read"}`,
    status: read.status === "success" ? "Success" : "Failed",
    good: read.status === "success",
  }));

  return [...proofItems, ...readItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);
}
