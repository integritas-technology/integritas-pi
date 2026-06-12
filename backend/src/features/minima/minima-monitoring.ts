import { env } from "../../config/env.js";
import type { MinimaNodeStatus } from "./minima.types.js";

export type MinimaMonitoringSnapshot = {
  lastPollerCheckAt: string | null;
  lastStallDetectedAt: string | null;
  lastAutoResyncAt: string | null;
  lastAutoResyncResult: string | null;
  lastNodeState: "running" | "stopped" | "error" | "unknown";
};

const snapshot: MinimaMonitoringSnapshot = {
  lastPollerCheckAt: null,
  lastStallDetectedAt: null,
  lastAutoResyncAt: null,
  lastAutoResyncResult: null,
  lastNodeState: "unknown"
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

export function recordPollerCheck(checkedAt: string, state: MinimaMonitoringSnapshot["lastNodeState"]) {
  snapshot.lastPollerCheckAt = checkedAt;
  snapshot.lastNodeState = state;
}

export function getLastMinimaPollerState(): { state: MinimaMonitoringSnapshot["lastNodeState"]; lastCheckedAt: string | null } {
  return { state: snapshot.lastNodeState, lastCheckedAt: snapshot.lastPollerCheckAt };
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
