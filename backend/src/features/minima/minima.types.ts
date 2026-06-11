export type MinimaNodeState = "running" | "stopped" | "error";
export type MinimaSyncStatus = "active" | "stale" | "syncing" | "unavailable";

export type MinimaNodeStatus = {
  checkedAt: string;
  state: MinimaNodeState;
  container: {
    state: string;
    status: string;
    cpuPercent: number | null;
    memory: { usage: string | null; limit: string | null } | null;
  } | null;
  rpc: {
    ok: boolean;
    error?: string;
    raw?: unknown;
  };
  sync: {
    synced: boolean | null;
    status: MinimaSyncStatus;
    block: number | null;
    blockTime: string | null;
    blockAgeSeconds: number | null;
  };
  health: {
    peerCount: number | null;
    peersKnown: number | null;
  };
  node: {
    memoryRam: string | null;
    memoryDisk: string | null;
  };
  storage: {
    dataPath: string;
    containerDisk: string | null;
    chainDataDisk: string | null;
  };
  config: {
    megammrHost: string;
    megammrHostSource: "database" | "default";
  };
  monitoring: {
    stallDetected: boolean;
    stallThresholdSeconds: number;
    autoResyncEnabled: boolean;
    lastPollerCheckAt: string | null;
    lastStallDetectedAt: string | null;
    lastAutoResyncAt: string | null;
    lastAutoResyncResult: string | null;
  };
};
