import type { MinimaNodeState } from "../../app/types";

export function formatBlockAge(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatNodeState(state: MinimaNodeState | null) {
  if (!state) return "Checking…";
  if (state === "running") return "Running";
  if (state === "stopped") return "Stopped";
  return "Error";
}

export function nodeStateIsHealthy(state: MinimaNodeState | null) {
  return state === "running";
}
