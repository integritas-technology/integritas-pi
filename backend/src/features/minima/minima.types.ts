export type MinimaNodeState = "running" | "stopped" | "error";

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
    block: number | null;
    blockTime: string | null;
    blockAgeSeconds: number | null;
  };
  health: {
    peerCount: number | null;
  };
  storage: {
    dataPath: string;
    containerDisk: string | null;
  };
  config: {
    megammrHost: string;
    megammrHostSource: "database" | "default";
  };
};
