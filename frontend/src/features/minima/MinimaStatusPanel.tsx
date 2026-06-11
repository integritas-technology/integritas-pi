import { Activity, Box, Cpu, Users } from "lucide-react";
import type { MinimaNodeStatus } from "../../app/types";
import { Card } from "../../components/Card";
import { JsonPreview } from "../../components/JsonPreview";
import { StatusBadge } from "../../components/StatusBadge";
import { formatBlockAge, formatNodeState, nodeStateIsHealthy } from "./minimaFormat";
import { formatLocalTime, formatUtcTime } from "../../lib/time";

export function MinimaStatusPanel({
  status,
  error,
  loading
}: {
  status: MinimaNodeStatus | null;
  error: string | null;
  loading: boolean;
}) {
  const stateLabel = loading && !status ? "Checking…" : formatNodeState(status?.state ?? null);

  return (
    <Card>
      <div className="status-row">
        <div>
          <strong>Node health</strong>
          <p className="muted">
            {status?.checkedAt
              ? `Checked ${formatLocalTime(status.checkedAt)} local · ${formatUtcTime(status.checkedAt)} UTC`
              : "Live status from Minima RPC and Docker."}
          </p>
        </div>
        <StatusBadge ok={nodeStateIsHealthy(status?.state ?? null)}>{stateLabel}</StatusBadge>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="metrics-grid">
        <article className="metric-card">
          <div className="metric-icon"><Activity size={22} /></div>
          <p className="muted">Current block</p>
          <h3>{status?.sync.block ?? "—"}</h3>
          <p className="muted">Last block {formatBlockAge(status?.sync.blockAgeSeconds ?? null)}</p>
        </article>

        <article className="metric-card">
          <div className="metric-icon"><Users size={22} /></div>
          <p className="muted">Peer connections</p>
          <h3>{status?.health.peerCount ?? "—"}</h3>
          <p className="muted">
            {status?.sync.synced === null || status?.sync.synced === undefined
              ? "Sync state unknown"
              : status.sync.synced
                ? "Synced"
                : "Syncing"}
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-icon"><Cpu size={22} /></div>
          <p className="muted">Container CPU</p>
          <h3>{status?.container?.cpuPercent != null ? `${status.container.cpuPercent}%` : "—"}</h3>
          <p className="muted">
            Memory {status?.container?.memory?.usage ?? "—"}
            {status?.container?.memory?.limit ? ` / ${status.container.memory.limit}` : ""}
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-icon"><Box size={22} /></div>
          <p className="muted">Container storage</p>
          <h3>{status?.storage.containerDisk ?? "—"}</h3>
          <p className="muted">Data path {status?.storage.dataPath ?? "/home/minima/data"}</p>
        </article>
      </div>

      {status?.container && (
        <p className="muted">
          Docker: {status.container.state} — {status.container.status}
        </p>
      )}

      {status?.rpc.error && <p className="error-text">{status.rpc.error}</p>}

      {status?.rpc.raw !== undefined && <JsonPreview value={status.rpc.raw} label="View RPC debug" />}
    </Card>
  );
}
