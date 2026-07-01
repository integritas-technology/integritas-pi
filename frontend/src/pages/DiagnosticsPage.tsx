import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListPagerFilterBar } from '../components/ListPagerFilterBar';
import { Page } from '../components/Page';
import { useToast } from '../components/ToastProvider';
import { integritasErrorToast } from '../features/integritas/integritasErrors';
import { listDataReads } from '../features/data-reads/dataReadsApi';
import { DataReadsHistoryTable } from '../features/data-reads/DataReadsHistoryTable';
import type { DataSourceRead } from '../features/data-reads/dataReadTypes';
import { deleteSelected, downloadSelected, getHistory, pollPendingRecords, verifyRecord } from '../features/integritas/integritasApi';
import { IntegritasHistoryTable } from '../features/integritas/IntegritasHistoryTable';
import type { IntegritasHistoryPage, IntegritasProofRecord } from '../features/integritas/integritasTypes';
import { useIntegritasHistoryAutoRefresh } from '../features/integritas/useIntegritasHistoryAutoRefresh';
import { emptyPaginatedPage } from '../lib/paginated';
import {
  defaultDiagnosticsListQuery,
  diagnosticsSearchParams,
  isValidDiagnosticsTab,
  parseDiagnosticsListQuery,
  parseDiagnosticsTab,
  PROOF_STATUS_OPTIONS,
  READ_STATUS_OPTIONS,
  type DiagnosticsListQuery,
  type DiagnosticsTab,
} from './diagnosticsQuery';

function applyPaginatedPage<T extends { totalPages: number }>(
  response: T,
  currentPage: number,
  setPage: (page: T) => void,
  clampPage: (page: number) => void,
) {
  if (response.totalPages > 0 && currentPage > response.totalPages) {
    clampPage(response.totalPages);
    return;
  }
  setPage(response);
}

function emptyProofsPage(): IntegritasHistoryPage {
  return { ...emptyPaginatedPage<IntegritasProofRecord>(), pendingTotal: 0 };
}

export function DiagnosticsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseDiagnosticsTab(searchParams);
  const listQuery = useMemo(
    () => parseDiagnosticsListQuery(searchParams, activeTab),
    [searchParams, activeTab],
  );
  const [proofsPage, setProofsPage] = useState(emptyProofsPage);
  const [readsPage, setReadsPage] = useState(emptyPaginatedPage<DataSourceRead>);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateListQuery = useCallback((patch: Partial<DiagnosticsListQuery>) => {
    const current = parseDiagnosticsListQuery(searchParams, activeTab);
    const next = { ...current, ...patch };
    if ('status' in patch || 'q' in patch || 'pageSize' in patch) {
      next.page = 1;
    }
    setSearchParams(diagnosticsSearchParams({ tab: activeTab, query: next }), { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const clampPage = useCallback((page: number) => {
    updateListQuery({ page });
  }, [updateListQuery]);

  useEffect(() => {
    const needsExplicitPager =
      !searchParams.has('tab') || !searchParams.has('page') || !searchParams.has('pageSize');
    if (!needsExplicitPager) return;

    setSearchParams(
      diagnosticsSearchParams({ tab: activeTab, query: listQuery }),
      { replace: true },
    );
  }, [activeTab, listQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const rawTab = searchParams.get('tab');
    if (rawTab !== null && !isValidDiagnosticsTab(rawTab)) {
      setSearchParams(
        diagnosticsSearchParams({
          tab: 'proofs',
          query: parseDiagnosticsListQuery(searchParams, 'proofs'),
        }),
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, listQuery.page, listQuery.pageSize, listQuery.status, listQuery.q]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (activeTab === 'proofs') {
          const response = await getHistory(listQuery);
          if (cancelled) return;
          applyPaginatedPage(response, listQuery.page, setProofsPage, clampPage);
          return;
        }

        const response = await listDataReads(listQuery);
        if (cancelled) return;
        applyPaginatedPage(response, listQuery.page, setReadsPage, clampPage);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load diagnostics history.');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, listQuery, clampPage]);

  useIntegritasHistoryAutoRefresh(proofsPage.items, undefined, {
    enabled: activeTab === 'proofs',
    query: listQuery,
    pendingTotal: proofsPage.pendingTotal,
    onPage: (response) => {
      applyPaginatedPage(response, listQuery.page, setProofsPage, clampPage);
    },
  });

  function selectTab(tab: DiagnosticsTab) {
    setSearchParams(
      diagnosticsSearchParams({ tab, query: defaultDiagnosticsListQuery() }),
      { replace: true },
    );
  }

  async function run(action: () => Promise<unknown>, options?: { refresh?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (options?.refresh !== false) {
        applyPaginatedPage(
          await getHistory(listQuery),
          listQuery.page,
          setProofsPage,
          clampPage,
        );
      }
    } catch (err) {
      const { title, message } = integritasErrorToast(err);
      showToast({ tone: 'error', title, message, timeoutMs: 9000 });
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshPending() {
    await run(async () => {
      applyPaginatedPage(
        await pollPendingRecords(listQuery),
        listQuery.page,
        setProofsPage,
        clampPage,
      );
    }, { refresh: false });
  }

  const activePager = activeTab === 'proofs' ? proofsPage : readsPage;
  const statusOptions = activeTab === 'proofs' ? PROOF_STATUS_OPTIONS : READ_STATUS_OPTIONS;
  const listFiltered = Boolean(listQuery.status || listQuery.q);

  return (
    <Page
      eyebrow="Diagnostics"
      title="Operational history"
      desc="Inspect stored proof requests and data-source read logs from one diagnostics workspace."
    >
      <div className="subtabs" role="tablist" aria-label="Diagnostics history">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'proofs'}
          className={activeTab === 'proofs' ? 'active' : ''}
          onClick={() => selectTab('proofs')}
        >
          Proof history
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reads'}
          className={activeTab === 'reads' ? 'active' : ''}
          onClick={() => selectTab('reads')}
        >
          Read history
        </button>
      </div>

      <ListPagerFilterBar
        page={listQuery.page}
        pageSize={listQuery.pageSize}
        total={activePager.total}
        totalPages={activePager.totalPages}
        status={listQuery.status}
        q={listQuery.q}
        statusOptions={statusOptions}
        onPageChange={(page) => updateListQuery({ page })}
        onPageSizeChange={(pageSize) => updateListQuery({ pageSize })}
        onStatusChange={(status) => updateListQuery({ status })}
        onQueryChange={(q) => updateListQuery({ q })}
      />

      {activeTab === 'proofs' ? (
        <IntegritasHistoryTable
          records={proofsPage.items}
          selectedIds={selectedIds}
          filtered={listFiltered}
          busy={busy}
          onToggle={(id) => {
            setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
          }}
          onRefreshPending={() => void handleRefreshPending()}
          onVerify={(record) => run(() => verifyRecord(record.id))}
          onDeleteSelected={() => run(async () => {
            await deleteSelected(selectedIds);
            setSelectedIds([]);
          })}
          onDownloadSelected={() => run(() => downloadSelected(selectedIds), { refresh: false })}
        />
      ) : (
        <DataReadsHistoryTable items={readsPage.items} filtered={listFiltered} />
      )}

      {error && <p className="error-text">{error}</p>}
    </Page>
  );
}
