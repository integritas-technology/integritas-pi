import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { getMinimaContainerStats, getMinimaStorageInfo } from "./minima.docker.js";
import { parsePeersResponse, parseStatusResponse } from "./minima.parse.js";
import { fetchMinimaStatus, runMinimaPathCommand } from "./minima.rpc.js";
import type { MinimaNodeState, MinimaNodeStatus } from "./minima.types.js";

const megammrHostSetting = "minima_megammr_host";
const defaultMegammrHost = "megammr.minima.global:9001";

export function getMinimaConfig() {
  const storedMegammrHost = getSetting(megammrHostSetting).trim();
  return {
    megammrHost: storedMegammrHost || defaultMegammrHost,
    megammrHostSource: storedMegammrHost ? ("database" as const) : ("default" as const)
  };
}

export function saveMinimaConfig({ megammrHost }: { megammrHost: string }) {
  const trimmedMegammrHost = megammrHost.trim();
  if (!trimmedMegammrHost) throw new Error("megammrHost is required");
  saveSetting(megammrHostSetting, trimmedMegammrHost);
  return getMinimaConfig();
}

function deriveNodeState(
  container: { state: string } | null,
  rpcReachable: boolean,
  rpcOk: boolean
): MinimaNodeState {
  if (container && container.state !== "running") return "stopped";
  if (!rpcReachable || !rpcOk) return "error";
  return "running";
}

export async function getMinimaNodeStatus(): Promise<MinimaNodeStatus> {
  const checkedAt = new Date().toISOString();
  const config = getMinimaConfig();

  const [containerStats, rpcResult] = await Promise.all([
    getMinimaContainerStats().catch(() => null),
    fetchMinimaStatus().catch((error) => ({
      failed: true as const,
      error: error instanceof Error ? error.message : "Unknown error"
    }))
  ]);

  if ("failed" in rpcResult) {
    const state = containerStats && containerStats.state !== "running" ? "stopped" : "error";
    return {
      checkedAt,
      state,
      container: containerStats
        ? {
            state: containerStats.state,
            status: containerStats.status,
            cpuPercent: containerStats.cpuPercent,
            memory: containerStats.memory
          }
        : null,
      rpc: { ok: false, error: rpcResult.error },
      sync: { synced: null, block: null, blockTime: null, blockAgeSeconds: null },
      health: { peerCount: null },
      storage: getMinimaStorageInfo(containerStats?.containerDisk),
      config
    };
  }

  const parsed = parseStatusResponse(rpcResult.body);
  let peerCount = parsed.peerCount;

  if (peerCount === null && parsed.rpcOk) {
    try {
      const peersResult = await runMinimaPathCommand("peers");
      peerCount = parsePeersResponse(peersResult.body);
    } catch {
      peerCount = null;
    }
  }

  const rpcReachable = rpcResult.ok;
  const state = deriveNodeState(containerStats, rpcReachable, parsed.rpcOk);

  return {
    checkedAt,
    state,
    container: containerStats
      ? {
          state: containerStats.state,
          status: containerStats.status,
          cpuPercent: containerStats.cpuPercent,
          memory: containerStats.memory
        }
      : null,
    rpc: {
      ok: rpcReachable && parsed.rpcOk,
      error: !rpcReachable ? `HTTP ${rpcResult.status}` : parsed.rpcOk ? undefined : "Minima RPC returned status: false",
      raw: rpcResult.body
    },
    sync: {
      synced: parsed.synced,
      block: parsed.block,
      blockTime: parsed.blockTime,
      blockAgeSeconds: parsed.blockAgeSeconds
    },
    health: { peerCount },
    storage: getMinimaStorageInfo(containerStats?.containerDisk),
    config
  };
}

export async function getWalletBalance() {
  return runMinimaPathCommand("balance");
}

export async function resyncMegammr() {
  const { megammrHost } = getMinimaConfig();
  const command = `megammrsync action:resync host:${megammrHost}`;
  return runMinimaPathCommand(command, 30000);
}
