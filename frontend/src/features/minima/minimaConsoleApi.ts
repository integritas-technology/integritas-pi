import type { MinimaConsoleRunResult, MinimaConsoleWhitelist } from "../../app/types";
import { getJson, postJson } from "../../lib/api";

export function getConsoleWhitelist() {
  return getJson<MinimaConsoleWhitelist>("/api/minima/console/whitelist");
}

export function updateConsoleWhitelist(enabledKeys: string[], currentPassword: string) {
  return postJson<MinimaConsoleWhitelist>("/api/minima/console/whitelist", { enabledKeys, currentPassword });
}

export function runConsoleCommand(command: string) {
  return postJson<MinimaConsoleRunResult>("/api/minima/console/run", { command });
}
