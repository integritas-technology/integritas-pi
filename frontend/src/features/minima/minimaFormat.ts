import type { MinimaNodeState } from "../../app/types";

export function formatBlockAge(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function formatNodeState(state: MinimaNodeState | null, loading = false) {
  if (loading && !state) return "Checking…";
  if (!state) return "—";
  if (state === "running") return "Running";
  if (state === "stopped") return "Stopped";
  return "Error";
}

export function formatSyncState(synced: boolean | null | undefined, loading = false) {
  if (loading) return "Checking…";
  if (synced === null || synced === undefined) return "Unknown";
  return synced ? "Synced" : "Syncing";
}

export function nodeStateIsHealthy(state: MinimaNodeState | null) {
  return state === "running";
}
