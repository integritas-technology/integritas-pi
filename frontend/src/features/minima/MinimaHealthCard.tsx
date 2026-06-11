import type { MinimaNodeStatus } from "../../app/types";
import { JsonPreview } from "../../components/JsonPreview";
import { formatBlockAge } from "./minimaFormat";
import { MinimaStatCell, MinimaStatGrid } from "./MinimaStatCell";
import { formatLocalTime, formatUtcTime } from "../../lib/time";

export function MinimaHealthCard({
  status,
  error,
  loading
}: {
  status: MinimaNodeStatus | null;
  error: string | null;
  loading: boolean;
}) {
  const memoryLabel = status?.node.memoryRam ?? (loading ? "Checking…" : "—");
  const peerLabel = status?.health.peerCount != null ? String(status.health.peerCount) : loading ? "Checking…" : "—";
  const blockAgeLabel =
    status?.sync.blockAgeSeconds != null
      ? formatBlockAge(status.sync.blockAgeSeconds)
      : status?.sync.blockTime
        ? formatLocalTime(status.sync.blockTime)
        : loading
          ? "Checking…"
          : "—";
  const currentBlockLabel = status?.sync.block != null ? String(status.sync.block) : loading ? "Checking…" : "—";

  const checkedLine = status?.checkedAt
    ? `Checked ${formatLocalTime(status.checkedAt)} local · ${formatUtcTime(status.checkedAt)} UTC`
    : "Chain and process metrics from Minima RPC.";

  return (
    <div className="grid gap-4">
      <MinimaStatGrid title="Node health" description={checkedLine}>
        <MinimaStatCell label="Node memory" value={memoryLabel} />
        <MinimaStatCell label="Peer connections" value={peerLabel} />
        <MinimaStatCell label="Last block" value={blockAgeLabel} />
        <MinimaStatCell label="Current block" value={currentBlockLabel} />
      </MinimaStatGrid>

      {error && <p className="mb-0 text-sm text-amber-800">{error}</p>}
      {status?.rpc.error && <p className="error-text">{status.rpc.error}</p>}

      {status?.rpc.raw !== undefined && (
        <JsonPreview value={status.rpc.raw} label="View RPC debug" />
      )}
    </div>
  );
}
