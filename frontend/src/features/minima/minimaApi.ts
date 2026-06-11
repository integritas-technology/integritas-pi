import type {
  MinimaCommandResult,
  MinimaConfig,
  MinimaNodeStatus,
  MinimaPeersResponse,
  MinimaRestartResult
} from "../../app/types";
import { getJson, postJson } from "../../lib/api";

export function getMinimaNodeStatus() {
  return getJson<MinimaNodeStatus>("/api/minima/status");
}

export function getMinimaConfig() {
  return getJson<MinimaConfig>("/api/minima/config");
}

export function saveMinimaConfig(megammrHost: string) {
  return postJson<MinimaConfig>("/api/minima/config", { megammrHost });
}

export function resyncMegammr() {
  return postJson<MinimaCommandResult>("/api/minima/megammrsync/resync");
}

export function getMinimaPeers() {
  return getJson<MinimaPeersResponse>("/api/minima/peers");
}

export function addMinimaPeers(peerslist: string) {
  return postJson<MinimaCommandResult>("/api/minima/peers/add", { peerslist });
}

export function restartMinimaContainer() {
  return postJson<MinimaRestartResult>("/api/minima/restart");
}
