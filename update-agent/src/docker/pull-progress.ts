import type { DockerProgressLine } from "./docker.client.js";

export type PullProgress = {
  service: string;
  bytesDownloaded: number;
  bytesTotal: number;
};

// Single-process in-memory state — valid because update-agent always runs as exactly one container.
let current: PullProgress | null = null;
let layers: Map<string, { current: number; total: number }> = new Map();

export function getPullProgress(): PullProgress | null {
  return current;
}

export function startPullProgress(service: string): void {
  layers = new Map();
  current = { service, bytesDownloaded: 0, bytesTotal: 0 };
}

export function clearPullProgress(): void {
  current = null;
  layers = new Map();
}

/**
 * Docker reports per-layer download progress as the pull streams; layers
 * download concurrently, so bytes are summed across all layers seen so far.
 */
export function recordPullProgress(line: DockerProgressLine): void {
  if (!current || !line.id || !line.progressDetail) return;
  const { current: layerCurrent, total: layerTotal } = line.progressDetail;
  if (typeof layerCurrent !== "number" || typeof layerTotal !== "number") return;

  layers.set(line.id, { current: layerCurrent, total: layerTotal });

  let bytesDownloaded = 0;
  let bytesTotal = 0;
  for (const layer of layers.values()) {
    bytesDownloaded += layer.current;
    bytesTotal += layer.total;
  }

  current = { service: current.service, bytesDownloaded, bytesTotal };
}
