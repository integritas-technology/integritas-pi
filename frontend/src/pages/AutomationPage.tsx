import { useEffect, useState } from "react";
import { Page } from "../components/Page";
import { createAutomationWorkflow, deleteAutomationWorkflow, listAutomationWorkflows, runAutomationWorkflow, updateAutomationWorkflow } from "../features/automation/automationApi";
import type { AutomationWorkflow } from "../features/automation/automationTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { formatLocalTime, formatUtcTime } from "../lib/time";

const intervals = [10, 30, 60, 300, 900, 3600];

export function AutomationPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [name, setName] = useState("");
  const [dataSourceId, setDataSourceId] = useState("");
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [stampWithIntegritas, setStampWithIntegritas] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function refresh() {
    const [sourceResponse, workflowResponse] = await Promise.all([listDataSources(), listAutomationWorkflows()]);
    setSources(sourceResponse.items);
    setWorkflows(workflowResponse.items);
    if (!dataSourceId && sourceResponse.items[0]) setDataSourceId(sourceResponse.items[0].id);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const sourceName = (id: string) => sources.find((source) => source.id === id)?.name ?? "Unknown source";

  return (
    <Page eyebrow="Automation" title="Automated data source workflows" desc="Poll saved data sources on an interval and stamp each JSON response with Integritas. Automated stamps appear in the Integritas history table.">
      <section className="card automation-form">
        <div className="status-row">
          <div><strong>Create workflow</strong><p className="muted">Each enabled workflow stamps every successful poll of the entire JSON response.</p></div>
          <span className="pill pill-neutral">Entire response</span>
        </div>

        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Stamp mock device measurements" /></label>
        <label>Data source<select value={dataSourceId} onChange={(event) => setDataSourceId(event.target.value)}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} - {source.config.url}</option>)}</select></label>
        <label>Polling interval<select value={pollingIntervalSeconds} onChange={(event) => setPollingIntervalSeconds(Number(event.target.value))}>{intervals.map((interval) => <option key={interval} value={interval}>{formatInterval(interval)}</option>)}</select></label>
        <label className="check-row"><input type="checkbox" checked={stampWithIntegritas} onChange={(event) => setStampWithIntegritas(event.target.checked)} /> Stamp with Integritas</label>
        <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
        <button type="button" disabled={busy || !name || !dataSourceId} onClick={() => run(async () => {
          await createAutomationWorkflow({ name, dataSourceId, enabled, pollingIntervalSeconds, stampWithIntegritas });
          setName("");
        })}>Create workflow</button>
      </section>

      {error && <p className="error-text">{error}</p>}

      <section className="card automation-list">
        <div><strong>Workflows</strong><p className="muted">The backend scheduler checks for due workflows every few seconds.</p></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Source</th><th>Interval</th><th>Status</th><th>Last run</th><th>Next run</th><th>Last hash</th><th>Actions</th></tr></thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id}>
                  <td><strong>{workflow.name}</strong><p className="muted">{workflow.stampWithIntegritas ? "Stamps every poll" : "Polling only"}</p></td>
                  <td>{sourceName(workflow.dataSourceId)}</td>
                  <td>{formatInterval(workflow.pollingIntervalSeconds)}</td>
                  <td>{workflow.lastError ? <span className="pill pill-warn">Error</span> : workflow.enabled ? <span className="pill pill-good">Enabled</span> : <span className="pill pill-neutral">Paused</span>} {workflow.lastError && <p className="error-text">{workflow.lastError}</p>}</td>
                  <td>{workflow.lastRunAt ? <TimeStack label="Last run" value={workflow.lastRunAt} /> : <span className="muted">Never</span>}</td>
                  <td>{workflow.nextRunAt ? <TimeStack label="Next run" value={workflow.nextRunAt} /> : <span className="muted">Paused</span>}</td>
                  <td>{workflow.lastHash ? <code>{workflow.lastHash}</code> : <span className="muted">No hash yet</span>}</td>
                  <td><div className="row-actions"><button type="button" disabled={busy} onClick={() => run(() => runAutomationWorkflow(workflow.id))}>Run now</button><button type="button" disabled={busy} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }))}>{workflow.enabled ? "Pause" : "Enable"}</button><button type="button" disabled={busy} onClick={() => run(() => deleteAutomationWorkflow(workflow.id))}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workflows.length === 0 && <p className="muted">No automation workflows yet.</p>}
      </section>
    </Page>
  );
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds < 3600) return `Every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `Every ${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}

function TimeStack({ label, value }: { label: string; value: string }) {
  return (
    <div className="time-stack">
      <strong>{label}: {formatLocalTime(value)} local</strong>
      <span>UTC: {formatUtcTime(value)}</span>
    </div>
  );
}
