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
  const peerLabel =
    status?.health.peerCount != null ? String(status.health.peerCount) : loading ? "Checking…" : "—";
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

  const monitoring = status?.monitoring;

  const footer = (
    <>
      {error && <p className="mb-2 text-sm text-amber-800">{error}</p>}
      {status?.rpc.error && <p className="error-text mb-2">{status.rpc.error}</p>}
      {status?.rpc.raw !== undefined ? (
        <JsonPreview value={status.rpc.raw} label="View RPC debug" />
      ) : null}
    </>
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {monitoring?.stallDetected && (
        <p className="mb-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Chain stall detected — last block is older than {monitoring.stallThresholdSeconds}s.
          {monitoring.autoResyncEnabled
            ? monitoring.lastAutoResyncAt
              ? ` Last auto-resync: ${formatLocalTime(monitoring.lastAutoResyncAt)} (${monitoring.lastAutoResyncResult ?? "no details"}).`
              : " Auto-resync is enabled; the backend poller will attempt resync when cooldown allows."
            : " Consider a manual Megammr resync or check peer connectivity."}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <MinimaStatGrid title="Node health" description={checkedLine} footer={footer}>
          <MinimaStatCell label="Node memory" value={memoryLabel} />
          <MinimaStatCell label="Active peers" value={peerLabel} />
          <MinimaStatCell label="Last block" value={blockAgeLabel} />
          <MinimaStatCell label="Current block" value={currentBlockLabel} />
        </MinimaStatGrid>
      </div>
    </div>
  );
}
