import type { MinimaCommandResult, MinimaConfig, MinimaNodeStatus } from "../../app/types";
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
