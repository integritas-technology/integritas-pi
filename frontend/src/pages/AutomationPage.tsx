import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { addAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationWorkflow, duplicateAutomationWorkflow, getAutomationWorkflowValidation, listAutomationWorkflowRuns, listAutomationWorkflows, reorderAutomationBlocks, runAutomationWorkflow, updateAutomationBlock, updateAutomationWorkflow, validateAutomationDraft } from "../features/automation/automationApi";
import { AutomationRunsTable } from "../features/automation/AutomationRunsTable";
import { draftBlockDescription, draftBlockTitle, isDataBlock, WorkflowBlockLibrary, WorkflowDraftCanvas, WorkflowSavedCanvas, type DraftWorkflowBlock } from "../features/automation/WorkflowCanvas";
import type { AutomationBlock, AutomationBlockType, AutomationRun, AutomationValidationResult, AutomationWorkflow, ConditionOperator } from "../features/automation/automationTypes";
import { listAddressBookEntries } from "../features/address-book/addressBookApi";
import type { AddressBookEntry } from "../features/address-book/addressBookTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { getWalletStatus } from "../features/wallet/walletApi";
import type { TokenBalance, WalletStatus } from "../features/wallet/walletTypes";
import { formatLocalTime } from "../lib/time";

const intervals = [10, 30, 60, 300, 900, 3600];

export function AutomationPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [name, setName] = useState("");
  const [startType, setStartType] = useState<AutomationBlockType>("gpio_event_start");
  const [startSourceId, setStartSourceId] = useState("");
  const [initialAction, setInitialAction] = useState<"none" | "record_trigger_event" | "fetch_data_source">("record_trigger_event");
  const [initialFetchSourceId, setInitialFetchSourceId] = useState("");
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<"active" | "all" | "enabled" | "paused" | "error" | "archived">("active");
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [workspaceWorkflowId, setWorkspaceWorkflowId] = useState<string | null>(null);
  const [workspaceRuns, setWorkspaceRuns] = useState<AutomationRun[]>([]);
  const [workspaceValidation, setWorkspaceValidation] = useState<AutomationValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!workspaceWorkflowId) {
      setWorkspaceRuns([]);
      setWorkspaceValidation(null);
      return;
    }
    Promise.all([listAutomationWorkflowRuns(workspaceWorkflowId, 10), getAutomationWorkflowValidation(workspaceWorkflowId)])
      .then(([runs, validation]) => {
        setWorkspaceRuns(runs.items);
        setWorkspaceValidation(validation.item);
      })
      .catch((err: Error) => setError(err.message));
  }, [workspaceWorkflowId]);

  async function refresh() {
    const [sourceResponse, workflowResponse, addressBookResponse, walletResponse] = await Promise.all([
      listDataSources(),
      listAutomationWorkflows(),
      listAddressBookEntries().catch(() => [] as AddressBookEntry[]),
      getWalletStatus().catch(() => null as WalletStatus | null)
    ]);
    setSources(sourceResponse.items);
    setWorkflows(workflowResponse.items);
    setAddressBook(addressBookResponse);
    setWalletStatus(walletResponse);
    if (!startSourceId) setStartSourceId(defaultSourceForStart(startType, sourceResponse.items)?.id ?? "");
    if (!initialFetchSourceId) setInitialFetchSourceId(firstHttpSource(sourceResponse.items)?.id ?? "");
    if (workspaceWorkflowId) {
      const [runs, validation] = await Promise.all([listAutomationWorkflowRuns(workspaceWorkflowId, 10), getAutomationWorkflowValidation(workspaceWorkflowId)]);
      setWorkspaceRuns(runs.items);
      setWorkspaceValidation(validation.item);
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

  async function submitWorkflow(blocks: { type: AutomationBlockType; config: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null }[]) {
    setBusy(true);
    setError(null);
    try {
      const response = await createAutomationWorkflow({ name, enabled, blocks });
      setName("");
      setInitialAction(defaultInitialAction(startType));
      setCreatingWorkflow(false);
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
  const filteredWorkflows = workflows.filter((workflow) => workflowMatchesFilter(workflow, workflowSearch, workflowFilter, sourceName(workflow.dataSourceId)));

  return (
    <Page
      eyebrow="Automation"
      title={creatingWorkflow ? "Create workflow" : "Block automation workspace"}
      desc={creatingWorkflow ? "Assemble a starter workflow from blocks, then create it when the draft validates." : "Build workflows from small start, data, logic, and Integritas blocks."}
    >
      {!creatingWorkflow && (
        <section className="card">
          <div className="status-row">
            <div><strong>Workflow builder</strong><p className="muted">Create a workflow from a start block, then connect action blocks in the workspace.</p></div>
            <button type="button" onClick={() => setCreatingWorkflow(true)}>Create new workflow</button>
          </div>
        </section>
      )}

      {creatingWorkflow && (
        <CreateWorkflowWorkspace
          name={name}
          enabled={enabled}
          sources={sources}
          addressBook={addressBook}
          walletStatus={walletStatus}
          busy={busy}
          onNameChange={setName}
          onEnabledChange={setEnabled}
          onCancel={() => setCreatingWorkflow(false)}
          onCreate={submitWorkflow}
        />
      )}

      {workspaceWorkflow && (
        <Modal title="Workflow workspace" onClose={() => setWorkspaceWorkflowId(null)}>
          <WorkflowWorkspace
            workflow={workspaceWorkflow}
            runs={workspaceRuns}
            validation={workspaceValidation}
            source={sourceById(workspaceWorkflow.dataSourceId)}
            sources={sources}
            addressBook={addressBook}
            walletStatus={walletStatus}
            busy={busy}
            onAddBlock={(input) => run(() => addAutomationBlock(workspaceWorkflow.id, input))}
            onDeleteBlock={(blockId) => run(() => deleteAutomationBlock(workspaceWorkflow.id, blockId))}
            onUpdateBlock={(blockId, input) => run(() => updateAutomationBlock(workspaceWorkflow.id, blockId, input))}
            onReorderBlocks={(blockIds) => run(() => reorderAutomationBlocks(workspaceWorkflow.id, blockIds))}
            onRunNow={() => run(() => runAutomationWorkflow(workspaceWorkflow.id))}
            onRunWithPayload={(payload) => run(() => runAutomationWorkflow(workspaceWorkflow.id, payload))}
            onToggleEnabled={() => run(() => updateAutomationWorkflow(workspaceWorkflow.id, { enabled: !workspaceWorkflow.enabled }))}
            onToggleArchived={() => run(async () => {
              await updateAutomationWorkflow(workspaceWorkflow.id, { archived: !workspaceWorkflow.archived });
              if (!workspaceWorkflow.archived) setWorkspaceWorkflowId(null);
            })}
            onDelete={() => run(async () => {
              await deleteAutomationWorkflow(workspaceWorkflow.id);
              setWorkspaceWorkflowId(null);
            })}
          />
        </Modal>
      )}

      {error && <p className="error-text">{error}</p>}

      {!creatingWorkflow && <section className="card automation-list">
        <div className="status-row">
          <div><strong>Workflows</strong><p className="muted">Search, filter, duplicate, and archive workflows as your test list grows.</p></div>
          <span className="pill pill-neutral">{filteredWorkflows.length}/{workflows.length} shown</span>
        </div>
        <div className="automation-form">
          <label>Search workflows<input value={workflowSearch} onChange={(event) => setWorkflowSearch(event.target.value)} placeholder="Name, block type, device, hash..." /></label>
          <label>Status filter<select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value as typeof workflowFilter)}>
            <option value="active">Active list (not archived)</option>
            <option value="all">All workflows</option>
            <option value="enabled">Enabled</option>
            <option value="paused">Paused</option>
            <option value="error">With errors</option>
            <option value="archived">Archived</option>
          </select></label>
        </div>
        <div className="grid-list">
          {filteredWorkflows.map((workflow) => {
            return (
              <article key={workflow.id} className="card soft-card">
                <div className="status-row">
                  <div>
                    <strong>{workflow.name}</strong>
                    <p className="muted">{sourceName(workflow.dataSourceId)} · {workflow.pollingIntervalSeconds > 0 ? formatInterval(workflow.pollingIntervalSeconds) : "Event driven"}</p>
                  </div>
                  <span className={`pill ${workflow.archived ? "pill-neutral" : workflow.lastError ? "pill-warn" : workflow.enabled ? "pill-good" : "pill-neutral"}`}>{workflow.archived ? "Archived" : workflow.lastError ? "Error" : workflow.enabled ? "Enabled" : "Paused"}</span>
                </div>

                {workflow.lastError && <p className="error-text">{workflow.lastError}</p>}

                <div className="status-row">
                  <div>
                    <p className="muted">Blocks: {summarizeBlocks(workflow)}</p>
                    <p className="muted">Last run: {workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</p>
                    <p className="muted">Last hash: {workflow.lastHash ? <code>{workflow.lastHash}</code> : "No hash yet"}</p>
                    {workflow.archived && <p className="muted">Archived workflows do not run until restored.</p>}
                  </div>
                  <div className="row-actions">
                    <button type="button" disabled={busy} onClick={() => setWorkspaceWorkflowId(workflow.id)}>Open</button>
                    <button type="button" disabled={busy || workflow.archived} onClick={() => run(() => runAutomationWorkflow(workflow.id))}>Run now</button>
                    <button type="button" disabled={busy || workflow.archived} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }))}>{workflow.enabled ? "Pause now" : "Enable now"}</button>
                    <button type="button" disabled={busy} onClick={() => run(() => duplicateAutomationWorkflow(workflow.id))}>Duplicate</button>
                    <button type="button" disabled={busy} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { archived: !workflow.archived }))}>{workflow.archived ? "Restore" : "Archive"}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {workflows.length === 0 && <p className="muted">No automation workflows yet.</p>}
        {workflows.length > 0 && filteredWorkflows.length === 0 && <p className="muted">No workflows match this filter.</p>}
      </section>}
    </Page>
  );
}

