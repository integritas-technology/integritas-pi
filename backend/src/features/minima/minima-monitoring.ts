import { env } from "../../config/env.js";
import type { MinimaNodeStatus } from "./minima.types.js";

export type MinimaMonitoringSnapshot = {
  lastPollerCheckAt: string | null;
  lastStallDetectedAt: string | null;
  lastAutoResyncAt: string | null;
  lastAutoResyncResult: string | null;
};

const snapshot: MinimaMonitoringSnapshot = {
  lastPollerCheckAt: null,
  lastStallDetectedAt: null,
  lastAutoResyncAt: null,
  lastAutoResyncResult: null
};

type MinimaStatusForMonitoring = Pick<MinimaNodeStatus, "state" | "sync">;

export function detectStall(status: MinimaStatusForMonitoring) {
  return (
    status.state === "running" &&
    status.sync.blockAgeSeconds !== null &&
    status.sync.blockAgeSeconds > env.minimaStallBlockAgeSeconds
  );
}

export function getMinimaMonitoringSnapshot(): MinimaMonitoringSnapshot {
  return { ...snapshot };
}

export function buildMinimaMonitoring(status: MinimaStatusForMonitoring) {
  const pollerSnapshot = getMinimaMonitoringSnapshot();
  return {
    stallDetected: detectStall(status),
    stallThresholdSeconds: env.minimaStallBlockAgeSeconds,
    autoResyncEnabled: env.minimaAutoResync,
    ...pollerSnapshot
  };
}

export function recordPollerCheck(checkedAt: string) {
  snapshot.lastPollerCheckAt = checkedAt;
}

export function recordStallDetected() {
  snapshot.lastStallDetectedAt = new Date().toISOString();
}

export function recordAutoResync(result: string) {
  snapshot.lastAutoResyncAt = new Date().toISOString();
  snapshot.lastAutoResyncResult = result;
}

export function canAutoResync() {
  if (!snapshot.lastAutoResyncAt) return true;
  const cooldownMs = env.minimaAutoResyncCooldownMinutes * 60 * 1000;
  return Date.now() - new Date(snapshot.lastAutoResyncAt).getTime() >= cooldownMs;
}
