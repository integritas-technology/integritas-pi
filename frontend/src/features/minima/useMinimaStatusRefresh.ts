import { useEffect } from "react";
import type { MinimaNodeStatus } from "../../app/types";
import { getMinimaNodeStatus } from "./minimaApi";

const DEFAULT_INTERVAL_MS = 30_000;

export function useMinimaStatusRefresh(
  onStatus: (status: MinimaNodeStatus) => void,
  onError: (message: string) => void,
  options?: { intervalMs?: number; enabled?: boolean }
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function refresh() {
      try {
        const status = await getMinimaNodeStatus();
        if (!cancelled) onStatus(status);
      } catch (error) {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : "Could not load Minima status");
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, onError, onStatus]);
}
