import type { MinimaNodeStatus } from "../../app/types";
import { JsonPreview } from "../../components/JsonPreview";
import { LoadingDots } from "../../components/LoadingDots";
import { ErrorText } from "../../components/Text";
import { formatBlockAge } from "./minimaFormat";
import { shouldShowMinimaRpcError } from "./minimaStatusDisplay";
import { MinimaStatCell, MinimaStatGrid } from "./MinimaStatCell";
import { formatLocalTime, formatUtcTime } from "../../lib/time";

export function MinimaHealthCard({
  status,
  error,
  loading,
  refreshing
}: {
  status: MinimaNodeStatus | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
}) {
  const effectiveStatus = refreshing ? null : status;
  const effectiveLoading = loading || refreshing;

  const memoryLabel = effectiveStatus?.node.memoryRam ?? (effectiveLoading ? <LoadingDots /> : "—");
  const peerLabel =
    effectiveStatus?.health.peerCount != null
      ? String(effectiveStatus.health.peerCount)
      : effectiveLoading
        ? <LoadingDots />
        : "—";
  const blockAgeLabel =
    effectiveStatus?.sync.blockAgeSeconds != null
      ? formatBlockAge(effectiveStatus.sync.blockAgeSeconds)
      : effectiveStatus?.sync.blockTime
        ? formatLocalTime(effectiveStatus.sync.blockTime)
        : effectiveLoading
          ? <LoadingDots />
          : "—";
  const currentBlockLabel =
    effectiveStatus?.sync.block != null ? String(effectiveStatus.sync.block) : effectiveLoading ? <LoadingDots /> : "—";

  const checkedLine = effectiveStatus?.checkedAt
    ? `Checked ${formatLocalTime(effectiveStatus.checkedAt)} local · ${formatUtcTime(effectiveStatus.checkedAt)} UTC`
    : "Chain and process metrics from Minima RPC.";

  const monitoring = effectiveStatus?.monitoring;

  const footer = (
    <>
      {error && <p className="mb-2 text-sm text-amber-800">{error}</p>}
      {shouldShowMinimaRpcError(effectiveStatus) && (
        <ErrorText className="mb-2">{effectiveStatus?.rpc.error}</ErrorText>
      )}
      {effectiveStatus?.rpc.raw !== undefined ? (
        <JsonPreview value={effectiveStatus.rpc.raw} label="View RPC debug" />
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
