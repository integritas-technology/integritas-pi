import { useEffect, useState } from "react";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { integritasErrorToast } from "../features/integritas/integritasErrors";
import { listAutomationRuns } from "../features/automation/automationApi";
import { AutomationRunsTable } from "../features/automation/AutomationRunsTable";
import type { AutomationRun } from "../features/automation/automationTypes";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import { DataReadsHistoryTable } from "../features/data-reads/DataReadsHistoryTable";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { deleteSelected, downloadSelected, getHistory, pollPendingRecords, verifyRecord } from "../features/integritas/integritasApi";
import { IntegritasHistoryTable } from "../features/integritas/IntegritasHistoryTable";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";

type DiagnosticsTab = "proofs" | "reads" | "workflow-runs";

export function DiagnosticsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>("proofs");
  const [records, setRecords] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<AutomationRun[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshProofs().catch((err: Error) => setError(err.message));
    refreshReads().catch((err: Error) => setError(err.message));
    refreshWorkflowRuns().catch((err: Error) => setError(err.message));
  }, []);

  useIntegritasHistoryAutoRefresh(records, setRecords, { enabled: activeTab === "proofs" });

  async function refreshProofs() {
    const response = await getHistory();
    setRecords(response.items);
  }

  async function refreshReads() {
    const response = await listDataReads();
    setReads(response.items);
  }

  async function refreshWorkflowRuns() {
    const response = await listAutomationRuns(100);
    setWorkflowRuns(response.items);
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
        <button type="button" role="tab" aria-selected={activeTab === "workflow-runs"} className={activeTab === "workflow-runs" ? "active" : ""} onClick={() => setActiveTab("workflow-runs")}>Workflow logs</button>
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
      ) : activeTab === "reads" ? (
        <DataReadsHistoryTable items={reads} />
      ) : (
        <section className="card">
          <div className="status-row">
            <div><strong>Workflow logs</strong><p className="muted">Recent automated and manual workflow runs across all workflows.</p></div>
            <button type="button" disabled={busy} onClick={() => refreshWorkflowRuns().catch((err: Error) => setError(err.message))}>Refresh</button>
          </div>
          <AutomationRunsTable runs={workflowRuns} />
        </section>
      )}

      {error && <p className="error-text">{error}</p>}
      {result !== null && <JsonPreview value={result} />}
    </Page>
  );
}
