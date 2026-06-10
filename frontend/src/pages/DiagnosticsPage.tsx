import { useEffect, useState } from "react";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import { DataReadsHistoryTable } from "../features/data-reads/DataReadsHistoryTable";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { deleteSelected, downloadSelected, getHistory, pollRecord, verifyRecord } from "../features/integritas/integritasApi";
import { IntegritasHistoryTable } from "../features/integritas/IntegritasHistoryTable";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";

type DiagnosticsTab = "proofs" | "reads";

export function DiagnosticsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>("proofs");
  const [records, setRecords] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshProofs().catch((err: Error) => setError(err.message));
    refreshReads().catch((err: Error) => setError(err.message));
  }, []);

  async function refreshProofs() {
    const response = await getHistory();
    setRecords(response.items);
  }

  async function refreshReads() {
    const response = await listDataReads();
    setReads(response.items);
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
        <button type="button" role="tab" aria-selected={activeTab === "proofs"} className={activeTab === "proofs" ? "active" : ""} onClick={() => setActiveTab("proofs")}>Proof history</button>
        <button type="button" role="tab" aria-selected={activeTab === "reads"} className={activeTab === "reads" ? "active" : ""} onClick={() => setActiveTab("reads")}>Read history</button>
      </div>

      {activeTab === "proofs" ? (
        <IntegritasHistoryTable
          records={records}
          selectedIds={selectedIds}
          busy={busy}
          onToggle={toggleSelected}
          onPoll={(record) => run(() => pollRecord(record.id))}
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
