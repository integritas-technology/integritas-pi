import { useCallback, useEffect, useRef } from "react";
import type { MinimaNodeStatus } from "../../app/types";
import { getMinimaNodeStatus } from "./minimaApi";

const DEFAULT_INTERVAL_MS = 30_000;

function formatRefreshError(error: unknown): string | null {
  if (error instanceof Error) {
    if (/fetch failed|aborted|temporarily unreachable/i.test(error.message) || error.name === "AbortError") {
      return null;
    }
    return error.message;
  }
  return "Could not load Minima status";
}

export function useMinimaStatusRefresh(
  onStatus: (status: MinimaNodeStatus) => void,
  onError: (message: string) => void,
  options?: { intervalMs?: number; enabled?: boolean }
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);

  onStatusRef.current = onStatus;
  onErrorRef.current = onError;

  const refresh = useCallback(async () => {
    try {
      const status = await getMinimaNodeStatus();
      onStatusRef.current(status);
    } catch (error) {
      const message = formatRefreshError(error);
      if (message) onErrorRef.current(message);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void refresh();
    const interval = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs, refresh]);

  return { refresh };
}
