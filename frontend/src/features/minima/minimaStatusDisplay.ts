import type { MinimaNodeStatus } from "../../app/types";

function hasDisplayMetrics(status: MinimaNodeStatus) {
  return (
    status.sync.block != null ||
    status.health.peerCount != null ||
    status.node.memoryRam != null
  );
}

export function isTransientMinimaRpcError(message: string | undefined) {
  if (!message) return false;
  return /fetch failed|temporarily unreachable|econnrefused|etimedout|socket hang up|aborted/i.test(message);
}

export function shouldShowMinimaRpcError(status: MinimaNodeStatus | null) {
  if (!status?.rpc.error || status.rpc.ok) return false;
  if (hasDisplayMetrics(status) && isTransientMinimaRpcError(status.rpc.error)) return false;
  return true;
}
