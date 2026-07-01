import { useEffect } from 'react';
import { getHistory } from './integritasApi';
import type { ListQueryParams } from '../../lib/paginated';
import type { IntegritasHistoryPage, IntegritasProofRecord } from './integritasTypes';

const DEFAULT_INTERVAL_MS = 15_000;

export function hasPendingProofs(records: IntegritasProofRecord[]) {
  return records.some((record) => record.proof_status === 'pending' && record.proof_uid);
}

export function useIntegritasHistoryAutoRefresh(
  records: IntegritasProofRecord[],
  onRecords: ((records: IntegritasProofRecord[]) => void) | undefined,
  options?: {
    intervalMs?: number;
    enabled?: boolean;
    query?: ListQueryParams;
    pendingTotal?: number;
    onPage?: (response: IntegritasHistoryPage) => void;
  },
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;
  const query = options?.query;
  const pendingTotal = options?.pendingTotal ?? 0;
  const onPage = options?.onPage;
  const shouldRefresh = enabled && (pendingTotal > 0 || hasPendingProofs(records));

  useEffect(() => {
    if (!shouldRefresh) return;

    let cancelled = false;

    async function refresh() {
      try {
        const response = await getHistory(query);
        if (cancelled) return;
        if (onPage) onPage(response);
        else onRecords?.(response.items);
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
  }, [shouldRefresh, intervalMs, onRecords, onPage, query?.page, query?.pageSize, query?.status, query?.q]);
}