function CreateWorkflowWorkspace({ name, enabled, sources, addressBook, walletStatus, busy, onNameChange, onEnabledChange, onCancel, onCreate }: { name: string; enabled: boolean; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; onNameChange: (value: string) => void; onEnabledChange: (value: boolean) => void; onCancel: () => void; onCreate: (blocks: { type: AutomationBlockType; config: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null; clientId?: string | null }[]) => void }) {
  const [draftBlocks, setDraftBlocks] = useState<DraftWorkflowBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [backendValidation, setBackendValidation] = useState<AutomationValidationResult | null>(null);
  const [backendValidationError, setBackendValidationError] = useState<string | null>(null);
  const selectedBlock = draftBlocks.find((block) => block.id === selectedBlockId) ?? draftBlocks[0];
  const localErrors = name.trim() ? [] : ["Workflow name is required."];
  const backendErrors = backendValidation?.errors.map((issue) => issue.message) ?? [];
  const backendWarnings = backendValidation?.warnings.map((issue) => issue.message) ?? [];
  const canCreate = localErrors.length === 0 && Boolean(backendValidation?.ok);
  const hasStartBlock = draftBlocks.some((block) => block.type.endsWith("_start"));

  useEffect(() => {
    let cancelled = false;
    setBackendValidationError(null);
    validateAutomationDraft({ blocks: flattenDraftBlocks(draftBlocks) })
      .then((response) => {
        if (!cancelled) setBackendValidation(response.item);
      })
      .catch((error) => {
        if (!cancelled) setBackendValidationError(error instanceof Error ? error.message : "Could not validate draft workflow.");
      });
    return () => {
      cancelled = true;
    };
  }, [draftBlocks]);

  function updateBlock(id: string, patch: Partial<DraftWorkflowBlock>) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === id ? { ...block, ...patch, config: patch.config ?? block.config } : block));
  }

  function attachStampBlock(parentId: string) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === parentId ? { ...block, attachedBlocks: [...(block.attachedBlocks ?? []), createDraftBlock("stamp_integritas", sources)] } : block));
  }

  function updateAttachedBlock(parentId: string, attachedId: string, config: AutomationBlock["config"]) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === parentId ? { ...block, attachedBlocks: (block.attachedBlocks ?? []).map((attached) => attached.id === attachedId ? { ...attached, config } : attached) } : block));
  }

  function removeAttachedBlock(parentId: string, attachedId: string) {
    setDraftBlocks((blocks) => blocks.map((block) => block.id === parentId ? { ...block, attachedBlocks: (block.attachedBlocks ?? []).filter((attached) => attached.id !== attachedId) } : block));
  }

  function addDraftBlock(type: AutomationBlockType) {
    if (!hasStartBlock && !type.endsWith("_start")) return;
    setDraftBlocks((blocks) => {
      const next = [...blocks, createDraftBlock(type, sources)];
      setSelectedBlockId(next[next.length - 1].id);
      return next;
    });
  }

  function removeDraftBlock(id: string) {
    setDraftBlocks((blocks) => {
      const block = blocks.find((item) => item.id === id);
      if (!block || block.type.endsWith("_start")) return blocks;
      const next = blocks.filter((item) => item.id !== id);
      setSelectedBlockId(next[Math.max(0, blocks.findIndex((item) => item.id === id) - 1)]?.id ?? next[0]?.id ?? "");
      return next;
    });
  }

  function moveDraftBlock(id: string, direction: -1 | 1) {
    setDraftBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index <= 0 || nextIndex <= 0 || nextIndex >= blocks.length) return blocks;
      const next = [...blocks];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function selectStartBlock(type: AutomationBlockType) {
    setDraftBlocks((blocks) => {
      const start = createDraftBlock(type, sources);
      if (blocks.some((block) => block.type.endsWith("_start"))) return blocks;
      setSelectedBlockId(start.id);
      return [start];
    });
  }

  function resetCanvas() {
    setDraftBlocks([]);
    setSelectedBlockId("");
  }

  return (
    <section className="workflow-create-shell">
      <div className="workflow-create-topbar">
        <div>
          <span className="pill pill-neutral">Draft workflow</span>
          <h2>Create a new block workflow</h2>
          <p className="muted">Choose one start block, then add data and logic blocks to build the first draft chain.</p>
        </div>
        <div className="row-actions">
          <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" disabled={busy || draftBlocks.length === 0} onClick={resetCanvas}>Reset canvas</button>
          <button type="button" disabled={busy || !canCreate} onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}>Create workflow</button>
        </div>
      </div>

      <div className="workflow-create-grid">
        <WorkflowBlockLibrary hasStartBlock={hasStartBlock} selectedBlock={selectedBlock} onSelectStartBlock={selectStartBlock} onAddBlock={addDraftBlock} onAttachStamp={attachStampBlock} />

        <WorkflowDraftCanvas blocks={draftBlocks} sources={sources} enabled={enabled} selectedBlockId={selectedBlock?.id ?? ""} onSelectBlock={setSelectedBlockId} onMoveBlock={moveDraftBlock} onRemoveBlock={removeDraftBlock} />

        <aside className="workflow-create-inspector automation-form">
          <div className="card soft-card">
            <strong>Workflow setup</strong>
            <label>Workflow name<input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Button fetches weather API" /></label>
            <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} /> Enabled after create</label>
            <strong>Validation</strong>
            {localErrors.map((issue) => <p key={issue} className="error-text">{issue}</p>)}
            {backendErrors.map((issue) => <p key={issue} className="error-text">{issue}</p>)}
            {backendWarnings.map((issue) => <p key={issue} className="muted">{issue}</p>)}
            {backendValidationError && <p className="error-text">{backendValidationError}</p>}
            {!backendValidation && !backendValidationError && <p className="muted">Checking draft workflow...</p>}
            {canCreate && <p className="muted">No blocking draft errors. Review any warnings before creating.</p>}
          </div>
          <div className="card soft-card">
            <strong>Selected block</strong>
            {selectedBlock ? <DraftBlockInspector block={selectedBlock} sources={sources} addressBook={addressBook} walletStatus={walletStatus} onChange={(config) => updateBlock(selectedBlock.id, { config })} onAttachedChange={(attachedId, config) => updateAttachedBlock(selectedBlock.id, attachedId, config)} onAttachedRemove={(attachedId) => removeAttachedBlock(selectedBlock.id, attachedId)} /> : <p className="muted">Choose a start block on the left or select a block on the canvas to configure it.</p>}
          </div>
          <button type="button" disabled={busy || !canCreate} onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}>Create workflow</button>
        </aside>
      </div>
    </section>
  );
}

