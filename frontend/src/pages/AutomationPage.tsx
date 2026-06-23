import { useEffect, useState } from "react";
import { Page } from "../components/Page";
import { addAutomationRule, createAutomationWorkflow, deleteAutomationRule, deleteAutomationWorkflow, listAutomationWorkflows, runAutomationWorkflow, updateAutomationWorkflow } from "../features/automation/automationApi";
import type { AutomationRule, AutomationWorkflow } from "../features/automation/automationTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { formatLocalTime } from "../lib/time";

const intervals = [10, 30, 60, 300, 900, 3600];

export function AutomationPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [name, setName] = useState("");
  const [dataSourceId, setDataSourceId] = useState("");
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(60);
  const [enabled, setEnabled] = useState(true);
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

  const selectedSource = sources.find((source) => source.id === dataSourceId);
  const selectedSourceIsPush = selectedSource?.type === "webhook" || selectedSource?.type === "mqtt";
  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const sourceName = (id: string) => sourceById(id)?.name ?? "Unknown source";

  return (
    <Page eyebrow="Automation" title="Automation rule workspace" desc="Build workflows from connected rules. V1 starts with data collection rules and optional Integritas stamping rules.">
      <section className="card automation-form">
        <div className="status-row">
          <div><strong>Create workflow</strong><p className="muted">Creating a workflow adds a Collect data rule. Add an Integritas rule afterward to stamp collected hashes.</p></div>
          <span className="pill pill-neutral">When / Condition / Then</span>
        </div>

        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Stamp mock device measurements" /></label>
        <label>Data source<select value={dataSourceId} onChange={(event) => setDataSourceId(event.target.value)}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
        {selectedSourceIsPush ? <p className="muted">This push source records incoming data only while this workflow is enabled. It does not use a polling interval.</p> : <label>Polling interval<select value={pollingIntervalSeconds} onChange={(event) => setPollingIntervalSeconds(Number(event.target.value))}>{intervals.map((interval) => <option key={interval} value={interval}>{formatInterval(interval)}</option>)}</select></label>}
        <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
        <button type="button" disabled={busy || !name || !dataSourceId} onClick={() => run(async () => {
          await createAutomationWorkflow({ name, dataSourceId, enabled, pollingIntervalSeconds: selectedSourceIsPush ? 0 : pollingIntervalSeconds, stampWithIntegritas: false });
          setName("");
        })}>Create workflow</button>
      </section>

      {error && <p className="error-text">{error}</p>}

      <section className="card automation-list">
        <div><strong>Workflows</strong><p className="muted">Each workflow is a collection of ordered rules. V1 rules run as a simple chain.</p></div>
        <div className="grid-list">
          {workflows.map((workflow) => {
            const source = sourceById(workflow.dataSourceId);
            const hasStampRule = workflow.rules.some((rule) => rule.type === "stamp_integritas");
            return (
              <article key={workflow.id} className="card soft-card">
                <div className="status-row">
                  <div>
                    <strong>{workflow.name}</strong>
                    <p className="muted">{sourceName(workflow.dataSourceId)} · {workflow.pollingIntervalSeconds > 0 ? formatInterval(workflow.pollingIntervalSeconds) : "Event driven"}</p>
                  </div>
                  <span className={`pill ${workflow.lastError ? "pill-warn" : workflow.enabled ? "pill-good" : "pill-neutral"}`}>{workflow.lastError ? "Error" : workflow.enabled ? "Enabled" : "Paused"}</span>
                </div>

                {workflow.lastError && <p className="error-text">{workflow.lastError}</p>}

                <div className="grid-list">
                  {workflow.rules.map((rule) => <RuleCard key={rule.id} rule={rule} workflow={workflow} source={source} busy={busy} onDelete={() => run(() => deleteAutomationRule(workflow.id, rule.id))} />)}
                </div>

                <div className="status-row">
                  <div>
                    <p className="muted">Last run: {workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</p>
                    <p className="muted">Next: {workflow.nextRunAt ? formatLocalTime(workflow.nextRunAt) : workflow.pollingIntervalSeconds > 0 ? "Paused" : "On incoming data"}</p>
                    <p className="muted">Last hash: {workflow.lastHash ? <code>{workflow.lastHash}</code> : "No hash yet"}</p>
                  </div>
                  <div className="row-actions">
                    <button type="button" disabled={busy || hasStampRule} onClick={() => run(() => addAutomationRule(workflow.id, { type: "stamp_integritas" }))}>Add Integritas rule</button>
                    <button type="button" disabled={busy || workflow.pollingIntervalSeconds === 0} onClick={() => run(() => runAutomationWorkflow(workflow.id))}>Run now</button>
                    <button type="button" disabled={busy} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }))}>{workflow.enabled ? "Pause" : "Enable"}</button>
                    <button type="button" disabled={busy} onClick={() => run(() => deleteAutomationWorkflow(workflow.id))}>Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {workflows.length === 0 && <p className="muted">No automation workflows yet.</p>}
      </section>
    </Page>
  );
}

function RuleCard({ rule, workflow, source, busy, onDelete }: { rule: AutomationRule; workflow: AutomationWorkflow; source: DataSource | undefined; busy: boolean; onDelete: () => void }) {
  return (
    <div className="card">
      <div className="status-row">
        <div><strong>{rule.order}. {rule.name}</strong><p className="muted">{rule.type === "collect_data" ? "Collect data" : "Stamp with Integritas"}</p></div>
        <span className="pill pill-neutral">Rule</span>
      </div>
      <div className="metric-grid">
        <RulePart title="When" value={describeWhen(rule, workflow, source)} />
        <RulePart title="Condition" value={describeCondition(rule)} />
        <RulePart title="Then" value={describeThen(rule)} />
      </div>
      {rule.type !== "collect_data" && <div className="row-actions"><button type="button" disabled={busy} onClick={onDelete}>Remove rule</button></div>}
    </div>
  );
}

function RulePart({ title, value }: { title: string; value: string }) {
  return <div><span className="muted">{title}</span><strong>{value}</strong></div>;
}

function describeWhen(rule: AutomationRule, workflow: AutomationWorkflow, source: DataSource | undefined) {
  if (rule.type === "stamp_integritas") return "After data is collected";
  if (source?.type === "webhook") return "Webhook payload is received";
  if (source?.type === "mqtt") return "MQTT message is received";
  return workflow.pollingIntervalSeconds > 0 ? formatInterval(workflow.pollingIntervalSeconds) : "Incoming data is received";
}

function describeCondition(rule: AutomationRule) {
  return rule.type === "stamp_integritas" ? "Collected hash exists" : "Payload is valid JSON";
}

function describeThen(rule: AutomationRule) {
  return rule.type === "stamp_integritas" ? "Stamp hash with Integritas" : "Record JSON payload and hash";
}

function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt") return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  return source.config.url ?? "HTTP JSON API";
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds < 3600) return `Every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `Every ${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}
