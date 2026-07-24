import { useCallback, useEffect, useState } from "react";
import type { StatusOverview } from "../../app/types";
import { getStatusOverview } from "./statusApi";

const INTERVAL_MS = 30_000;

export function useStatusOverviewRefresh() {
  const [overview, setOverview] = useState<StatusOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await getStatusOverview();
      setOverview(status);
      setError(null);
    } catch (err) {
      // Keep the last known-good overview on screen; just flag it as stale.
      setError(err instanceof Error ? err.message : "Could not refresh status");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { overview, error };
}