function DraftBlockInspector({ block, sources, addressBook, walletStatus, onChange, onAttachedChange, onAttachedRemove }: { block: DraftWorkflowBlock; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; onChange: (config: AutomationBlock["config"]) => void; onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void; onAttachedRemove: (attachedId: string) => void }) {
  const startSources = sourcesForStart(block.type, sources);
  const httpSources = sources.filter((source) => source.type === "json-api" || source.type === "internal-json-api");
  const outputTargets = sources.filter((source) => source.type === "gpio-output");
  const nativeTokens = nativeMinimaTokens(walletStatus);

  if (block.type.endsWith("_start")) {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected start block</strong>
        <p className="muted">{draftBlockTitle(block)}. To choose a different start block, reset the canvas.</p>
        {block.type === "schedule_start" ? <label>Interval<select value={block.config.intervalSeconds ?? 60} onChange={(event) => onChange({ intervalSeconds: Number(event.target.value) })}>{intervals.map((interval) => <option key={interval} value={interval}>{formatInterval(interval)}</option>)}</select></label> : block.type === "manual_start" ? <p className="muted">Manual workflows run only when you click Run now.</p> : <label>Start source<select value={block.config.sourceId ?? ""} onChange={(event) => onChange({ sourceId: event.target.value })}><option value="">Select source...</option>{startSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>}
      </section>
    );
  }

  if (block.type === "fetch_data_source") {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected block</strong>
        <p className="muted">Fetch JSON from an HTTP device/source.</p>
        <label>HTTP source<select value={block.config.sourceId ?? ""} onChange={(event) => onChange({ sourceId: event.target.value })}><option value="">Select HTTP source...</option>{httpSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </section>
    );
  }

  if (block.type === "if_payload_field_equals") {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected block</strong>
        <label>Condition source<select value={block.config.source ?? "trigger"} onChange={(event) => onChange({ ...block.config, source: event.target.value as "trigger" | "data" })}><option value="trigger">Trigger event</option><option value="data">Latest data</option></select></label>
        <label>Field path<input value={block.config.fieldPath ?? "active"} onChange={(event) => onChange({ ...block.config, fieldPath: event.target.value })} /></label>
        <label>Operator<select value={block.config.operator ?? "equals"} onChange={(event) => onChange({ ...block.config, operator: event.target.value as ConditionOperator })}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {!operatorHasNoValue(block.config.operator ?? "equals") && <label>Compare value<input value={compareValueInputText(block.config.value ?? true)} onChange={(event) => onChange({ ...block.config, value: parseCompareValueInput(event.target.value) })} /></label>}
      </section>
    );
  }

  if (block.type === "wait") {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected block</strong>
        <label>Wait duration ms<input value={String(block.config.durationMs ?? 1000)} inputMode="numeric" onChange={(event) => onChange({ durationMs: Number(event.target.value) })} /></label>
      </section>
    );
  }

  if (block.type === "control_output") {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected block</strong>
        <label>Output target<select value={block.config.targetId ?? ""} onChange={(event) => onChange({ targetId: event.target.value, action: "pulse", durationMs: block.config.durationMs ?? 500 })}><option value="">Select GPIO output...</option>{outputTargets.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
        <label>Pulse duration ms<input value={String(block.config.durationMs ?? 500)} inputMode="numeric" onChange={(event) => onChange({ ...block.config, action: "pulse", durationMs: Number(event.target.value) })} /></label>
        <p className="muted">LED output only. Verify resistor wiring and test pulse before enabling.</p>
      </section>
    );
  }

  if (block.type === "send_transaction") {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected block</strong>
        <label>Recipient<select value={block.config.recipientAddressBookId ?? ""} onChange={(event) => onChange({ ...block.config, recipientAddressBookId: event.target.value, tokenId: "0x00" })}><option value="">Select address book recipient...</option>{addressBook.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <label>Token<select value={block.config.tokenId ?? "0x00"} onChange={() => onChange({ ...block.config, tokenId: "0x00" })}>{nativeTokens.length > 0 ? nativeTokens.map((token) => <option key={token.tokenId} value="0x00">Minima (native) - {token.sendable} sendable</option>) : <option value="0x00">Minima (native)</option>}</select></label>
        <label>Amount<input value={block.config.amount ?? ""} inputMode="decimal" onChange={(event) => onChange({ ...block.config, tokenId: "0x00", amount: event.target.value })} /></label>
        <p className="muted">This spends wallet funds automatically when the workflow runs. Consider creating paused until you are ready to test.</p>
      </section>
    );
  }

  if (isDataBlock(block.type) && block.attachedBlocks?.some((attached) => attached.type === "stamp_integritas")) {
    return (
      <section className="card soft-card automation-form">
        <strong>Selected data block</strong>
        <p className="muted">{draftBlockDescription(block, sources)}</p>
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </section>
    );
  }

  return <section className="card soft-card"><strong>Selected block</strong><p className="muted">{draftBlockDescription(block, sources)}</p></section>;
}

