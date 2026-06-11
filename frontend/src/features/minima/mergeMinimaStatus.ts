import type { MinimaNodeStatus } from "../../app/types";

function hasNodeMetrics(status: MinimaNodeStatus) {
  return (
    status.sync.block != null ||
    status.health.peerCount != null ||
    status.node.memoryRam != null
  );
}

export function mergeMinimaStatus(previous: MinimaNodeStatus | null, next: MinimaNodeStatus): MinimaNodeStatus {
  if (!previous || next.rpc.ok) return next;
  if (!hasNodeMetrics(previous)) return next;

  return {
    ...next,
    state: previous.state === "running" ? previous.state : next.state,
    sync: hasNodeMetrics(previous) ? previous.sync : next.sync,
    health: previous.health.peerCount != null ? previous.health : next.health,
    node: previous.node.memoryRam ? previous.node : next.node,
    storage: previous.storage.chainDataDisk ? previous.storage : next.storage,
    rpc: {
      ...next.rpc,
      raw: next.rpc.raw ?? previous.rpc.raw
    }
  };
}
