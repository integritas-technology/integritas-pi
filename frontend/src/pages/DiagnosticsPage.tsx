import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { JsonPreview } from "../components/JsonPreview";
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
import {
  diagnosticsTabToSearchParams,
  isValidDiagnosticsTab,
  parseDiagnosticsTab,
  type DiagnosticsTab,
} from "./diagnosticsQuery";

export function DiagnosticsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseDiagnosticsTab(searchParams);
  const [records, setRecords] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const rawTab = searchParams.get("tab");
    if (rawTab !== null && !isValidDiagnosticsTab(rawTab)) {
      setSearchParams(diagnosticsTabToSearchParams("proofs", searchParams), { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setError(null);
    if (activeTab === "proofs") {
      refreshProofs().catch((err: Error) => setError(err.message));
      return;
    }
    refreshReads().catch((err: Error) => setError(err.message));
  }, [activeTab]);

  useIntegritasHistoryAutoRefresh(records, setRecords, { enabled: activeTab === "proofs" });

  async function refreshProofs() {
    const response = await getHistory();
    setRecords(response.items);
  }

  async function refreshReads() {
    const response = await listDataReads();
    setReads(response.items);
  }

  function selectTab(tab: DiagnosticsTab) {
    setSearchParams(diagnosticsTabToSearchParams(tab, searchParams), { replace: true });
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

  function toggleSelected(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  return (
    <Page eyebrow="Diagnostics" title="Operational history" desc="Inspect stored proof requests and data-source read logs from one diagnostics workspace.">
      <div className="subtabs" role="tablist" aria-label="Diagnostics history">
        <button type="button" role="tab" aria-selected={activeTab === "proofs"} className={activeTab === "proofs" ? "active" : ""} onClick={() => selectTab("proofs")}>Proof history</button>
        <button type="button" role="tab" aria-selected={activeTab === "reads"} className={activeTab === "reads" ? "active" : ""} onClick={() => selectTab("reads")}>Read history</button>
      </div>

      {activeTab === "proofs" ? (
        <IntegritasHistoryTable
          records={records}
          selectedIds={selectedIds}
          busy={busy}
          onToggle={toggleSelected}
          onRefreshPending={() => run(async () => {
            const response = await pollPendingRecords();
            setRecords(response.items);
            return response;
          })}
          onVerify={(record) => run(() => verifyRecord(record.id))}
          onDeleteSelected={() => run(async () => { const response = await deleteSelected(selectedIds); setSelectedIds([]); return response; })}
          onDownloadSelected={() => run(() => downloadSelected(selectedIds))}
        />
      ) : (
        <DataReadsHistoryTable items={reads} />
      )}

      {error && <p className="error-text">{error}</p>}
      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
