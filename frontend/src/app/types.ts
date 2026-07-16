import type { LucideIcon } from "lucide-react";

export type Tone = "neutral" | "good" | "warn" | "future";
export type NavId = "dashboard" | "setup" | "node" | "wallet" | "integritas" | "data" | "automation" | "diagnostics" | "settings";
export type NavItem = { id: NavId; label: string; icon: LucideIcon; badge?: string };

export type Health = { status: string; service: string };
export type FileItem = { name: string; type: "file" | "directory" | "other"; size?: number };
export type FilesResponse = { path: string; items: FileItem[] };
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
export type MinimaConfig = { megammrHost: string; megammrHostSource: "database" | "default" };
export type MinimaCommandResult = { ok: boolean; status?: number; source: string; command?: string; body?: unknown; error?: string };
export type MinimaPeersResponse = {
  ok: boolean;
  count: number | null;
  peers: string[];
  source?: string;
  command?: string;
  error?: string;
};
export type MinimaRestartResult = {
  ok: true;
  state: "restarting";
  service: string;
  containerId: string;
};
export type IntegritasConfig = { baseUrl: string; requestId: string; hasApiKey: boolean; apiKeySource: "connect" | "database" | "environment" | "none"; portalUrl: string };
export type StatusOverview = {
  generatedAt: string;
  services: Array<{ name: string; ok: boolean; status: string; details?: unknown; error?: string }>;
  resources?: {
    containers?: Array<{
      service: string;
      containerId: string;
      state: string;
      status: string;
      cpuPercent: number | null;
      memory: { usage?: string | null; limit?: string | null } | null;
      disk: { rootFs?: string | null };
    }>;
    disks?: Array<{ path: string; used: string; total: string; free: string; usedPercent: number }>;
    error?: string;
  };
};
