import type { MinimaNodeStatus } from "../../app/types";
import { Card } from "../../components/Card";
import { JsonPreview } from "../../components/JsonPreview";
import { cx } from "../../lib/cx";
import { formatBlockAge } from "./minimaFormat";
import { formatLocalTime, formatUtcTime } from "../../lib/time";

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="m-0 text-sm text-slate-500">{label}</p>
      <p className="mt-1 mb-0 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function MinimaHealthCard({
  status,
  error,
  loading
}: {
  status: MinimaNodeStatus | null;
  error: string | null;
  loading: boolean;
}) {
  const cpuLabel = status?.container?.cpuPercent != null ? `${status.container.cpuPercent}%` : loading ? "Checking…" : "—";
  const memoryLabel = status?.container?.memory?.usage ?? (loading ? "Checking…" : "—");
  const peerLabel = status?.health.peerCount != null ? String(status.health.peerCount) : loading ? "Checking…" : "—";
  const blockLabel = formatBlockAge(status?.sync.blockAgeSeconds ?? null);

  return (
    <Card>
      <h3 className="m-0 text-lg font-semibold text-slate-950">Node health</h3>
      {status?.checkedAt && (
        <p className="mt-2 mb-0 text-sm text-slate-500">
          Checked {formatLocalTime(status.checkedAt)} local · {formatUtcTime(status.checkedAt)} UTC
        </p>
      )}

      <div className={cx("mt-5 grid gap-4 md:grid-cols-2")}>
        <StatCell label="CPU load" value={cpuLabel} />
        <StatCell label="Memory usage" value={memoryLabel} />
        <StatCell label="Peer connections" value={peerLabel} />
        <StatCell label="Last block" value={blockLabel} />
      </div>

      {status?.sync.block != null && (
        <p className="mt-4 mb-0 text-sm text-slate-500">Current block {status.sync.block}</p>
      )}

      {status?.container && (
        <p className="mt-2 mb-0 text-sm text-slate-500">
          Container {status.container.state} — {status.container.status}
        </p>
      )}

      {error && <p className="error-text">{error}</p>}
      {status?.rpc.error && <p className="error-text">{status.rpc.error}</p>}

      {status?.rpc.raw !== undefined && (
        <div className="mt-4">
          <JsonPreview value={status.rpc.raw} label="View RPC debug" />
        </div>
      )}
    </Card>
  );
}
