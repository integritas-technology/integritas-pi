import { useCallback, useEffect, useRef } from "react";
import type { UpdateStatusSummary } from "../../app/types";
import { getUpdateStatusSummary } from "./updateApi";

const DEFAULT_INTERVAL_MS = 60_000;

export function useUpdateStatusRefresh(
  onStatus: (status: UpdateStatusSummary) => void,
  options?: { intervalMs?: number; enabled?: boolean }
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;
  const onStatusRef = useRef(onStatus);

  onStatusRef.current = onStatus;

  const refresh = useCallback(async () => {
    try {
      const status = await getUpdateStatusSummary();
      onStatusRef.current(status);
    } catch {
      // Silent — a failed check just leaves the badge at its last known state.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void refresh();
    const interval = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs, refresh]);
}
