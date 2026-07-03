import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { addAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationWorkflow, listAutomationWorkflowRuns, listAutomationWorkflows, reorderAutomationBlocks, runAutomationWorkflow, updateAutomationBlock, updateAutomationWorkflow } from "../features/automation/automationApi";
import { AutomationRunsTable } from "../features/automation/AutomationRunsTable";
import type { AutomationBlock, AutomationBlockType, AutomationRun, AutomationWorkflow } from "../features/automation/automationTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { formatLocalTime } from "../lib/time";

const intervals = [10, 30, 60, 300, 900, 3600];

export function AutomationPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [name, setName] = useState("");
  const [startType, setStartType] = useState<AutomationBlockType>("gpio_event_start");
  const [startSourceId, setStartSourceId] = useState("");
  const [initialAction, setInitialAction] = useState<"none" | "record_trigger_event" | "fetch_data_source">("record_trigger_event");
  const [initialFetchSourceId, setInitialFetchSourceId] = useState("");
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [workspaceWorkflowId, setWorkspaceWorkflowId] = useState<string | null>(null);
  const [workspaceRuns, setWorkspaceRuns] = useState<AutomationRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!workspaceWorkflowId) {
      setWorkspaceRuns([]);
      return;
    }
    listAutomationWorkflowRuns(workspaceWorkflowId, 10).then((response) => setWorkspaceRuns(response.items)).catch((err: Error) => setError(err.message));
  }, [workspaceWorkflowId]);

  async function refresh() {
    const [sourceResponse, workflowResponse] = await Promise.all([listDataSources(), listAutomationWorkflows()]);
    setSources(sourceResponse.items);
    setWorkflows(workflowResponse.items);
    if (!startSourceId) setStartSourceId(defaultSourceForStart(startType, sourceResponse.items)?.id ?? "");
    if (!initialFetchSourceId) setInitialFetchSourceId(firstHttpSource(sourceResponse.items)?.id ?? "");
    if (workspaceWorkflowId) {
      const runs = await listAutomationWorkflowRuns(workspaceWorkflowId, 10);
      setWorkspaceRuns(runs.items);
    }
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
      const blocks = buildInitialBlocks({ startType, startSourceId, initialAction, initialFetchSourceId, pollingIntervalSeconds });
      const response = await createAutomationWorkflow({ name, enabled, blocks });
      setName("");
      setInitialAction(defaultInitialAction(startType));
      setCreateModalOpen(false);
      setWorkspaceWorkflowId(response.item.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const selectedStartSource = sources.find((source) => source.id === startSourceId);
  const startSources = sourcesForStart(startType, sources);
  const httpSources = sources.filter((source) => source.type === "json-api" || source.type === "internal-json-api");
  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const sourceName = (id: string) => sourceById(id)?.name ?? "Unknown source";
  const workspaceWorkflow = workflows.find((workflow) => workflow.id === workspaceWorkflowId) ?? null;

  return (
    <Page eyebrow="Automation" title="Block automation workspace" desc="Build workflows from small start, data, logic, and Integritas blocks.">
      <section className="card">
        <div className="status-row">
          <div><strong>Workflow builder</strong><p className="muted">Create a workflow from a start block, then connect action blocks in the workspace.</p></div>
          <button type="button" onClick={() => setCreateModalOpen(true)}>Create new workflow</button>
        </div>
      </section>

      {createModalOpen && (
        <Modal title="Create workflow" onClose={() => setCreateModalOpen(false)}>
          <section className="automation-form">
            <div className="status-row">
              <div><strong>Create workflow</strong><p className="muted">Choose how the workflow starts, then optionally add the first action block.</p></div>
              <span className="pill pill-neutral">Block builder</span>
            </div>

            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Button fetches weather API" /></label>
            <label>Start block<select value={startType} onChange={(event) => {
              const nextType = event.target.value as AutomationBlockType;
              setStartType(nextType);
              setStartSourceId(defaultSourceForStart(nextType, sources)?.id ?? "");
              setInitialAction(defaultInitialAction(nextType));
            }}>
              <option value="manual_start">Manual run</option>
              <option value="schedule_start">Schedule</option>
              <option value="gpio_event_start">GPIO input event</option>
              <option value="webhook_event_start">Webhook received</option>
              <option value="mqtt_event_start">MQTT message received</option>
            </select></label>
            {startType === "schedule_start" ? <label>Interval<select value={pollingIntervalSeconds} onChange={(event) => setPollingIntervalSeconds(Number(event.target.value))}>{intervals.map((interval) => <option key={interval} value={interval}>{formatInterval(interval)}</option>)}</select></label> : !startType.endsWith("manual_start") ? <label>Start source<select value={startSourceId} onChange={(event) => setStartSourceId(event.target.value)}>{startSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label> : <p className="muted">Manual workflows run only when you click Run now.</p>}
            {startType !== "schedule_start" && selectedStartSource && <p className="muted">Starts from {selectedStartSource.name}: {sourceLabel(selectedStartSource)}</p>}
            <label>First action<select value={initialAction} onChange={(event) => setInitialAction(event.target.value as "none" | "record_trigger_event" | "fetch_data_source")}>
              <option value="none">No action yet</option>
              {startType !== "schedule_start" && startType !== "manual_start" && <option value="record_trigger_event">Record trigger event</option>}
              <option value="fetch_data_source">Fetch HTTP JSON source</option>
            </select></label>
            {initialAction === "fetch_data_source" && <label>HTTP source<select value={initialFetchSourceId} onChange={(event) => setInitialFetchSourceId(event.target.value)}>{httpSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>}
            <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
            <button type="button" disabled={busy || !name || !canCreateWorkflow(startType, startSourceId, initialAction, initialFetchSourceId)} onClick={submitWorkflow}>Create workflow</button>
          </section>
        </Modal>
      )}

      {workspaceWorkflow && (
        <Modal title="Workflow workspace" onClose={() => setWorkspaceWorkflowId(null)}>
          <WorkflowWorkspace
            workflow={workspaceWorkflow}
            runs={workspaceRuns}
            source={sourceById(workspaceWorkflow.dataSourceId)}
            sources={sources}
            busy={busy}
            onAddBlock={(input) => run(() => addAutomationBlock(workspaceWorkflow.id, input))}
            onDeleteBlock={(blockId) => run(() => deleteAutomationBlock(workspaceWorkflow.id, blockId))}
            onUpdateBlock={(blockId, input) => run(() => updateAutomationBlock(workspaceWorkflow.id, blockId, input))}
            onReorderBlocks={(blockIds) => run(() => reorderAutomationBlocks(workspaceWorkflow.id, blockIds))}
            onRunNow={() => run(() => runAutomationWorkflow(workspaceWorkflow.id))}
            onRunWithPayload={(payload) => run(() => runAutomationWorkflow(workspaceWorkflow.id, payload))}
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
                    <button type="button" disabled={busy} onClick={() => run(() => runAutomationWorkflow(workflow.id))}>Run now</button>
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

function WorkflowWorkspace({ workflow, runs, source, sources, busy, onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlocks, onRunNow, onRunWithPayload, onToggleEnabled, onDelete }: { workflow: AutomationWorkflow; runs: AutomationRun[]; source: DataSource | undefined; sources: DataSource[]; busy: boolean; onAddBlock: (input: Parameters<typeof addAutomationBlock>[1]) => void; onDeleteBlock: (blockId: string) => void; onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onReorderBlocks: (blockIds: string[]) => void; onRunNow: () => void; onRunWithPayload: (payload: unknown) => void; onToggleEnabled: () => void; onDelete: () => void }) {
  const [fetchSourceId, setFetchSourceId] = useState(() => sources.find((item) => item.type === "json-api" || item.type === "internal-json-api")?.id ?? "");
  const [outputTargetId, setOutputTargetId] = useState(() => sources.find((item) => item.type === "gpio-output")?.id ?? "");
  const [outputPulseMs, setOutputPulseMs] = useState("500");
  const [waitMs, setWaitMs] = useState("1000");
  const [conditionSource, setConditionSource] = useState<"trigger" | "data">("trigger");
  const [conditionFieldPath, setConditionFieldPath] = useState("active");
  const [conditionEquals, setConditionEquals] = useState("true");
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [expandedAddBlock, setExpandedAddBlock] = useState<"record" | "fetch" | "condition" | "wait" | "output" | null>(null);
  const [payloadModalOpen, setPayloadModalOpen] = useState(false);
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(examplePayload(workflow), null, 2));
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const canAddRecordTriggerEvent = Boolean(startBlock && (startBlock.type === "gpio_event_start" || startBlock.type === "webhook_event_start" || startBlock.type === "mqtt_event_start") && !mainBlocks.some((block) => block.type === "record_trigger_event"));
  const fetchSources = sources.filter((item) => item.type === "json-api" || item.type === "internal-json-api");
  const outputTargets = sources.filter((item) => item.type === "gpio-output");

  return (
    <section className="automation-list">
      {payloadModalOpen && (
        <Modal title="Run with payload" onClose={() => setPayloadModalOpen(false)}>
          <section className="automation-form">
            <div className="status-row">
              <div><strong>Manual test payload</strong><p className="muted">This runs the workflow now using the JSON below as the trigger payload. It does not wait for the real trigger.</p></div>
              <span className="pill pill-neutral">Test run</span>
            </div>
            <label>Trigger payload<textarea rows={12} value={payloadText} onChange={(event) => {
              setPayloadText(event.target.value);
              setPayloadError(null);
            }} /></label>
            {payloadError && <p className="error-text">{payloadError}</p>}
            <div className="row-actions">
              <button type="button" disabled={busy} onClick={() => setPayloadText(JSON.stringify(examplePayload(workflow), null, 2))}>Reset example</button>
              <button type="button" disabled={busy} onClick={() => setPayloadModalOpen(false)}>Cancel</button>
              <button type="button" disabled={busy} onClick={() => {
                try {
                  const parsed = JSON.parse(payloadText) as unknown;
                  setPayloadModalOpen(false);
                  onRunWithPayload(parsed);
                } catch (error) {
                  setPayloadError(error instanceof Error ? error.message : "Payload must be valid JSON");
                }
              }}>Run test</button>
            </div>
          </section>
        </Modal>
      )}
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
        {mainBlocks.map((block, index) => <BlockCard
          key={block.id}
          block={block}
          attachedBlocks={workflow.blocks.filter((item) => item.parentBlockId === block.id)}
          sources={sources}
          busy={busy}
          canMoveUp={index > 1}
          canMoveDown={index > 0 && index < mainBlocks.length - 1}
          onMoveUp={() => onReorderBlocks(moveBlock(mainBlocks, index, index - 1))}
          onMoveDown={() => onReorderBlocks(moveBlock(mainBlocks, index, index + 1))}
          onAttachStamp={() => onAddBlock({ type: "stamp_integritas", config: {}, parentBlockId: block.id })}
          onUpdate={(input) => onUpdateBlock(block.id, input)}
          onUpdateAttached={(blockId, input) => onUpdateBlock(blockId, input)}
          onDelete={() => block.type.endsWith("_start") ? undefined : onDeleteBlock(block.id)}
          onDeleteAttached={onDeleteBlock}
        />)}
      </div>

      <section className="card soft-card">
        <div className="status-row">
          <div>
            <strong>Add block</strong>
            <p className="muted">Append small logic pieces to this workflow. Attach Integritas stamps directly to record or fetch blocks.</p>
          </div>
        </div>
        <div className="grid-list">
          {canAddRecordTriggerEvent && (
            <AddBlockCard id="record" title="Record trigger event" description="Store the event that started this workflow as data, making it hashable and stampable." expanded={expandedAddBlock === "record"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "record" ? null : "record")}>
              <div className="row-actions">
                <button type="button" disabled={busy} onClick={() => onAddBlock({ type: "record_trigger_event", config: {} })}>Add record trigger block</button>
              </div>
            </AddBlockCard>
          )}
          <AddBlockCard id="fetch" title="Fetch data source" description="Fetch JSON from an HTTP device/source and make it the latest workflow data." expanded={expandedAddBlock === "fetch"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "fetch" ? null : "fetch")}>
            <div className="automation-form">
              <label>Fetch data source<select value={fetchSourceId} onChange={(event) => setFetchSourceId(event.target.value)}>{fetchSources.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
              <div className="row-actions">
                <button type="button" disabled={busy || !fetchSourceId} onClick={() => onAddBlock({ type: "fetch_data_source", config: { sourceId: fetchSourceId } })}>Add fetch block</button>
              </div>
            </div>
          </AddBlockCard>
          <AddBlockCard id="condition" title="If field equals" description="Continue only when a trigger or data field equals the JSON value you specify." expanded={expandedAddBlock === "condition"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "condition" ? null : "condition")}>
            <div className="automation-form">
              <label>Condition source<select value={conditionSource} onChange={(event) => setConditionSource(event.target.value as "trigger" | "data")}><option value="trigger">Trigger event</option><option value="data">Latest data</option></select></label>
              <label>{conditionSource === "trigger" ? "Trigger field path" : "Data field path"}<input value={conditionFieldPath} onChange={(event) => setConditionFieldPath(event.target.value)} placeholder="active" /></label>
              <label>Equals JSON<input value={conditionEquals} onChange={(event) => {
                setConditionEquals(event.target.value);
                setConditionError(null);
              }} placeholder="true" /></label>
              {conditionError && <p className="error-text">{conditionError}</p>}
              <div className="row-actions">
                <button type="button" disabled={busy || !conditionFieldPath.trim()} onClick={() => {
                  try {
                    onAddBlock({ type: "if_payload_field_equals", config: { source: conditionSource, fieldPath: conditionFieldPath.trim(), equals: JSON.parse(conditionEquals) as unknown } });
                  } catch (error) {
                    setConditionError(error instanceof Error ? error.message : "Equals must be valid JSON");
                  }
                }}>Add condition block</button>
              </div>
            </div>
          </AddBlockCard>
          <AddBlockCard id="wait" title="Wait" description="Pause the workflow for a short time before running the next block." expanded={expandedAddBlock === "wait"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "wait" ? null : "wait")}>
            <div className="automation-form">
              <label>Wait duration ms<input value={waitMs} onChange={(event) => setWaitMs(event.target.value)} inputMode="numeric" placeholder="1000" /></label>
              <div className="row-actions">
                <button type="button" disabled={busy || !Number.isFinite(Number(waitMs))} onClick={() => onAddBlock({ type: "wait", config: { durationMs: Number(waitMs) } })}>Add wait block</button>
              </div>
            </div>
          </AddBlockCard>
          <AddBlockCard id="output" title="Control output" description="Pulse a configured LED output target from this workflow." expanded={expandedAddBlock === "output"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "output" ? null : "output")}>
            <div className="automation-form">
              <label>Output target<select value={outputTargetId} onChange={(event) => setOutputTargetId(event.target.value)}>{outputTargets.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
              <label>Pulse duration ms<input value={outputPulseMs} onChange={(event) => setOutputPulseMs(event.target.value)} inputMode="numeric" placeholder="500" /></label>
              <div className="row-actions">
                <button type="button" disabled={busy || !outputTargetId || !Number.isFinite(Number(outputPulseMs))} onClick={() => onAddBlock({ type: "control_output", config: { targetId: outputTargetId, action: "pulse", durationMs: Number(outputPulseMs) } })}>Add output pulse block</button>
              </div>
            </div>
          </AddBlockCard>
        </div>
      </section>

      <div className="status-row">
        <div>
          <strong>Improve this workflow</strong>
          <p className="muted">Run the workflow manually, pause it, or delete it. Add Integritas stamps from record/fetch blocks.</p>
        </div>
        <div className="row-actions">
          <button type="button" disabled={busy} onClick={onRunNow}>Run now</button>
          <button type="button" disabled={busy} onClick={() => {
            setPayloadText(JSON.stringify(examplePayload(workflow), null, 2));
            setPayloadError(null);
            setPayloadModalOpen(true);
          }}>Run with payload</button>
          <button type="button" disabled={busy} onClick={onToggleEnabled}>{workflow.enabled ? "Pause" : "Enable"}</button>
          <button type="button" disabled={busy} onClick={onDelete}>Delete workflow</button>
        </div>
      </div>

      <section className="card soft-card">
        <div><strong>Recent runs</strong><p className="muted">Latest executions for this workflow, including per-block status.</p></div>
        <AutomationRunsTable runs={runs} compact />
      </section>
    </section>
  );
}

function AddBlockCard({ title, description, expanded, onToggle, children }: { id: string; title: string; description: string; expanded: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="card soft-card">
      <button type="button" className="ghost-button" onClick={onToggle} aria-expanded={expanded}>
        <div className="status-row">
          <div><strong>{title}</strong><p className="muted">{description}</p></div>
          <span className="pill pill-neutral">{expanded ? "Open" : "Add"}</span>
        </div>
      </button>
      {expanded && <div>{children}</div>}
    </section>
  );
}

function BlockCard({ block, attachedBlocks, sources, busy, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onAttachStamp, onUpdate, onUpdateAttached, onDelete, onDeleteAttached }: { block: AutomationBlock; attachedBlocks: AutomationBlock[]; sources: DataSource[]; busy: boolean; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onAttachStamp: () => void; onUpdate: (input: Parameters<typeof updateAutomationBlock>[2]) => void; onUpdateAttached: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onDelete: () => void; onDeleteAttached: (blockId: string) => void }) {
  const [fetchSourceId, setFetchSourceId] = useState(block.config.sourceId ?? "");
  const [outputTargetId, setOutputTargetId] = useState(block.config.targetId ?? "");
  const [outputDurationMs, setOutputDurationMs] = useState(String(block.config.durationMs ?? 500));
  const [durationMs, setDurationMs] = useState(String(block.config.durationMs ?? 1000));
  const [conditionSource, setConditionSource] = useState<"trigger" | "data">(block.config.source ?? "trigger");
  const [conditionFieldPath, setConditionFieldPath] = useState(block.config.fieldPath ?? "active");
  const [conditionEquals, setConditionEquals] = useState(JSON.stringify(block.config.equals ?? true));
  const [conditionError, setConditionError] = useState<string | null>(null);
  const removable = !block.type.endsWith("_start");
  const canAttachStamp = block.type === "record_trigger_event" || block.type === "fetch_data_source";
  const stampBlock = attachedBlocks.find((item) => item.type === "stamp_integritas");
  const [stampConditionSource, setStampConditionSource] = useState<"trigger" | "data">(stampBlock?.config.condition?.source ?? "data");
  const [stampConditionFieldPath, setStampConditionFieldPath] = useState(stampBlock?.config.condition?.fieldPath ?? "sensor.temperature");
  const [stampConditionEquals, setStampConditionEquals] = useState(JSON.stringify(stampBlock?.config.condition?.equals ?? 15));
  const [stampConditionError, setStampConditionError] = useState<string | null>(null);
  const fetchSources = sources.filter((item) => item.type === "json-api" || item.type === "internal-json-api");
  const outputTargets = sources.filter((item) => item.type === "gpio-output");
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
      {block.type === "if_payload_field_equals" && (
        <div className="automation-form">
          <label>Condition source<select value={conditionSource} onChange={(event) => setConditionSource(event.target.value as "trigger" | "data")}><option value="trigger">Trigger event</option><option value="data">Latest data</option></select></label>
          <label>{conditionSource === "trigger" ? "Trigger field path" : "Data field path"}<input value={conditionFieldPath} onChange={(event) => setConditionFieldPath(event.target.value)} placeholder="active" /></label>
          <label>Equals JSON<input value={conditionEquals} onChange={(event) => {
            setConditionEquals(event.target.value);
            setConditionError(null);
          }} placeholder="true" /></label>
          {conditionError && <p className="error-text">{conditionError}</p>}
          <button type="button" disabled={busy || !conditionFieldPath.trim()} onClick={() => {
            try {
              onUpdate({ config: { source: conditionSource, fieldPath: conditionFieldPath.trim(), equals: JSON.parse(conditionEquals) as unknown } });
            } catch (error) {
              setConditionError(error instanceof Error ? error.message : "Equals must be valid JSON");
            }
          }}>Save condition</button>
        </div>
      )}
      {block.type === "control_output" && (
        <div className="automation-form">
          <label>Output target<select value={outputTargetId} onChange={(event) => setOutputTargetId(event.target.value)}>{outputTargets.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
          <label>Pulse duration ms<input value={outputDurationMs} onChange={(event) => setOutputDurationMs(event.target.value)} inputMode="numeric" /></label>
          <button type="button" disabled={busy || !outputTargetId || !Number.isFinite(Number(outputDurationMs))} onClick={() => onUpdate({ config: { targetId: outputTargetId, action: "pulse", durationMs: Number(outputDurationMs) } })}>Save output pulse</button>
        </div>
      )}
      {stampBlock && (
        <div className="card soft-card">
          <div className="status-row">
            <div><strong>+ Stamp with Integritas</strong><p className="muted">Side block attached to this data block. It stamps this block's hash immediately after data is recorded.</p></div>
            <span className={`pill ${stampBlock.lastError ? "pill-warn" : stampBlock.enabled ? "pill-good" : "pill-neutral"}`}>{stampStatus(stampBlock)}</span>
          </div>
          <div className="metric-grid">
            <RulePart title="Status" value={stampBlock.lastError ? "Error" : stampBlock.enabled ? "Enabled" : "Disabled"} />
            <RulePart title="Last stamped" value={stampBlock.lastRunAt ? formatLocalTime(stampBlock.lastRunAt) : "Not run yet"} />
            <RulePart title="Condition" value={stampConditionSummary(stampBlock)} />
          </div>
          {stampBlock.lastError && <p className="error-text">{stampBlock.lastError}</p>}
          <div className="automation-form">
            <label>Stamp condition source<select value={stampConditionSource} onChange={(event) => setStampConditionSource(event.target.value as "trigger" | "data")}><option value="data">Latest data</option><option value="trigger">Trigger event</option></select></label>
            <label>{stampConditionSource === "trigger" ? "Stamp only if trigger field path" : "Stamp only if data field path"}<input value={stampConditionFieldPath} onChange={(event) => setStampConditionFieldPath(event.target.value)} placeholder="sensor.temperature" /></label>
            <label>Equals JSON<input value={stampConditionEquals} onChange={(event) => {
              setStampConditionEquals(event.target.value);
              setStampConditionError(null);
            }} placeholder="15" /></label>
            {stampConditionError && <p className="error-text">{stampConditionError}</p>}
            <div className="row-actions">
              <button type="button" disabled={busy || !stampConditionFieldPath.trim()} onClick={() => {
                try {
                  onUpdateAttached(stampBlock.id, { config: { condition: { source: stampConditionSource, fieldPath: stampConditionFieldPath.trim(), equals: JSON.parse(stampConditionEquals) as unknown } } });
                } catch (error) {
                  setStampConditionError(error instanceof Error ? error.message : "Equals must be valid JSON");
                }
              }}>Save stamp condition</button>
              <button type="button" disabled={busy || !stampBlock.config.condition} onClick={() => onUpdateAttached(stampBlock.id, { config: { condition: null } })}>Clear stamp condition</button>
            </div>
          </div>
          <div className="row-actions">
            <button type="button" disabled={busy} onClick={() => onUpdateAttached(stampBlock.id, { enabled: !stampBlock.enabled })}>{stampBlock.enabled ? "Disable stamp" : "Enable stamp"}</button>
            <button type="button" disabled={busy} onClick={() => onDeleteAttached(stampBlock.id)}>Remove stamp</button>
          </div>
        </div>
      )}
      {removable && <div className="row-actions">
        <button type="button" disabled={busy || !canMoveUp} onClick={onMoveUp}>Move up</button>
        <button type="button" disabled={busy || !canMoveDown} onClick={onMoveDown}>Move down</button>
        {canAttachStamp && !stampBlock && <button type="button" disabled={busy} onClick={onAttachStamp}>Attach Integritas</button>}
        <button type="button" disabled={busy} onClick={() => onUpdate({ enabled: !block.enabled })}>{block.enabled ? "Disable" : "Enable"}</button>
        <button type="button" disabled={busy} onClick={onDelete}>Remove block</button>
      </div>}
    </div>
  );
}

function stampConditionSummary(block: AutomationBlock) {
  const condition = block.config.condition;
  if (!condition) return "Always stamp";
  return `${conditionSourceLabel(condition.source ?? "data")} ${condition.fieldPath} equals ${JSON.stringify(condition.equals)}`;
}

function stampStatus(block: AutomationBlock) {
  if (!block.enabled) return "Disabled";
  if (block.lastError) return "Error";
  if (block.lastRunAt) return "Last stamped";
  return "Not run yet";
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
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  if (mainBlocks.length === 0) return "No blocks";
  return mainBlocks.map((block) => {
    const hasStamp = workflow.blocks.some((item) => item.parentBlockId === block.id && item.type === "stamp_integritas");
    return `${blockShortLabel(block)}${hasStamp ? " (+Stamp)" : ""}`;
  }).join(" -> ");
}

function blockLabel(block: AutomationBlock) {
  if (block.type === "schedule_start") return "Start on schedule";
  if (block.type === "gpio_event_start") return "Start on GPIO event";
  if (block.type === "webhook_event_start") return "Start on webhook";
  if (block.type === "mqtt_event_start") return "Start on MQTT message";
  if (block.type === "manual_start") return "Start manually";
  if (block.type === "record_trigger_event") return "Record trigger event";
  if (block.type === "fetch_data_source") return "Fetch data source";
  if (block.type === "if_payload_field_equals") return `If ${conditionSourceLabel(block.config.source ?? "trigger")} field equals`;
  if (block.type === "wait") return "Wait";
  if (block.type === "stamp_integritas") return "Stamp with Integritas";
  if (block.type === "control_output") return "Control output";
  return block.type;
}

function blockShortLabel(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Start";
  if (block.type === "record_trigger_event") return "Record event";
  if (block.type === "fetch_data_source") return "Fetch source";
  if (block.type === "if_payload_field_equals") return "If payload matches";
  if (block.type === "stamp_integritas") return "Stamp";
  if (block.type === "control_output") return "Control output";
  if (block.type === "wait") return "Wait";
  return block.type;
}

function blockDescription(block: AutomationBlock, sources: DataSource[]) {
  const source = block.config.sourceId || block.config.targetId ? sources.find((item) => item.id === (block.config.sourceId ?? block.config.targetId)) : undefined;
  if (block.type === "schedule_start") return `Every ${formatInterval(Number(block.config.intervalSeconds ?? 0)).replace("Every ", "")}`;
  if (block.type === "gpio_event_start") return source ? `${source.name} - GPIO${source.config.pin ?? "?"}` : "GPIO input event";
  if (block.type === "webhook_event_start") return source ? `${source.name} webhook payload` : "Webhook payload";
  if (block.type === "mqtt_event_start") return source ? `${source.name} MQTT message` : "MQTT message";
  if (block.type === "record_trigger_event") return "Store the incoming trigger payload as a data read";
  if (block.type === "fetch_data_source") return source ? `Fetch ${source.name}` : "Fetch configured HTTP JSON source";
  if (block.type === "if_payload_field_equals") return `Continue only if ${conditionSourceLabel(block.config.source ?? "trigger")} ${block.config.fieldPath ?? "field"} equals ${JSON.stringify(block.config.equals)}`;
  if (block.type === "wait") return `Pause for ${block.config.durationMs ?? 0} ms`;
  if (block.type === "stamp_integritas") return "Stamp the latest collected hash";
  if (block.type === "control_output") return source ? `Pulse ${source.name} for ${block.config.durationMs ?? 0} ms` : "Pulse configured output target";
  return "Workflow block";
}

function blockOutput(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Trigger context";
  if (block.type === "record_trigger_event") return "Hash + read";
  if (block.type === "fetch_data_source") return "Fetched JSON + hash";
  if (block.type === "if_payload_field_equals") return "Continue or stop";
  if (block.type === "wait") return "Same context";
  if (block.type === "stamp_integritas") return "Proof UID";
  if (block.type === "control_output") return "Output action result";
  return "Context";
}

function conditionSourceLabel(source: "trigger" | "data") {
  return source === "data" ? "data" : "trigger";
}

function sourcesForStart(type: AutomationBlockType, sources: DataSource[]) {
  if (type === "gpio_event_start") return sources.filter((source) => source.type === "gpio-input");
  if (type === "webhook_event_start") return sources.filter((source) => source.type === "webhook");
  if (type === "mqtt_event_start") return sources.filter((source) => source.type === "mqtt");
  return [];
}

function defaultSourceForStart(type: AutomationBlockType, sources: DataSource[]) {
  return sourcesForStart(type, sources)[0] ?? null;
}

function firstHttpSource(sources: DataSource[]) {
  return sources.find((source) => source.type === "json-api" || source.type === "internal-json-api") ?? null;
}

function defaultInitialAction(type: AutomationBlockType): "none" | "record_trigger_event" | "fetch_data_source" {
  if (type === "schedule_start" || type === "manual_start") return "fetch_data_source";
  return "record_trigger_event";
}

function canCreateWorkflow(startType: AutomationBlockType, startSourceId: string, initialAction: "none" | "record_trigger_event" | "fetch_data_source", initialFetchSourceId: string) {
  if (startType !== "manual_start" && startType !== "schedule_start" && !startSourceId) return false;
  if (initialAction === "fetch_data_source" && !initialFetchSourceId) return false;
  return true;
}

function buildInitialBlocks(input: { startType: AutomationBlockType; startSourceId: string; initialAction: "none" | "record_trigger_event" | "fetch_data_source"; initialFetchSourceId: string; pollingIntervalSeconds: number }) {
  const blocks: { type: AutomationBlockType; config: AutomationBlock["config"] }[] = [];
  if (input.startType === "schedule_start") blocks.push({ type: "schedule_start", config: { intervalSeconds: input.pollingIntervalSeconds } });
  else if (input.startType === "manual_start") blocks.push({ type: "manual_start", config: {} });
  else blocks.push({ type: input.startType, config: { sourceId: input.startSourceId } });

  if (input.initialAction === "record_trigger_event") blocks.push({ type: "record_trigger_event", config: {} });
  if (input.initialAction === "fetch_data_source") blocks.push({ type: "fetch_data_source", config: { sourceId: input.initialFetchSourceId } });
  return blocks;
}

function examplePayload(workflow: AutomationWorkflow) {
  const startBlock = workflow.blocks.find((block) => !block.parentBlockId && block.type.endsWith("_start"));
  const now = new Date().toISOString();

  if (startBlock?.type === "gpio_event_start") {
    return {
      source: "run-with-payload",
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredAt: now,
      chip: "gpiochip0",
      pin: 17,
      edge: "falling",
      active: true
    };
  }

  if (startBlock?.type === "webhook_event_start") {
    return {
      source: "run-with-payload",
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredAt: now,
      event: "test-webhook",
      temperature: 21.5,
      unit: "celsius"
    };
  }

  if (startBlock?.type === "mqtt_event_start") {
    return {
      source: "run-with-payload",
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredAt: now,
      topic: "test/topic",
      temperature: 21.5,
      unit: "celsius"
    };
  }

  return {
    source: "run-with-payload",
    workflowId: workflow.id,
    workflowName: workflow.name,
    triggeredAt: now,
    note: "Manual workflow test run with custom payload"
  };
}

function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt") return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "gpio-input") return `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  if (source.type === "gpio-output") return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  return source.config.url ?? "HTTP JSON API";
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds < 3600) return `Every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `Every ${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}
