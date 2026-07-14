import { env } from "../config/env.js";
import { getLastAppliedVersion } from "../manifest/manifest-state.js";
import { getUpdateStatus, type ServiceStatus } from "./status.service.js";

export type StatusSnapshot = {
  checkedAt: string;
  services: ServiceStatus[];
  currentVersion: string | null;
  availableVersion: string;
} | null;

// Single-process in-memory cache — valid because update-agent always runs as exactly one container.
let snapshot: StatusSnapshot = null;

export function getCachedStatus(): StatusSnapshot {
  return snapshot;
}

async function poll(): Promise<void> {
  try {
    const { manifest, services } = await getUpdateStatus();
    const currentVersion = await getLastAppliedVersion();
    snapshot = { checkedAt: new Date().toISOString(), services, currentVersion, availableVersion: manifest.version };
  } catch (error) {
    console.error("[update-agent] background status poll failed:", error);
  }
}

/**
 * Starts a background poll of the update manifest so the frontend can read a
 * cached "is an update available" snapshot without triggering a live
 * fetch+verify on every navbar check. Skipped if manifest config is missing —
 * matches fetchVerifiedManifest's own guard, avoids a crash-looping timer.
 */
export function startStatusPoller(): void {
  if (!env.manifestUrl || !env.manifestPublicKey) {
    console.log("[update-agent] manifest not configured, background status polling disabled");
    return;
  }

  void poll();
  setInterval(() => void poll(), env.statusPollIntervalMs);
}
