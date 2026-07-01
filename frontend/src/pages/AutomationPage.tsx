import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { addAutomationBlock, addAutomationRule, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationRule, deleteAutomationWorkflow, listAutomationWorkflows, reorderAutomationBlocks, runAutomationWorkflow, updateAutomationBlock, updateAutomationWorkflow } from "../features/automation/automationApi";
import type { AutomationBlock, AutomationWorkflow } from "../features/automation/automationTypes";
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [workspaceWorkflowId, setWorkspaceWorkflowId] = useState<string | null>(null);
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

  async function submitWorkflow() {
    setBusy(true);
    setError(null);
    try {
      const response = await createAutomationWorkflow({ name, dataSourceId, enabled, pollingIntervalSeconds: selectedSourceIsPush ? 0 : pollingIntervalSeconds, stampWithIntegritas: false });
      setName("");
      setCreateModalOpen(false);
      setWorkspaceWorkflowId(response.item.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const selectedSource = sources.find((source) => source.id === dataSourceId);
  const selectedSourceIsPush = selectedSource?.type === "webhook" || selectedSource?.type === "mqtt" || selectedSource?.type === "gpio-input";
  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const sourceName = (id: string) => sourceById(id)?.name ?? "Unknown source";
  const workspaceWorkflow = workflows.find((workflow) => workflow.id === workspaceWorkflowId) ?? null;

  return (
    <Page eyebrow="Automation" title="Automation rule workspace" desc="Build workflows from connected rules. V1 starts with data collection rules and optional Integritas stamping rules.">
      <section className="card">
        <div className="status-row">
          <div><strong>Workflow builder</strong><p className="muted">Create a workflow, then add rules to expand what happens after data is collected.</p></div>
          <button type="button" onClick={() => setCreateModalOpen(true)}>Create new workflow</button>
        </div>
      </section>

      {createModalOpen && (
        <Modal title="Create workflow" onClose={() => setCreateModalOpen(false)}>
          <section className="automation-form">
            <div className="status-row">
              <div><strong>Create workflow</strong><p className="muted">Creating a workflow adds a Collect data rule. Add an Integritas rule afterward to stamp collected hashes.</p></div>
              <span className="pill pill-neutral">When / Condition / Then</span>
            </div>

            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Stamp mock device measurements" /></label>
            <label>Data source<select value={dataSourceId} onChange={(event) => setDataSourceId(event.target.value)}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
            {selectedSourceIsPush ? <p className="muted">This push source records incoming data only while this workflow is enabled. It does not use a polling interval.</p> : <label>Polling interval<select value={pollingIntervalSeconds} onChange={(event) => setPollingIntervalSeconds(Number(event.target.value))}>{intervals.map((interval) => <option key={interval} value={interval}>{formatInterval(interval)}</option>)}</select></label>}
            <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
            <button type="button" disabled={busy || !name || !dataSourceId} onClick={submitWorkflow}>Create workflow</button>
          </section>
        </Modal>
      )}

      {workspaceWorkflow && (
        <Modal title="Workflow workspace" onClose={() => setWorkspaceWorkflowId(null)}>
          <WorkflowWorkspace
            workflow={workspaceWorkflow}
            source={sourceById(workspaceWorkflow.dataSourceId)}
            sources={sources}
            busy={busy}
            onAddBlock={(input) => run(() => addAutomationBlock(workspaceWorkflow.id, input))}
            onAddStampRule={() => run(() => addAutomationRule(workspaceWorkflow.id, { type: "stamp_integritas" }))}
            onDeleteBlock={(blockId) => run(() => deleteAutomationBlock(workspaceWorkflow.id, blockId))}
            onDeleteRule={(ruleId) => run(() => deleteAutomationRule(workspaceWorkflow.id, ruleId))}
            onUpdateBlock={(blockId, input) => run(() => updateAutomationBlock(workspaceWorkflow.id, blockId, input))}
            onReorderBlocks={(blockIds) => run(() => reorderAutomationBlocks(workspaceWorkflow.id, blockIds))}
            onRunNow={() => run(() => runAutomationWorkflow(workspaceWorkflow.id))}
            onToggleEnabled={() => run(() => updateAutomationWorkflow(workspaceWorkflow.id, { enabled: !workspaceWorkflow.enabled }))}
            onDelete={() => run(async () => {
              await deleteAutomationWorkflow(workspaceWorkflow.id);
              setWorkspaceWorkflowId(null);
            })}
          />
        </Modal>
      )}

      {error && <p className="error-text">{error}</p>}

      <section className="card automation-list">
        <div><strong>Workflows</strong><p className="muted">Compact summary of workflow status. Open a workflow to edit rules and settings.</p></div>
        <div className="grid-list">
          {workflows.map((workflow) => {
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

                <div className="status-row">
                  <div>
                    <p className="muted">Blocks: {summarizeBlocks(workflow)}</p>
                    <p className="muted">Last run: {workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</p>
                    <p className="muted">Last hash: {workflow.lastHash ? <code>{workflow.lastHash}</code> : "No hash yet"}</p>
                  </div>
                  <div className="row-actions">
                    <button type="button" disabled={busy} onClick={() => setWorkspaceWorkflowId(workflow.id)}>Open</button>
                    <button type="button" disabled={busy || workflow.pollingIntervalSeconds === 0} onClick={() => run(() => runAutomationWorkflow(workflow.id))}>Run now</button>
                    <button type="button" disabled={busy} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }))}>{workflow.enabled ? "Pause" : "Enable"}</button>
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

function WorkflowWorkspace({ workflow, source, sources, busy, onAddBlock, onAddStampRule, onDeleteBlock, onDeleteRule, onUpdateBlock, onReorderBlocks, onRunNow, onToggleEnabled, onDelete }: { workflow: AutomationWorkflow; source: DataSource | undefined; sources: DataSource[]; busy: boolean; onAddBlock: (input: Parameters<typeof addAutomationBlock>[1]) => void; onAddStampRule: () => void; onDeleteBlock: (blockId: string) => void; onDeleteRule: (ruleId: string) => void; onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onReorderBlocks: (blockIds: string[]) => void; onRunNow: () => void; onToggleEnabled: () => void; onDelete: () => void }) {
  const [fetchSourceId, setFetchSourceId] = useState(() => sources.find((item) => item.type === "json-api" || item.type === "internal-json-api")?.id ?? "");
  const [waitMs, setWaitMs] = useState("1000");
  const hasStampBlock = workflow.blocks.some((block) => block.type === "stamp_integritas");
  const canAppendAction = !hasStampBlock;
  const fetchSources = sources.filter((item) => item.type === "json-api" || item.type === "internal-json-api");

  return (
    <section className="automation-list">
      <div className="status-row">
        <div>
          <strong>{workflow.name}</strong>
          <p className="muted">{source?.name ?? "Unknown source"} · {workflow.pollingIntervalSeconds > 0 ? formatInterval(workflow.pollingIntervalSeconds) : "Event driven"}</p>
        </div>
        <span className={`pill ${workflow.lastError ? "pill-warn" : workflow.enabled ? "pill-good" : "pill-neutral"}`}>{workflow.lastError ? "Error" : workflow.enabled ? "Enabled" : "Paused"}</span>
      </div>

      {workflow.lastError && <p className="error-text">{workflow.lastError}</p>}

      <div className="metric-grid">
        <div><span className="muted">Blocks</span><strong>{workflow.blocks.length}</strong></div>
        <div><span className="muted">Last run</span><strong>{workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</strong></div>
        <div><span className="muted">Next</span><strong>{workflow.nextRunAt ? formatLocalTime(workflow.nextRunAt) : workflow.pollingIntervalSeconds > 0 ? "Paused" : "On incoming data"}</strong></div>
      </div>

      <div className="grid-list">
        {workflow.blocks.map((block, index) => <BlockCard
          key={block.id}
          block={block}
          sources={sources}
          busy={busy}
          canMoveUp={index > 1}
          canMoveDown={index > 0 && index < workflow.blocks.length - 1}
          onMoveUp={() => onReorderBlocks(moveBlock(workflow.blocks, index, index - 1))}
          onMoveDown={() => onReorderBlocks(moveBlock(workflow.blocks, index, index + 1))}
          onUpdate={(input) => onUpdateBlock(block.id, input)}
          onDelete={() => block.type.endsWith("_start") ? undefined : onDeleteBlock(block.id)}
        />)}
      </div>

      <section className="card soft-card">
        <div className="status-row">
          <div>
            <strong>Add block</strong>
            <p className="muted">Append small logic pieces to this workflow. Add action blocks before adding the final Integritas stamp block.</p>
          </div>
          {hasStampBlock && <span className="pill pill-neutral">Final stamp added</span>}
        </div>
        <div className="automation-form">
          <label>Fetch data source<select value={fetchSourceId} onChange={(event) => setFetchSourceId(event.target.value)}>{fetchSources.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
          <div className="row-actions">
            <button type="button" disabled={busy || !canAppendAction || !fetchSourceId} onClick={() => onAddBlock({ type: "fetch_data_source", config: { sourceId: fetchSourceId } })}>Add fetch block</button>
          </div>
          <label>Wait duration ms<input value={waitMs} onChange={(event) => setWaitMs(event.target.value)} inputMode="numeric" placeholder="1000" /></label>
          <div className="row-actions">
            <button type="button" disabled={busy || !canAppendAction || !Number.isFinite(Number(waitMs))} onClick={() => onAddBlock({ type: "wait", config: { durationMs: Number(waitMs) } })}>Add wait block</button>
          </div>
          {!canAppendAction && <p className="muted">Remove the stamp block before adding more action blocks, then add stamping again at the end.</p>}
        </div>
      </section>

      <div className="status-row">
        <div>
          <strong>Improve this workflow</strong>
          <p className="muted">Stamp the latest hash after record/fetch blocks, run the workflow manually, pause it, or delete it.</p>
        </div>
        <div className="row-actions">
          <button type="button" disabled={busy || hasStampBlock} onClick={onAddStampRule}>Add Integritas block</button>
          <button type="button" disabled={busy || workflow.pollingIntervalSeconds === 0} onClick={onRunNow}>Run now</button>
          <button type="button" disabled={busy} onClick={onToggleEnabled}>{workflow.enabled ? "Pause" : "Enable"}</button>
          <button type="button" disabled={busy} onClick={onDelete}>Delete workflow</button>
        </div>
      </div>
    </section>
  );
}

function BlockCard({ block, sources, busy, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onUpdate, onDelete }: { block: AutomationBlock; sources: DataSource[]; busy: boolean; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onUpdate: (input: Parameters<typeof updateAutomationBlock>[2]) => void; onDelete: () => void }) {
  const [fetchSourceId, setFetchSourceId] = useState(block.config.sourceId ?? "");
  const [durationMs, setDurationMs] = useState(String(block.config.durationMs ?? 1000));
  const removable = !block.type.endsWith("_start");
  const fetchSources = sources.filter((item) => item.type === "json-api" || item.type === "internal-json-api");
  return (
    <div className="card">
      <div className="status-row">
        <div><strong>{block.order}. {blockLabel(block)}</strong><p className="muted">{blockDescription(block, sources)}</p></div>
        <span className="pill pill-neutral">Block</span>
      </div>
      <div className="metric-grid">
        <RulePart title="Type" value={block.type} />
        <RulePart title="Status" value={block.lastError ? "Error" : block.lastRunAt ? `Ran ${formatLocalTime(block.lastRunAt)}` : "Not run yet"} />
        <RulePart title="Output" value={blockOutput(block)} />
      </div>
      {block.lastError && <p className="error-text">{block.lastError}</p>}
      {block.type === "fetch_data_source" && (
        <div className="automation-form">
          <label>Fetch source<select value={fetchSourceId} onChange={(event) => setFetchSourceId(event.target.value)}>{fetchSources.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
          <button type="button" disabled={busy || !fetchSourceId || fetchSourceId === block.config.sourceId} onClick={() => onUpdate({ config: { sourceId: fetchSourceId } })}>Save fetch source</button>
        </div>
      )}
      {block.type === "wait" && (
        <div className="automation-form">
          <label>Wait duration ms<input value={durationMs} onChange={(event) => setDurationMs(event.target.value)} inputMode="numeric" /></label>
          <button type="button" disabled={busy || !Number.isFinite(Number(durationMs)) || Number(durationMs) === block.config.durationMs} onClick={() => onUpdate({ config: { durationMs: Number(durationMs) } })}>Save wait duration</button>
        </div>
      )}
      {removable && <div className="row-actions">
        <button type="button" disabled={busy || !canMoveUp} onClick={onMoveUp}>Move up</button>
        <button type="button" disabled={busy || !canMoveDown} onClick={onMoveDown}>Move down</button>
        <button type="button" disabled={busy} onClick={() => onUpdate({ enabled: !block.enabled })}>{block.enabled ? "Disable" : "Enable"}</button>
        <button type="button" disabled={busy} onClick={onDelete}>Remove block</button>
      </div>}
    </div>
  );
}

function moveBlock(blocks: AutomationBlock[], from: number, to: number) {
  const next = blocks.map((block) => block.id);
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

function RulePart({ title, value }: { title: string; value: string }) {
  return <div><span className="muted">{title}</span><strong>{value}</strong></div>;
}

function summarizeBlocks(workflow: AutomationWorkflow) {
  if (workflow.blocks.length === 0) return "No blocks";
  return workflow.blocks.map((block) => blockShortLabel(block)).join(" -> ");
}

function blockLabel(block: AutomationBlock) {
  if (block.type === "schedule_start") return "Start on schedule";
  if (block.type === "gpio_event_start") return "Start on GPIO event";
  if (block.type === "webhook_event_start") return "Start on webhook";
  if (block.type === "mqtt_event_start") return "Start on MQTT message";
  if (block.type === "manual_start") return "Start manually";
  if (block.type === "record_trigger_event") return "Record trigger event";
  if (block.type === "fetch_data_source") return "Fetch data source";
  if (block.type === "wait") return "Wait";
  if (block.type === "stamp_integritas") return "Stamp with Integritas";
  return block.type;
}

function blockShortLabel(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Start";
  if (block.type === "record_trigger_event") return "Record event";
  if (block.type === "fetch_data_source") return "Fetch source";
  if (block.type === "stamp_integritas") return "Stamp";
  if (block.type === "wait") return "Wait";
  return block.type;
}

function blockDescription(block: AutomationBlock, sources: DataSource[]) {
  const source = block.config.sourceId ? sources.find((item) => item.id === block.config.sourceId) : undefined;
  if (block.type === "schedule_start") return `Every ${formatInterval(Number(block.config.intervalSeconds ?? 0)).replace("Every ", "")}`;
  if (block.type === "gpio_event_start") return source ? `${source.name} - GPIO${source.config.pin ?? "?"}` : "GPIO input event";
  if (block.type === "webhook_event_start") return source ? `${source.name} webhook payload` : "Webhook payload";
  if (block.type === "mqtt_event_start") return source ? `${source.name} MQTT message` : "MQTT message";
  if (block.type === "record_trigger_event") return "Store the incoming trigger payload as a data read";
  if (block.type === "fetch_data_source") return source ? `Fetch ${source.name}` : "Fetch configured HTTP JSON source";
  if (block.type === "wait") return `Pause for ${block.config.durationMs ?? 0} ms`;
  if (block.type === "stamp_integritas") return "Stamp the latest collected hash";
  return "Workflow block";
}

function blockOutput(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Trigger context";
  if (block.type === "record_trigger_event") return "Hash + read";
  if (block.type === "fetch_data_source") return "Fetched JSON + hash";
  if (block.type === "wait") return "Same context";
  if (block.type === "stamp_integritas") return "Proof UID";
  return "Context";
}

function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt") return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "gpio-input") return `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  return source.config.url ?? "HTTP JSON API";
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds < 3600) return `Every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `Every ${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}
