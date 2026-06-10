import { useEffect } from "react";
import { getHistory } from "./integritasApi";
import type { IntegritasProofRecord } from "./integritasTypes";

const DEFAULT_INTERVAL_MS = 15_000;

export function hasPendingProofs(records: IntegritasProofRecord[]) {
  return records.some((record) => record.proof_status === "pending" && record.proof_uid);
}

export function useIntegritasHistoryAutoRefresh(
  records: IntegritasProofRecord[],
  onRecords: (records: IntegritasProofRecord[]) => void,
  options?: { intervalMs?: number; enabled?: boolean }
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;
  const shouldRefresh = enabled && hasPendingProofs(records);

  useEffect(() => {
    if (!shouldRefresh) return;

    let cancelled = false;

    async function refresh() {
      try {
        const response = await getHistory();
        if (!cancelled) onRecords(response.items);
      } catch {
        // Background refresh only.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [shouldRefresh, intervalMs, onRecords]);
}