function AttachedStampSettings({ block, onAttachedChange, onAttachedRemove }: { block: DraftWorkflowBlock; onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void; onAttachedRemove: (attachedId: string) => void }) {
  const stamp = block.attachedBlocks?.find((attached) => attached.type === "stamp_integritas");
  if (!stamp) return null;
  const condition = stamp.config.condition;
  const conditionObject = condition && typeof condition === "object" && !Array.isArray(condition) ? condition as NonNullable<AutomationBlock["config"]["condition"]> : null;

  return (
    <div className="card soft-card automation-form">
      <strong>+ Stamp with Integritas attached</strong>
      <label className="check-row"><input type="checkbox" checked={Boolean(conditionObject)} onChange={(event) => onAttachedChange(stamp.id, { condition: event.target.checked ? { source: "data", fieldPath: "active", operator: "equals", value: true } : null })} /> Only stamp when this block's data matches</label>
      {conditionObject && <>
        <p className="muted">The condition checks the data produced by the Record/Fetch block this stamp is attached to.</p>
        <label>This block's data field path<input value={conditionObject.fieldPath ?? "active"} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", fieldPath: event.target.value } })} /></label>
        <label>Operator<select value={conditionObject.operator ?? "equals"} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", operator: event.target.value as ConditionOperator } })}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {!operatorHasNoValue(conditionObject.operator ?? "equals") && <label>Compare value<input value={compareValueInputText(conditionObject.value ?? true)} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", value: parseCompareValueInput(event.target.value) } })} /></label>}
      </>}
      <button type="button" onClick={() => onAttachedRemove(stamp.id)}>Remove attached stamp</button>
    </div>
  );
}

function flattenDraftBlocks(blocks: DraftWorkflowBlock[]) {
  return blocks.flatMap((block) => [
    { type: block.type, config: block.config, clientId: block.id },
    ...(block.attachedBlocks ?? []).map((attached) => ({ type: attached.type, config: attached.config, clientId: attached.id, parentBlockId: block.id }))
  ]);
}

function createDraftBlock(type: AutomationBlockType, sources: DataSource[], pollingIntervalSeconds = 60): DraftWorkflowBlock {
  return { id: `${type}-${crypto.randomUUID()}`, type, config: defaultDraftConfig(type, sources, pollingIntervalSeconds) };
}

function defaultDraftConfig(type: AutomationBlockType, sources: DataSource[], pollingIntervalSeconds = 60): AutomationBlock["config"] {
  if (type === "schedule_start") return { intervalSeconds: pollingIntervalSeconds };
  if (type === "manual_start") return {};
  if (type === "fetch_data_source") return { sourceId: firstHttpSource(sources)?.id ?? "" };
  if (type === "gpio_event_start" || type === "webhook_event_start" || type === "mqtt_event_start") return { sourceId: defaultSourceForStart(type, sources)?.id ?? "" };
  if (type === "if_payload_field_equals") return { source: "trigger", fieldPath: "active", operator: "equals", value: true };
  if (type === "wait") return { durationMs: 1000 };
  if (type === "control_output") return { targetId: sources.find((source) => source.type === "gpio-output")?.id ?? "", action: "pulse", durationMs: 500 };
  if (type === "send_transaction") return { recipientAddressBookId: "", tokenId: "0x00", amount: "" };
  if (type === "stamp_integritas") return { condition: null };
  return {};
}

