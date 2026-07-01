import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { JsonPreview } from "../components/JsonPreview";
import { ListPagerFilterBar } from "../components/ListPagerFilterBar";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import { DataReadsHistoryTable } from "../features/data-reads/DataReadsHistoryTable";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { deleteSelected, downloadSelected, getHistory, pollPendingRecords, verifyRecord } from "../features/integritas/integritasApi";
import { IntegritasHistoryTable } from "../features/integritas/IntegritasHistoryTable";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import type { ListQueryParams, PaginatedResponse } from "../lib/paginated";
import {
  DEFAULT_PAGE_SIZE,
  defaultDiagnosticsListQuery,
  diagnosticsSearchParams,
  isValidDiagnosticsTab,
  parseDiagnosticsListQuery,
  parseDiagnosticsTab,
  PROOF_STATUS_OPTIONS,
  READ_STATUS_OPTIONS,
  type DiagnosticsListQuery,
  type DiagnosticsTab,
} from "./diagnosticsQuery";

function emptyProofsPage(): PaginatedResponse<IntegritasProofRecord> {
  return { items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 };
}

function emptyReadsPage(): PaginatedResponse<DataSourceRead> {
  return { items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 };
}

function toListQueryParams(query: DiagnosticsListQuery): ListQueryParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { q: query.q } : {}),
  };
}

export function DiagnosticsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseDiagnosticsTab(searchParams);
  const listQuery = useMemo(
    () => parseDiagnosticsListQuery(searchParams, activeTab),
    [searchParams, activeTab],
  );
  const listQueryParams = useMemo(() => toListQueryParams(listQuery), [listQuery]);
  const [proofsPage, setProofsPage] = useState(emptyProofsPage);
  const [readsPage, setReadsPage] = useState(emptyReadsPage);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateListQuery = useCallback((patch: Partial<DiagnosticsListQuery>) => {
    const current = parseDiagnosticsListQuery(searchParams, activeTab);
    const next = { ...current, ...patch };
    if ("status" in patch || "q" in patch || "pageSize" in patch) {
      next.page = 1;
    }
    setSearchParams(diagnosticsSearchParams({ tab: activeTab, query: next }), { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    const rawTab = searchParams.get("tab");
    if (rawTab !== null && !isValidDiagnosticsTab(rawTab)) {
      setSearchParams(
        diagnosticsSearchParams({
          tab: "proofs",
          query: parseDiagnosticsListQuery(searchParams, "proofs"),
        }),
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (activeTab === "proofs") {
          const response = await getHistory(listQueryParams);
          if (cancelled) return;
          if (response.totalPages > 0 && listQuery.page > response.totalPages) {
            updateListQuery({ page: response.totalPages });
            return;
          }
          setProofsPage(response);
          return;
        }

        const response = await listDataReads(listQueryParams);
        if (cancelled) return;
        if (response.totalPages > 0 && listQuery.page > response.totalPages) {
          updateListQuery({ page: response.totalPages });
          return;
        }
        setReadsPage(response);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load diagnostics history.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, listQuery.page, listQuery.pageSize, listQuery.status, listQuery.q]);

  useIntegritasHistoryAutoRefresh(proofsPage.items, (items) => {
    setProofsPage((current) => ({ ...current, items }));
  }, {
    enabled: activeTab === "proofs",
    query: listQueryParams,
  });

  function selectTab(tab: DiagnosticsTab) {
    setSearchParams(
      diagnosticsSearchParams({ tab, query: defaultDiagnosticsListQuery() }),
      { replace: true },
    );
  }

  async function refreshProofs() {
    const response = await getHistory(listQueryParams);
    if (response.totalPages > 0 && listQuery.page > response.totalPages) {
      updateListQuery({ page: response.totalPages });
      return response;
    }
    setProofsPage(response);
    return response;
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await action();
      setResult(response);
      await refreshProofs();
      return response;
    } catch (err) {
      const { title, message } = integritasErrorToast(err);
      showToast({ tone: "error", title, message, timeoutMs: 9000 });
      setError(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadSelected() {
    setBusy(true);
    setError(null);
    try {
      await downloadSelected(selectedIds);
    } catch (err) {
      const { title, message } = integritasErrorToast(err);
      showToast({ tone: "error", title, message, timeoutMs: 9000 });
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  const activePager = activeTab === "proofs" ? proofsPage : readsPage;
  const statusOptions = activeTab === "proofs" ? PROOF_STATUS_OPTIONS : READ_STATUS_OPTIONS;

  return (
    <Page eyebrow="Diagnostics" title="Operational history" desc="Inspect stored proof requests and data-source read logs from one diagnostics workspace.">
      <div className="subtabs" role="tablist" aria-label="Diagnostics history">
        <button type="button" role="tab" aria-selected={activeTab === "proofs"} className={activeTab === "proofs" ? "active" : ""} onClick={() => selectTab("proofs")}>Proof history</button>
        <button type="button" role="tab" aria-selected={activeTab === "reads"} className={activeTab === "reads" ? "active" : ""} onClick={() => selectTab("reads")}>Read history</button>
      </div>

      <ListPagerFilterBar
        page={activePager.page}
        pageSize={activePager.pageSize}
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

      {activeTab === "proofs" ? (
        <IntegritasHistoryTable
          records={proofsPage.items}
          selectedIds={selectedIds}
          busy={busy}
          onToggle={toggleSelected}
          onRefreshPending={() => run(() => pollPendingRecords(listQueryParams))}
          onVerify={(record) => run(() => verifyRecord(record.id))}
          onDeleteSelected={() => run(async () => { const response = await deleteSelected(selectedIds); setSelectedIds([]); return response; })}
          onDownloadSelected={() => void handleDownloadSelected()}
        />
      ) : (
        <DataReadsHistoryTable items={readsPage.items} />
      )}

      {error && <p className="error-text">{error}</p>}
      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
