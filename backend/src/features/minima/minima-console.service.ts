import { recordAuditEvent } from "../auth/audit.service.js";
import { findUserById } from "../auth/auth.repository.js";
import { verifyPassword } from "../auth/password.service.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { minimaConsoleCatalog, type ConsoleCommandEntry } from "./minima-console.catalog.js";
import { addMinimaPeers, resyncMegammr } from "./minima.service.js";
import { runMinimaPathCommand } from "./minima.rpc.js";

const whitelistSetting = "minima_console_whitelist";

export class MinimaConsoleError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function defaultEnabledKeys() {
  return minimaConsoleCatalog.filter((entry) => entry.defaultEnabled).map((entry) => entry.key);
}

function loadEnabledKeys(): string[] {
  const stored = getSetting(whitelistSetting).trim();
  if (!stored) return defaultEnabledKeys();

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return defaultEnabledKeys();
    const catalogKeys = new Set(minimaConsoleCatalog.map((entry) => entry.key));
    return parsed.filter((key): key is string => typeof key === "string" && catalogKeys.has(key));
  } catch {
    return defaultEnabledKeys();
  }
}

export function getConsoleWhitelist() {
  return {
    catalog: minimaConsoleCatalog.map(({ key, verb, label, kind, defaultEnabled }) => ({ key, verb, label, kind, defaultEnabled })),
    enabledKeys: loadEnabledKeys()
  };
}

export async function updateConsoleWhitelist(userId: string, input: { enabledKeys: string[]; currentPassword: string }) {
  const user = findUserById(userId);
  if (!user) throw new MinimaConsoleError("User not found", 404);

  const passwordValid = await verifyPassword(input.currentPassword, user.password);
  if (!passwordValid) throw new MinimaConsoleError("Invalid current credential", 401);

  const catalogKeys = new Set(minimaConsoleCatalog.map((entry) => entry.key));
  const requested = input.enabledKeys.filter((key) => typeof key === "string" && catalogKeys.has(key));
  const rejected = input.enabledKeys.filter((key) => !catalogKeys.has(key));
  if (rejected.length > 0) {
    throw new MinimaConsoleError(`Unknown console command key(s): ${rejected.join(", ")}`, 400);
  }

  const before = new Set(loadEnabledKeys());
  const after = new Set(requested);
  const turnedOn = requested.filter((key) => !before.has(key));
  const turnedOff = [...before].filter((key) => !after.has(key));

  saveSetting(whitelistSetting, JSON.stringify(requested));
  recordAuditEvent("minima.console.whitelist_updated", {
    userId,
    detail: `+${turnedOn.join(",") || "none"} -${turnedOff.join(",") || "none"}`
  });

  return getConsoleWhitelist();
}

function parseVerb(rawInput: string) {
  return rawInput.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function resolveCatalogEntry(rawInput: string): ConsoleCommandEntry | undefined {
  const verb = parseVerb(rawInput);
  if (!verb) return undefined;
  return minimaConsoleCatalog.find((entry) => entry.verb === verb && (entry.match ? entry.match(rawInput) : true));
}

export async function runConsoleCommand(userId: string | undefined, rawInput: string) {
  const command = rawInput.trim();
  const entry = resolveCatalogEntry(command);
  const enabledKeys = new Set(loadEnabledKeys());

  if (!entry || !enabledKeys.has(entry.key)) {
    const verb = parseVerb(command) || command;
    throw new MinimaConsoleError(`Command not permitted — enable '${verb}' in the console whitelist first.`, 400);
  }

  let result;
  if (entry.dispatch === "megammrsync-resync") {
    result = await resyncMegammr();
  } else if (entry.dispatch === "peers-add") {
    const match = /peerslist:(\S+)/i.exec(command);
    result = await addMinimaPeers(match?.[1] ?? "");
  } else {
    result = await runMinimaPathCommand(command);
  }

  recordAuditEvent("minima.console.run", { userId, detail: entry.verb });
  return result;
}