function WorkflowWorkspace({ workflow, runs, validation, source, sources, addressBook, walletStatus, busy, onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlocks, onRunNow, onRunWithPayload, onToggleEnabled, onToggleArchived, onDelete }: { workflow: AutomationWorkflow; runs: AutomationRun[]; validation: AutomationValidationResult | null; source: DataSource | undefined; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; onAddBlock: (input: Parameters<typeof addAutomationBlock>[1]) => void; onDeleteBlock: (blockId: string) => void; onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onReorderBlocks: (blockIds: string[]) => void; onRunNow: () => void; onRunWithPayload: (payload: unknown) => void; onToggleEnabled: () => void; onToggleArchived: () => void; onDelete: () => void }) {
  const [fetchSourceId, setFetchSourceId] = useState(() => sources.find((item) => item.type === "json-api" || item.type === "internal-json-api")?.id ?? "");
  const [outputTargetId, setOutputTargetId] = useState(() => sources.find((item) => item.type === "gpio-output")?.id ?? "");
  const [outputPulseMs, setOutputPulseMs] = useState("500");
  const [transactionRecipientId, setTransactionRecipientId] = useState(() => addressBook[0]?.id ?? "");
  const [transactionTokenId, setTransactionTokenId] = useState<string>("0x00");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [waitMs, setWaitMs] = useState("1000");
  const [conditionSource, setConditionSource] = useState<"trigger" | "data">("trigger");
  const [conditionFieldPath, setConditionFieldPath] = useState("active");
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>("equals");
  const [conditionValue, setConditionValue] = useState("true");
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [expandedAddBlock, setExpandedAddBlock] = useState<"record" | "fetch" | "condition" | "wait" | "output" | "transaction" | null>(null);
  const [payloadModalOpen, setPayloadModalOpen] = useState(false);
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(examplePayload(workflow), null, 2));
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const [selectedBlockId, setSelectedBlockId] = useState(startBlock?.id ?? "");
  const selectedBlock = mainBlocks.find((block) => block.id === selectedBlockId) ?? startBlock;
  const canAddRecordTriggerEvent = Boolean(startBlock && (startBlock.type === "gpio_event_start" || startBlock.type === "webhook_event_start" || startBlock.type === "mqtt_event_start") && !mainBlocks.some((block) => block.type === "record_trigger_event"));
  const fetchSources = sources.filter((item) => item.type === "json-api" || item.type === "internal-json-api");
  const outputTargets = sources.filter((item) => item.type === "gpio-output");
  const nativeTokens = nativeMinimaTokens(walletStatus);
  const hasValidationErrors = Boolean(validation && validation.errors.length > 0);

  useEffect(() => {
    if (startBlock && !mainBlocks.some((block) => block.id === selectedBlockId)) setSelectedBlockId(startBlock.id);
  }, [mainBlocks, selectedBlockId, startBlock]);

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
              <button type="button" disabled={busy || hasValidationErrors} onClick={() => {
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
          <p className="muted">Changes are saved per block. Edit fields, then click that block's save button; add/remove/move/pause/enable actions apply immediately.</p>
        </div>
        <span className={`pill ${workflow.archived ? "pill-neutral" : workflow.lastError ? "pill-warn" : workflow.enabled ? "pill-good" : "pill-neutral"}`}>{workflow.archived ? "Archived" : workflow.lastError ? "Error" : workflow.enabled ? "Enabled" : "Paused"}</span>
      </div>

      {workflow.archived && <p className="muted">Archived workflows do not run automatically or manually until restored.</p>}
      {workflow.lastError && <p className="error-text">{workflow.lastError}</p>}

      <WorkflowValidationPanel validation={validation} />

      <div className="metric-grid">
        <div><span className="muted">Blocks</span><strong>{workflow.blocks.length}</strong></div>
        <div><span className="muted">Last run</span><strong>{workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</strong></div>
        <div><span className="muted">Next</span><strong>{workflow.nextRunAt ? formatLocalTime(workflow.nextRunAt) : workflow.pollingIntervalSeconds > 0 ? "Paused" : "On incoming data"}</strong></div>
      </div>

      <div className="workflow-create-grid">
        <aside className="workflow-block-library">
          <strong>Block library</strong>
          <p className="muted">Add blocks to this workflow. Actions apply immediately; select a block on the canvas to edit its settings.</p>
          {canAddRecordTriggerEvent && (
            <AddBlockCard id="record" title="Record trigger event" description="Store the event that started this workflow as data, making it hashable and stampable." expanded={expandedAddBlock === "record"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "record" ? null : "record")}>
              <div className="row-actions">
                <button type="button" disabled={busy} onClick={() => onAddBlock({ type: "record_trigger_event", config: {} })}>Add record trigger block</button>
              </div>
            </AddBlockCard>
          )}
          <AddBlockCard id="fetch" title="Fetch data source" description="Fetch JSON from an HTTP device/source and make it the latest workflow data." expanded={expandedAddBlock === "fetch"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "fetch" ? null : "fetch")}>
            <div className="automation-form">
              <label>Source<select value={fetchSourceId} onChange={(event) => setFetchSourceId(event.target.value)}>{fetchSources.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
              <div className="row-actions">
                <button type="button" disabled={busy || !fetchSourceId} onClick={() => onAddBlock({ type: "fetch_data_source", config: { sourceId: fetchSourceId } })}>Add fetch block</button>
              </div>
            </div>
          </AddBlockCard>
          <AddBlockCard id="condition" title="If field matches" description="Continue only when a trigger or data field matches the operator you choose." expanded={expandedAddBlock === "condition"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "condition" ? null : "condition")}>
            <div className="automation-form">
              <label>Condition source<select value={conditionSource} onChange={(event) => setConditionSource(event.target.value as "trigger" | "data")}><option value="trigger">Trigger event</option><option value="data">Latest data</option></select></label>
              <label>{conditionSource === "trigger" ? "Trigger field path" : "Data field path"}<input value={conditionFieldPath} onChange={(event) => setConditionFieldPath(event.target.value)} placeholder="active" /></label>
              <label>Operator<select value={conditionOperator} onChange={(event) => setConditionOperator(event.target.value as ConditionOperator)}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {!operatorHasNoValue(conditionOperator) && <label>Compare value JSON<input value={conditionValue} onChange={(event) => {
                setConditionValue(event.target.value);
                setConditionError(null);
              }} placeholder="true" /></label>}
              {conditionError && <p className="error-text">{conditionError}</p>}
              <div className="row-actions">
                <button type="button" disabled={busy || !conditionFieldPath.trim()} onClick={() => {
                  try {
                    onAddBlock({ type: "if_payload_field_equals", config: conditionConfig(conditionSource, conditionFieldPath, conditionOperator, conditionValue) });
                  } catch (error) {
                    setConditionError(error instanceof Error ? error.message : "Compare value must be valid JSON");
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
          <AddBlockCard id="transaction" title="Send transaction" description="Send native MINIMA to a saved address book recipient from this workflow." expanded={expandedAddBlock === "transaction"} onToggle={() => setExpandedAddBlock(expandedAddBlock === "transaction" ? null : "transaction")}>
            <div className="automation-form">
              <label>Recipient<select value={transactionRecipientId} onChange={(event) => setTransactionRecipientId(event.target.value)}><option value="">Select address book recipient...</option>{addressBook.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
              <label>Token<select value={transactionTokenId} onChange={(event) => setTransactionTokenId(event.target.value)}>{nativeTokens.length > 0 ? nativeTokens.map((token) => <option key={token.tokenId} value="0x00">Minima (native) - {token.sendable} sendable</option>) : <option value="0x00">Minima (native)</option>}</select></label>
              <label>Amount<input value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} inputMode="decimal" placeholder="0.00" /></label>
              <p className="muted">Transactions spend wallet funds automatically when this workflow runs. V1 supports only native MINIMA tokenid <code>0x00</code>.</p>
              <div className="row-actions">
                <button type="button" disabled={busy || !transactionRecipientId || transactionTokenId !== "0x00" || !isPositiveDecimal(transactionAmount)} onClick={() => onAddBlock({ type: "send_transaction", config: { recipientAddressBookId: transactionRecipientId, tokenId: "0x00", amount: transactionAmount.trim() } })}>Add send transaction block</button>
              </div>
            </div>
          </AddBlockCard>
        </aside>

        <WorkflowSavedCanvas blocks={workflow.blocks} sources={sources} workflowEnabled={workflow.enabled} workflowArchived={workflow.archived} selectedBlockId={selectedBlock?.id ?? ""} onSelectBlock={setSelectedBlockId} onMoveBlock={(blockId, direction) => {
          const index = mainBlocks.findIndex((block) => block.id === blockId);
          if (index > 0) onReorderBlocks(moveBlock(mainBlocks, index, index + direction));
        }} onRemoveBlock={(blockId) => {
          const block = mainBlocks.find((item) => item.id === blockId);
          if (block && !block.type.endsWith("_start")) onDeleteBlock(block.id);
        }} />

        <aside className="workflow-create-inspector">
          {selectedBlock ? <BlockCard
            key={selectedBlock.id}
            block={selectedBlock}
            attachedBlocks={workflow.blocks.filter((item) => item.parentBlockId === selectedBlock.id)}
            sources={sources}
            addressBook={addressBook}
            nativeTokens={nativeTokens}
            busy={busy}
            canMoveUp={mainBlocks.findIndex((block) => block.id === selectedBlock.id) > 1}
            canMoveDown={mainBlocks.findIndex((block) => block.id === selectedBlock.id) > 0 && mainBlocks.findIndex((block) => block.id === selectedBlock.id) < mainBlocks.length - 1}
            onMoveUp={() => {
              const index = mainBlocks.findIndex((block) => block.id === selectedBlock.id);
              onReorderBlocks(moveBlock(mainBlocks, index, index - 1));
            }}
            onMoveDown={() => {
              const index = mainBlocks.findIndex((block) => block.id === selectedBlock.id);
              onReorderBlocks(moveBlock(mainBlocks, index, index + 1));
            }}
            onAttachStamp={() => onAddBlock({ type: "stamp_integritas", config: {}, parentBlockId: selectedBlock.id })}
            onUpdate={(input) => onUpdateBlock(selectedBlock.id, input)}
            onUpdateAttached={(blockId, input) => onUpdateBlock(blockId, input)}
            onDelete={() => selectedBlock.type.endsWith("_start") ? undefined : onDeleteBlock(selectedBlock.id)}
            onDeleteAttached={onDeleteBlock}
          /> : <section className="card soft-card"><strong>No block selected</strong><p className="muted">Select a block on the canvas to edit it.</p></section>}
        </aside>
      </div>

      <div className="status-row">
        <div>
          <strong>Improve this workflow</strong>
          <p className="muted">Run the workflow manually, pause it, or delete it. Add Integritas stamps from record/fetch blocks.</p>
        </div>
        <div className="row-actions">
          <button type="button" disabled={busy || hasValidationErrors || workflow.archived} onClick={onRunNow}>Run now</button>
          <button type="button" disabled={busy || hasValidationErrors || workflow.archived} onClick={() => {
            setPayloadText(JSON.stringify(examplePayload(workflow), null, 2));
            setPayloadError(null);
            setPayloadModalOpen(true);
          }}>Run with payload</button>
          <button type="button" disabled={busy || workflow.archived} onClick={onToggleEnabled}>{workflow.enabled ? "Pause now" : "Enable now"}</button>
          <button type="button" disabled={busy} onClick={onToggleArchived}>{workflow.archived ? "Restore workflow" : "Archive workflow"}</button>
          <button type="button" disabled={busy} onClick={onDelete}>Delete workflow now</button>
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
          <span aria-hidden="true">{expanded ? "Collapse" : "Expand"}</span>
        </div>
      </button>
      {expanded && <div>{children}</div>}
    </section>
  );
}

function WorkflowValidationPanel({ validation }: { validation: AutomationValidationResult | null }) {
  if (!validation) return <section className="card soft-card"><p className="muted">Checking workflow validation...</p></section>;
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return <section className="card soft-card"><span className="pill pill-good">Workflow validation passed</span></section>;
  }

  return (
    <section className="card soft-card">
      <div className="status-row">
        <div>
          <strong>Workflow validation</strong>
          <p className="muted">Fix errors before running. Warnings are allowed, but should be reviewed before enabling hardware or wallet actions.</p>
        </div>
        <span className={`pill ${validation.errors.length > 0 ? "pill-warn" : "pill-neutral"}`}>{validation.errors.length} error(s), {validation.warnings.length} warning(s)</span>
      </div>
      {validation.errors.map((issue) => <ValidationIssueRow key={`${issue.code}-${issue.blockId ?? "workflow"}`} issue={issue} />)}
      {validation.warnings.map((issue) => <ValidationIssueRow key={`${issue.code}-${issue.blockId ?? "workflow"}`} issue={issue} />)}
    </section>
  );
}

function workflowMatchesFilter(workflow: AutomationWorkflow, search: string, filter: "active" | "all" | "enabled" | "paused" | "error" | "archived", sourceName: string) {
  if (filter === "active" && workflow.archived) return false;
  if (filter === "enabled" && (!workflow.enabled || workflow.archived)) return false;
  if (filter === "paused" && (workflow.enabled || workflow.archived)) return false;
  if (filter === "error" && !workflow.lastError) return false;
  if (filter === "archived" && !workflow.archived) return false;

  const query = search.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    workflow.name,
    workflow.dataSourceId,
    sourceName,
    workflow.lastHash ?? "",
    workflow.lastProofId ?? "",
    workflow.lastError ?? "",
    workflow.blocks.map((block) => `${block.type} ${block.config.sourceId ?? ""} ${block.config.targetId ?? ""}`).join(" ")
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function ValidationIssueRow({ issue }: { issue: AutomationValidationResult["errors"][number] }) {
  return (
    <p className={issue.level === "error" ? "error-text" : "muted"}>
      <span className={`pill ${issue.level === "error" ? "pill-warn" : "pill-neutral"}`}>{issue.level}</span> {issue.message}{issue.blockType ? ` (${issue.blockType})` : ""}
    </p>
  );
}

function BlockCard({ block, attachedBlocks, sources, addressBook, nativeTokens, busy, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onAttachStamp, onUpdate, onUpdateAttached, onDelete, onDeleteAttached }: { block: AutomationBlock; attachedBlocks: AutomationBlock[]; sources: DataSource[]; addressBook: AddressBookEntry[]; nativeTokens: TokenBalance[]; busy: boolean; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onAttachStamp: () => void; onUpdate: (input: Parameters<typeof updateAutomationBlock>[2]) => void; onUpdateAttached: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onDelete: () => void; onDeleteAttached: (blockId: string) => void }) {
  const [fetchSourceId, setFetchSourceId] = useState(block.config.sourceId ?? "");
  const [outputTargetId, setOutputTargetId] = useState(block.config.targetId ?? "");
  const [outputDurationMs, setOutputDurationMs] = useState(String(block.config.durationMs ?? 500));
  const [transactionRecipientId, setTransactionRecipientId] = useState(block.config.recipientAddressBookId ?? "");
  const [transactionTokenId, setTransactionTokenId] = useState<string>(block.config.tokenId ?? "0x00");
  const [transactionAmount, setTransactionAmount] = useState(block.config.amount ?? "");
  const [durationMs, setDurationMs] = useState(String(block.config.durationMs ?? 1000));
  const [conditionSource, setConditionSource] = useState<"trigger" | "data">(block.config.source ?? "trigger");
  const [conditionFieldPath, setConditionFieldPath] = useState(block.config.fieldPath ?? "active");
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>(block.config.operator ?? "equals");
  const [conditionValue, setConditionValue] = useState(JSON.stringify(block.config.value ?? true));
  const [conditionError, setConditionError] = useState<string | null>(null);
  const removable = !block.type.endsWith("_start");
  const canAttachStamp = block.type === "record_trigger_event" || block.type === "fetch_data_source";
  const stampBlock = attachedBlocks.find((item) => item.type === "stamp_integritas");
  const [stampConditionSource, setStampConditionSource] = useState<"trigger" | "data">(stampBlock?.config.condition?.source ?? "data");
  const [stampConditionFieldPath, setStampConditionFieldPath] = useState(stampBlock?.config.condition?.fieldPath ?? "sensor.temperature");
  const [stampConditionOperator, setStampConditionOperator] = useState<ConditionOperator>(stampBlock?.config.condition?.operator ?? "equals");
  const [stampConditionValue, setStampConditionValue] = useState(JSON.stringify(stampBlock?.config.condition?.value ?? 15));
  const [stampConditionError, setStampConditionError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const fetchSources = sources.filter((item) => item.type === "json-api" || item.type === "internal-json-api");
  const outputTargets = sources.filter((item) => item.type === "gpio-output");
  const fetchDirty = fetchSourceId !== (block.config.sourceId ?? "");
  const waitDirty = Number(durationMs) !== block.config.durationMs;
  const conditionDirty = conditionSource !== (block.config.source ?? "trigger") || conditionFieldPath !== (block.config.fieldPath ?? "active") || conditionOperator !== (block.config.operator ?? "equals") || (!operatorHasNoValue(conditionOperator) && conditionValue !== JSON.stringify(block.config.value ?? true));
  const outputDirty = outputTargetId !== (block.config.targetId ?? "") || Number(outputDurationMs) !== block.config.durationMs;
  const transactionDirty = transactionRecipientId !== (block.config.recipientAddressBookId ?? "") || transactionTokenId !== (block.config.tokenId ?? "0x00") || transactionAmount !== (block.config.amount ?? "");
  const stampConditionDirty = Boolean(stampBlock) && (stampConditionSource !== (stampBlock?.config.condition?.source ?? "data") || stampConditionFieldPath !== (stampBlock?.config.condition?.fieldPath ?? "sensor.temperature") || stampConditionOperator !== (stampBlock?.config.condition?.operator ?? "equals") || (!operatorHasNoValue(stampConditionOperator) && stampConditionValue !== JSON.stringify(stampBlock?.config.condition?.value ?? 15)));

  function saveBlock(input: Parameters<typeof updateAutomationBlock>[2], message: string) {
    setSaveNotice(message);
    onUpdate(input);
  }

  function saveAttachedBlock(blockId: string, input: Parameters<typeof updateAutomationBlock>[2], message: string) {
    setSaveNotice(message);
    onUpdateAttached(blockId, input);
  }

  return (
    <div className="card">
      <div className="status-row">
        <div><strong>{block.order}. {blockLabel(block)}</strong><p className="muted">{blockDescription(block, sources, addressBook)}</p></div>
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
          <SaveState dirty={fetchDirty} saved={saveNotice === "Fetch source saved"} />
          <button type="button" disabled={busy || !fetchSourceId || !fetchDirty} onClick={() => saveBlock({ config: { sourceId: fetchSourceId } }, "Fetch source saved")}>Save fetch source</button>
        </div>
      )}
      {block.type === "wait" && (
        <div className="automation-form">
          <label>Wait duration ms<input value={durationMs} onChange={(event) => setDurationMs(event.target.value)} inputMode="numeric" /></label>
          <SaveState dirty={waitDirty} saved={saveNotice === "Wait duration saved"} />
          <button type="button" disabled={busy || !Number.isFinite(Number(durationMs)) || !waitDirty} onClick={() => saveBlock({ config: { durationMs: Number(durationMs) } }, "Wait duration saved")}>Save wait duration</button>
        </div>
      )}
      {block.type === "if_payload_field_equals" && (
        <div className="automation-form">
          <label>Condition source<select value={conditionSource} onChange={(event) => setConditionSource(event.target.value as "trigger" | "data")}><option value="trigger">Trigger event</option><option value="data">Latest data</option></select></label>
          <label>{conditionSource === "trigger" ? "Trigger field path" : "Data field path"}<input value={conditionFieldPath} onChange={(event) => setConditionFieldPath(event.target.value)} placeholder="active" /></label>
          <label>Operator<select value={conditionOperator} onChange={(event) => setConditionOperator(event.target.value as ConditionOperator)}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {!operatorHasNoValue(conditionOperator) && <label>Compare value JSON<input value={conditionValue} onChange={(event) => {
            setConditionValue(event.target.value);
            setConditionError(null);
          }} placeholder="true" /></label>}
          {conditionError && <p className="error-text">{conditionError}</p>}
          <SaveState dirty={conditionDirty} saved={saveNotice === "Condition saved"} />
          <button type="button" disabled={busy || !conditionFieldPath.trim() || !conditionDirty} onClick={() => {
            try {
              saveBlock({ config: conditionConfig(conditionSource, conditionFieldPath, conditionOperator, conditionValue) }, "Condition saved");
            } catch (error) {
              setConditionError(error instanceof Error ? error.message : "Compare value must be valid JSON");
            }
          }}>Save condition</button>
        </div>
      )}
      {block.type === "control_output" && (
        <div className="automation-form">
          <label>Output target<select value={outputTargetId} onChange={(event) => setOutputTargetId(event.target.value)}>{outputTargets.map((item) => <option key={item.id} value={item.id}>{item.name} - {sourceLabel(item)}</option>)}</select></label>
          <label>Pulse duration ms<input value={outputDurationMs} onChange={(event) => setOutputDurationMs(event.target.value)} inputMode="numeric" /></label>
          <SaveState dirty={outputDirty} saved={saveNotice === "Output pulse saved"} />
          <button type="button" disabled={busy || !outputTargetId || !Number.isFinite(Number(outputDurationMs)) || !outputDirty} onClick={() => saveBlock({ config: { targetId: outputTargetId, action: "pulse", durationMs: Number(outputDurationMs) } }, "Output pulse saved")}>Save output pulse</button>
        </div>
      )}
      {block.type === "send_transaction" && (
        <div className="automation-form">
          <label>Recipient<select value={transactionRecipientId} onChange={(event) => setTransactionRecipientId(event.target.value)}><option value="">Select address book recipient...</option>{addressBook.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
          <label>Token<select value={transactionTokenId} onChange={(event) => setTransactionTokenId(event.target.value)}>{nativeTokens.length > 0 ? nativeTokens.map((token) => <option key={token.tokenId} value="0x00">Minima (native) - {token.sendable} sendable</option>) : <option value="0x00">Minima (native)</option>}</select></label>
          <label>Amount<input value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} inputMode="decimal" /></label>
          <SaveState dirty={transactionDirty} saved={saveNotice === "Transaction saved"} />
          <button type="button" disabled={busy || !transactionRecipientId || transactionTokenId !== "0x00" || !isPositiveDecimal(transactionAmount) || !transactionDirty} onClick={() => saveBlock({ config: { recipientAddressBookId: transactionRecipientId, tokenId: "0x00", amount: transactionAmount.trim() } }, "Transaction saved")}>Save transaction</button>
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
            <label>Operator<select value={stampConditionOperator} onChange={(event) => setStampConditionOperator(event.target.value as ConditionOperator)}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {!operatorHasNoValue(stampConditionOperator) && <label>Compare value JSON<input value={stampConditionValue} onChange={(event) => {
              setStampConditionValue(event.target.value);
              setStampConditionError(null);
            }} placeholder="15" /></label>}
            {stampConditionError && <p className="error-text">{stampConditionError}</p>}
            <SaveState dirty={stampConditionDirty} saved={saveNotice === "Stamp condition saved"} />
            <div className="row-actions">
              <button type="button" disabled={busy || !stampConditionFieldPath.trim() || !stampConditionDirty} onClick={() => {
                try {
                  saveAttachedBlock(stampBlock.id, { config: { condition: conditionConfig(stampConditionSource, stampConditionFieldPath, stampConditionOperator, stampConditionValue) } }, "Stamp condition saved");
                } catch (error) {
                  setStampConditionError(error instanceof Error ? error.message : "Compare value must be valid JSON");
                }
              }}>Save stamp condition</button>
              <button type="button" disabled={busy || !stampBlock.config.condition} onClick={() => saveAttachedBlock(stampBlock.id, { config: { condition: null } }, "Stamp condition cleared")}>Clear stamp condition now</button>
            </div>
          </div>
          <div className="row-actions">
            <button type="button" disabled={busy} onClick={() => onUpdateAttached(stampBlock.id, { enabled: !stampBlock.enabled })}>{stampBlock.enabled ? "Disable stamp now" : "Enable stamp now"}</button>
            <button type="button" disabled={busy} onClick={() => onDeleteAttached(stampBlock.id)}>Remove stamp now</button>
          </div>
        </div>
      )}
      {removable && <div className="row-actions">
        <button type="button" disabled={busy || !canMoveUp} onClick={onMoveUp}>Move up now</button>
        <button type="button" disabled={busy || !canMoveDown} onClick={onMoveDown}>Move down now</button>
        {canAttachStamp && !stampBlock && <button type="button" disabled={busy} onClick={onAttachStamp}>Attach Integritas now</button>}
        <button type="button" disabled={busy} onClick={() => onUpdate({ enabled: !block.enabled })}>{block.enabled ? "Disable now" : "Enable now"}</button>
        <button type="button" disabled={busy} onClick={onDelete}>Remove block now</button>
      </div>}
    </div>
  );
}

function SaveState({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty) return <p className="muted"><span className="pill pill-warn">Unsaved changes</span> Use this block's save button to apply edits.</p>;
  if (saved) return <p className="muted"><span className="pill pill-good">Saved</span></p>;
  return <p className="muted"><span className="pill pill-neutral">No unsaved changes</span></p>;
}

function stampConditionSummary(block: AutomationBlock) {
  const condition = block.config.condition;
  if (!condition) return "Always stamp";
  return conditionSummary(condition.source ?? "data", condition.fieldPath, condition.operator, condition.value);
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
  if (block.type === "if_payload_field_equals") return `If ${conditionSourceLabel(block.config.source ?? "trigger")} field matches`;
  if (block.type === "wait") return "Wait";
  if (block.type === "stamp_integritas") return "Stamp with Integritas";
  if (block.type === "control_output") return "Control output";
  if (block.type === "send_transaction") return "Send transaction";
  return block.type;
}

function blockShortLabel(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Start";
  if (block.type === "record_trigger_event") return "Record event";
  if (block.type === "fetch_data_source") return "Fetch source";
  if (block.type === "if_payload_field_equals") return "If payload matches";
  if (block.type === "stamp_integritas") return "Stamp";
  if (block.type === "control_output") return "Control output";
  if (block.type === "send_transaction") return "Send transaction";
  if (block.type === "wait") return "Wait";
  return block.type;
}

function blockDescription(block: AutomationBlock, sources: DataSource[], addressBook: AddressBookEntry[]) {
  const source = block.config.sourceId || block.config.targetId ? sources.find((item) => item.id === (block.config.sourceId ?? block.config.targetId)) : undefined;
  const recipient = block.config.recipientAddressBookId ? addressBook.find((entry) => entry.id === block.config.recipientAddressBookId) : undefined;
  if (block.type === "schedule_start") return `Every ${formatInterval(Number(block.config.intervalSeconds ?? 0)).replace("Every ", "")}`;
  if (block.type === "gpio_event_start") return source ? `${source.name} - GPIO${source.config.pin ?? "?"}` : "GPIO input event";
  if (block.type === "webhook_event_start") return source ? `${source.name} webhook payload` : "Webhook payload";
  if (block.type === "mqtt_event_start") return source ? `${source.name} MQTT message` : "MQTT message";
  if (block.type === "record_trigger_event") return "Store the incoming trigger payload as a data read";
  if (block.type === "fetch_data_source") return source ? `Fetch ${source.name}` : "Fetch configured HTTP JSON source";
  if (block.type === "if_payload_field_equals") return `Continue only if ${conditionSummary(block.config.source ?? "trigger", block.config.fieldPath ?? "field", block.config.operator, block.config.value)}`;
  if (block.type === "wait") return `Pause for ${block.config.durationMs ?? 0} ms`;
  if (block.type === "stamp_integritas") return "Stamp the latest collected hash";
  if (block.type === "control_output") return source ? `Pulse ${source.name} for ${block.config.durationMs ?? 0} ms` : "Pulse configured output target";
  if (block.type === "send_transaction") return recipient ? `Send ${block.config.amount ?? "?"} MINIMA to ${recipient.label}` : "Send native MINIMA to an address book recipient";
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
  if (block.type === "send_transaction") return "Transaction result";
  return "Context";
}

function conditionSourceLabel(source: "trigger" | "data") {
  return source === "data" ? "data" : "trigger";
}

const conditionOperatorOptions: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "greater_than", label: "is greater than" },
  { value: "greater_than_or_equals", label: "is greater than or equal to" },
  { value: "less_than", label: "is less than" },
  { value: "less_than_or_equals", label: "is less than or equal to" },
  { value: "exists", label: "exists" },
  { value: "does_not_exist", label: "does not exist" }
];

function operatorHasNoValue(operator: ConditionOperator) {
  return operator === "exists" || operator === "does_not_exist";
}

function compareValueInputText(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function parseCompareValueInput(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function conditionConfig(source: "trigger" | "data", fieldPath: string, operator: ConditionOperator, valueText: string) {
  return {
    source,
    fieldPath: fieldPath.trim(),
    operator,
    ...(operatorHasNoValue(operator) ? {} : { value: JSON.parse(valueText) as unknown })
  };
}

function conditionSummary(source: "trigger" | "data", fieldPath: string, operator?: ConditionOperator, value?: unknown) {
  const label = conditionOperatorOptions.find((option) => option.value === operator)?.label ?? "matches";
  return operatorHasNoValue(operator ?? "exists") ? `${conditionSourceLabel(source)} ${fieldPath} ${label}` : `${conditionSourceLabel(source)} ${fieldPath} ${label} ${JSON.stringify(value)}`;
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

function nativeMinimaTokens(walletStatus: WalletStatus | null) {
  return (walletStatus?.tokens ?? []).filter((token) => token.isNative || token.tokenId.toLowerCase() === "0x00");
}

function isPositiveDecimal(value: string) {
  const trimmed = value.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) && Number(trimmed) > 0;
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
