import { useEffect, useState, type ReactNode } from "react";
import { Archive, Copy, Eye, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { DataTable, RowActions, TableIconButton, TableWrap, tableCellClass, tableHeaderCellClass, tableHeadRowClass, tableRowClass } from "../components/DataTable";
import { JsonPreview } from "../components/JsonPreview";
import { Page } from "../components/Page";
import { ProgressModal } from "../components/ProgressModal";
import { addAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationWorkflow, duplicateAutomationWorkflow, getAutomationWorkflowValidation, listAutomationWorkflowRuns, listAutomationWorkflows, reorderAutomationBlocks, runAutomationWorkflow, updateAutomationBlock, updateAutomationWorkflow, validateAutomationDraft } from "../features/automation/automationApi";
import { automationBlockToCanvasBlock, draftBlockDescription, draftBlockTitle, isDataBlock, WorkflowBlockLibrary, WorkflowCanvas, WorkflowWorkspaceShell, type DraftWorkflowBlock, type WorkflowCanvasRuntimeState, type WorkflowCanvasValidationIssue } from "../features/automation/WorkflowCanvas";
import type { AutomationBlock, AutomationBlockType, AutomationRun, AutomationValidationResult, AutomationWorkflow, ConditionOperator } from "../features/automation/automationTypes";
import { listAddressBookEntries } from "../features/address-book/addressBookApi";
import type { AddressBookEntry } from "../features/address-book/addressBookTypes";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import type { DataSource } from "../features/data-sources/dataSourceTypes";
import { getWalletStatus } from "../features/wallet/walletApi";
import type { WalletStatus } from "../features/wallet/walletTypes";
import { cx } from "../lib/cx";
import { formatLocalTime } from "../lib/time";

const intervals = [10, 30, 60, 300, 900, 3600];
const mutedText = "text-sm text-slate-500";
const errorText = "text-sm font-semibold text-red-700";
const cardClass = "rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm";
const softCardClass = "rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm";
const statusRowClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
const formGridClass = "grid gap-3 [&_label]:grid [&_label]:gap-2.5 [&_label]:font-bold [&_label]:text-slate-700";
const inspectorClass = "grid content-start gap-3";

type AutomationPageFlow =
  | { mode: "list" }
  | { mode: "build" }
  | { mode: "edit" | "watch"; workflowId: string; runId?: string };

function automationFlowFromUrl(): AutomationPageFlow {
  const params = new URLSearchParams(window.location.search);
  const flow = params.get("flow");
  const workflowId = params.get("id") ?? "";
  const runId = params.get("run") ?? undefined;
  if (flow === "build") return { mode: "build" };
  if ((flow === "edit" || flow === "watch") && workflowId) return { mode: flow, workflowId, runId };
  return { mode: "list" };
}

export function AutomationPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<"active" | "all" | "enabled" | "paused" | "error" | "archived">("active");
  const [flow, setFlow] = useState(() => automationFlowFromUrl());
  const [workspaceRuns, setWorkspaceRuns] = useState<AutomationRun[]>([]);
  const [workspaceValidation, setWorkspaceValidation] = useState<AutomationValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<AutomationWorkflow | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const onPopState = () => setFlow(automationFlowFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const workflowId = "workflowId" in flow ? flow.workflowId : null;
    if (!workflowId) {
      setWorkspaceRuns([]);
      setWorkspaceValidation(null);
      return;
    }
    refreshWorkspace(workflowId).catch((err: Error) => setError(err.message));
  }, [flow]);

  useEffect(() => {
    if (flow.mode !== "watch") return;
    const selectedRun = workspaceRuns.find((run) => run.id === flow.runId) ?? workspaceRuns[0];
    const shouldPoll = selectedRun?.status === "running" || workspaceRuns[0]?.status === "running";
    if (!shouldPoll) return;

    const interval = window.setInterval(() => {
      refreshWorkspace(flow.workflowId).catch((err: Error) => setError(err.message));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [flow, workspaceRuns]);

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
    const workflowId = "workflowId" in flow ? flow.workflowId : null;
    if (workflowId) {
      await refreshWorkspace(workflowId);
    }
  }

  async function refreshWorkspace(workflowId: string) {
    const [runs, validation] = await Promise.all([listAutomationWorkflowRuns(workflowId, 10), getAutomationWorkflowValidation(workflowId)]);
    setWorkspaceRuns(runs.items);
    setWorkspaceValidation(validation.item);
    return runs.items;
  }

  async function runWorkflowAndSelectLatest(workflowId: string, payload?: unknown) {
    await runAutomationWorkflow(workflowId, payload);
    const runs = await refreshWorkspace(workflowId);
    if (runs[0]) navigateFlow({ mode: "watch", workflowId, runId: runs[0].id });
  }

  function navigateFlow(nextFlow: AutomationPageFlow) {
    const params = new URLSearchParams(window.location.search);
    if (nextFlow.mode === "list") {
      params.delete("flow");
      params.delete("id");
    } else {
      params.set("flow", nextFlow.mode);
      if ("workflowId" in nextFlow) params.set("id", nextFlow.workflowId);
      else params.delete("id");
      if ("runId" in nextFlow && nextFlow.runId) params.set("run", nextFlow.runId);
      else params.delete("run");
    }
    const query = params.toString();
    window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    setFlow(nextFlow);
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

  async function deleteWorkflow(workflow: AutomationWorkflow) {
    setDeletingWorkflow(workflow);
    try {
      await run(() => deleteAutomationWorkflow(workflow.id));
    } finally {
      setDeletingWorkflow(null);
    }
  }

  async function submitWorkflow(blocks: { type: AutomationBlockType; config: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null }[]) {
    setBusy(true);
    setError(null);
    try {
      const response = await createAutomationWorkflow({ name, enabled, blocks });
      setName("");
      await refresh();
      navigateFlow({ mode: "edit", workflowId: response.item.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const sourceById = (id: string) => sources.find((source) => source.id === id);
  const sourceName = (id: string) => sourceById(id)?.name ?? "Unknown source";
  const activeWorkflowId = "workflowId" in flow ? flow.workflowId : null;
  const workspaceWorkflow = activeWorkflowId ? workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null : null;
  const filteredWorkflows = workflows.filter((workflow) => workflowMatchesFilter(workflow, workflowSearch, workflowFilter, sourceName(workflowPrimarySourceId(workflow))));
  const workspaceMode = flow.mode === "edit" || flow.mode === "watch" ? flow.mode : null;

  return (
    <Page
      eyebrow="Automation"
      title={flow.mode === "build" ? "Create workflow" : workspaceMode === "edit" ? "Edit workflow" : workspaceMode === "watch" ? "Watch workflow" : "Block automation workspace"}
      desc={flow.mode === "build" ? "Assemble a starter workflow from blocks, then create it when the draft validates." : workspaceMode ? "Use the shared workflow canvas without opening a modal." : "Build workflows from small start, data, logic, and Integritas blocks."}
    >
      {flow.mode !== "list" && (
        <section className={cardClass}>
          <div className={statusRowClass}>
            <div><strong>{flow.mode === "build" ? "Builder" : workspaceMode === "watch" ? "Watch canvas" : "Editor canvas"}</strong><p className={mutedText}>This workspace is loaded directly from the Automation page URL.</p></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => navigateFlow({ mode: "list" })}>Back to workflows</Button>
          </div>
        </section>
      )}

      {flow.mode === "list" && (
        <section className={cardClass}>
          <div className={statusRowClass}>
            <div><strong>Workflow builder</strong><p className={mutedText}>Create a workflow from a start block, then connect action blocks in the workspace.</p></div>
            <Button type="button" size="sm" onClick={() => navigateFlow({ mode: "build" })}>Create new workflow</Button>
          </div>
        </section>
      )}

      {flow.mode === "build" && (
        <CreateWorkflowWorkspace
          name={name}
          enabled={enabled}
          sources={sources}
          addressBook={addressBook}
          walletStatus={walletStatus}
          busy={busy}
          onNameChange={setName}
          onEnabledChange={setEnabled}
          onCancel={() => navigateFlow({ mode: "list" })}
          onCreate={submitWorkflow}
        />
      )}

      {workspaceMode && workspaceWorkflow && (
        <WorkflowWorkspace
          workflow={workspaceWorkflow}
          runs={workspaceRuns}
          validation={workspaceValidation}
          source={sourceById(workflowPrimarySourceId(workspaceWorkflow))}
          sources={sources}
          addressBook={addressBook}
          walletStatus={walletStatus}
          busy={busy}
          mode={workspaceMode}
          initialRunId={flow.mode === "watch" ? flow.runId : undefined}
          onNavigateMode={(nextMode) => navigateFlow({ mode: nextMode, workflowId: workspaceWorkflow.id })}
          onSelectWatchRun={(runId) => navigateFlow({ mode: "watch", workflowId: workspaceWorkflow.id, runId })}
          onAddBlock={(input) => run(() => addAutomationBlock(workspaceWorkflow.id, input))}
          onDeleteBlock={(blockId) => run(() => deleteAutomationBlock(workspaceWorkflow.id, blockId))}
          onUpdateBlock={(blockId, input) => run(() => updateAutomationBlock(workspaceWorkflow.id, blockId, input))}
          onUpdateWorkflow={(input) => run(() => updateAutomationWorkflow(workspaceWorkflow.id, input))}
          onReorderBlocks={(blockIds) => run(() => reorderAutomationBlocks(workspaceWorkflow.id, blockIds))}
          onRunNow={() => run(() => runWorkflowAndSelectLatest(workspaceWorkflow.id))}
          onRunWithPayload={(payload) => run(() => runWorkflowAndSelectLatest(workspaceWorkflow.id, payload))}
        />
      )}

      {workspaceMode && activeWorkflowId && !workspaceWorkflow && <section className={cardClass}><p className={mutedText}>Loading workflow...</p></section>}

      {error && <p className={errorText}>{error}</p>}

      {deletingWorkflow && (
        <ProgressModal
          title="Deleting workflow"
          headline="Deleting in progress"
          message={`Removing ${deletingWorkflow.name}. Large workflow logs can take a few seconds while saved run history is detached from this workflow.`}
        />
      )}

      {flow.mode === "list" && <section className={cx(cardClass, "grid gap-4")}>
        <div className={statusRowClass}>
          <div><strong>Workflows</strong><p className={mutedText}>Search, filter, duplicate, and archive workflows as your test list grows.</p></div>
          <StatusPill status="neutral">{filteredWorkflows.length}/{workflows.length} shown</StatusPill>
        </div>
        <div className={cx(formGridClass, "md:grid-cols-2")}>
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
        <TableWrap>
          <DataTable className="min-w-[920px]">
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={tableHeaderCellClass}>Name</th>
                <th className={tableHeaderCellClass}>Status</th>
                <th className={tableHeaderCellClass}>Trigger / source</th>
                <th className={tableHeaderCellClass}>Blocks</th>
                <th className={tableHeaderCellClass}>Last run</th>
                <th className={tableHeaderCellClass}>Last hash</th>
                <th className={tableHeaderCellClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkflows.map((workflow) => (
                <tr key={workflow.id} className={tableRowClass}>
                  <td className={tableCellClass}><strong>{workflow.name}</strong>{workflow.lastError && <p className={errorText}>{workflow.lastError}</p>}{workflow.archived && <p className={mutedText}>Archived workflows do not run until restored.</p>}</td>
                  <td className={tableCellClass}><WorkflowStatusPill workflow={workflow} /></td>
                  <td className={tableCellClass}>{sourceName(workflowPrimarySourceId(workflow))}<p className={mutedText}>{workflowIntervalSeconds(workflow) > 0 ? formatInterval(workflowIntervalSeconds(workflow)) : "Event driven"}</p></td>
                  <td className={tableCellClass}><span>{workflow.blocks.length}</span><p className={mutedText}>{summarizeBlocks(workflow)}</p></td>
                  <td className={tableCellClass}>{workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : <span className={mutedText}>Never</span>}</td>
                  <td className={tableCellClass}>{workflow.lastHash ? <code>{workflow.lastHash}</code> : <span className={mutedText}>No hash yet</span>}</td>
                  <td className={tableCellClass}>
                    <RowActions>
                      <IconAction disabled={busy} title="Open and edit" label={`Open and edit ${workflow.name}`} onClick={() => navigateFlow({ mode: "edit", workflowId: workflow.id })}><Pencil size={16} /></IconAction>
                      <IconAction disabled={busy} title="Watch workflow" label={`Watch ${workflow.name}`} onClick={() => navigateFlow({ mode: "watch", workflowId: workflow.id })}><Eye size={16} /></IconAction>
                      <IconAction disabled={busy || workflow.archived} title="Run now" label={`Run ${workflow.name} now`} onClick={() => run(() => runAutomationWorkflow(workflow.id))}><Play size={16} /></IconAction>
                      <IconAction disabled={busy || workflow.archived} title={workflow.enabled ? "Pause workflow" : "Enable workflow"} label={`${workflow.enabled ? "Pause" : "Enable"} ${workflow.name}`} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { enabled: !workflow.enabled }))}><RotateCcw size={16} /></IconAction>
                      <IconAction disabled={busy} title="Duplicate workflow" label={`Duplicate ${workflow.name}`} onClick={() => run(() => duplicateAutomationWorkflow(workflow.id))}><Copy size={16} /></IconAction>
                      <IconAction disabled={busy} title={workflow.archived ? "Restore workflow" : "Archive workflow"} label={`${workflow.archived ? "Restore" : "Archive"} ${workflow.name}`} onClick={() => run(() => updateAutomationWorkflow(workflow.id, { archived: !workflow.archived }))}><Archive size={16} /></IconAction>
                      <IconAction danger disabled={busy} title="Delete workflow" label={`Delete workflow ${workflow.name}`} onClick={() => deleteWorkflow(workflow)}><Trash2 size={16} /></IconAction>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
        {workflows.length === 0 && <p className={mutedText}>No automation workflows yet.</p>}
        {workflows.length > 0 && filteredWorkflows.length === 0 && <p className={mutedText}>No workflows match this filter.</p>}
      </section>}
    </Page>
  );
}

function StatusPill({ status, children }: { status: "good" | "warn" | "neutral"; children: ReactNode }) {
  return (
    <span className={cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide", status === "good" ? "bg-emerald-100 text-emerald-700" : status === "warn" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
      {children}
    </span>
  );
}

function WorkflowStatusPill({ workflow }: { workflow: AutomationWorkflow }) {
  const label = workflow.archived ? "Archived" : workflow.lastError ? "Error" : workflow.enabled ? "Enabled" : "Paused";
  const status = workflow.archived ? "neutral" : workflow.lastError ? "warn" : workflow.enabled ? "good" : "neutral";
  return <StatusPill status={status}>{label}</StatusPill>;
}

function IconAction({ children, title, label, disabled, danger, onClick }: { children: ReactNode; title: string; label: string; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <TableIconButton danger={danger} type="button" disabled={disabled} title={title} aria-label={label} onClick={onClick}>
      {children}
    </TableIconButton>
  );
}

function Panel({ children, soft = true, className }: { children: ReactNode; soft?: boolean; className?: string }) {
  return <section className={cx(soft ? softCardClass : cardClass, className)}>{children}</section>;
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
  const draftValidationByBlockId = validationIssuesByBlockId(backendValidation);

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
    <WorkflowWorkspaceShell
      eyebrow="Draft workflow"
      title="Create a new block workflow"
      description="Choose one start block, then add data and logic blocks to build the first draft chain."
      actions={<>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy || draftBlocks.length === 0} onClick={resetCanvas}>Reset canvas</Button>
        <Button type="button" size="sm" disabled={busy || !canCreate} onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}>Create workflow</Button>
      </>}
      left={<WorkflowBlockLibrary hasStartBlock={hasStartBlock} selectedBlock={selectedBlock} onSelectStartBlock={selectStartBlock} onAddBlock={addDraftBlock} onAttachStamp={attachStampBlock} />}
      center={<WorkflowCanvas mode="build" blocks={draftBlocks} sources={sources} statusLabel={enabled ? "Enabled on create" : "Paused on create"} statusGood={enabled} selectedBlockId={selectedBlock?.id ?? ""} validationByBlockId={draftValidationByBlockId} onSelectBlock={setSelectedBlockId} onMoveBlock={moveDraftBlock} onRemoveBlock={removeDraftBlock} />}
      right={
        <aside className={cx(inspectorClass, formGridClass)}>
          <Panel>
            <strong>Workflow setup</strong>
            <label>Workflow name<input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Button fetches weather API" /></label>
            <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center justify-start gap-2.5"><input className="w-auto" type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} /> Enabled after create</label>
            <strong>Validation</strong>
            {localErrors.map((issue) => <p key={issue} className={errorText}>{issue}</p>)}
            {backendErrors.map((issue) => <p key={issue} className={errorText}>{issue}</p>)}
            {backendWarnings.map((issue) => <p key={issue} className={mutedText}>{issue}</p>)}
            {backendValidationError && <p className={errorText}>{backendValidationError}</p>}
            {!backendValidation && !backendValidationError && <p className={mutedText}>Checking draft workflow...</p>}
            {canCreate && <p className={mutedText}>No blocking draft errors. Review any warnings before creating.</p>}
          </Panel>
          <Panel>
            <strong>Selected block</strong>
            {selectedBlock ? <DraftBlockInspector block={selectedBlock} sources={sources} addressBook={addressBook} walletStatus={walletStatus} onChange={(config) => updateBlock(selectedBlock.id, { config })} onAttachedChange={(attachedId, config) => updateAttachedBlock(selectedBlock.id, attachedId, config)} onAttachedRemove={(attachedId) => removeAttachedBlock(selectedBlock.id, attachedId)} /> : <p className={mutedText}>Choose a start block on the left or select a block on the canvas to configure it.</p>}
          </Panel>
          <Button type="button" size="sm" disabled={busy || !canCreate} onClick={() => onCreate(flattenDraftBlocks(draftBlocks))}>Create workflow</Button>
        </aside>
      }
    />
  );
}

function DraftBlockInspector({ block, sources, addressBook, walletStatus, onChange, onAttachedChange, onAttachedRemove }: { block: DraftWorkflowBlock; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; onChange: (config: AutomationBlock["config"]) => void; onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void; onAttachedRemove: (attachedId: string) => void }) {
  const startSources = sourcesForStart(block.type, sources);
  const httpSources = sources.filter((source) => source.type === "json-api" || source.type === "internal-json-api");
  const cameraSources = sources.filter((source) => source.type === "pi-camera");
  const outputTargets = sources.filter((source) => isOutputTarget(source));
  const nativeTokens = nativeMinimaTokens(walletStatus);

  if (block.type.endsWith("_start")) {
    return (
      <Panel className={formGridClass}>
        <strong>Selected start block</strong>
        <p className={mutedText}>{draftBlockTitle(block)}. To choose a different start block, reset the canvas.</p>
        {block.type === "schedule_start" ? <label>Interval<select value={block.config.intervalSeconds ?? 60} onChange={(event) => onChange({ intervalSeconds: Number(event.target.value) })}>{intervals.map((interval) => <option key={interval} value={interval}>{formatInterval(interval)}</option>)}</select></label> : block.type === "manual_start" ? <p className={mutedText}>Manual workflows run only when you click Run now.</p> : <label>Start source<select value={block.config.sourceId ?? ""} onChange={(event) => onChange({ sourceId: event.target.value })}><option value="">Select source...</option>{startSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>}
      </Panel>
    );
  }

  if (block.type === "fetch_data_source") {
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <p className={mutedText}>Fetch JSON from an HTTP device/source.</p>
        <label>HTTP source<select value={block.config.sourceId ?? ""} onChange={(event) => onChange({ sourceId: event.target.value })}><option value="">Select HTTP source...</option>{httpSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </Panel>
    );
  }

  if (block.type === "capture_camera") {
    const selectedCamera = cameraSources.find((source) => source.id === block.config.sourceId);
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <p className={mutedText}>Capture a photo or video clip from a configured Pi Camera. The media bytes are hashed; read history stores capture metadata.</p>
        <label>Camera device<select value={block.config.sourceId ?? ""} onChange={(event) => onChange({ ...block.config, sourceId: event.target.value })}><option value="">Select camera...</option>{cameraSources.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
        {selectedCamera?.config.mode === "video" && <label>Capture duration ms<input value={String(block.config.durationMs ?? selectedCamera.config.durationMs ?? 5000)} inputMode="numeric" onChange={(event) => onChange({ ...block.config, durationMs: Number(event.target.value) })} /></label>}
        {selectedCamera?.config.mode === "photo" && <p className={mutedText}>Photo captures use the camera device warmup timeout configured on Devices.</p>}
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </Panel>
    );
  }

  if (block.type === "set_variable") {
    const variableSource = block.config.variableSource ?? "custom_json";
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <p className={mutedText}>Save a per-run value that later condition and output blocks can use.</p>
        <label>Variable name<input value={block.config.variableName ?? "message"} onChange={(event) => onChange({ ...block.config, variableName: event.target.value })} placeholder="discordMessage" /></label>
        <label>Value source<select value={variableSource} onChange={(event) => onChange(defaultVariableSourceConfig(block.config, event.target.value as NonNullable<AutomationBlock["config"]["variableSource"]>))}><option value="custom_json">Custom JSON</option><option value="trigger_field">Trigger field</option><option value="latest_data_field">Latest data field</option><option value="context_field">Workflow context field</option></select></label>
        {variableSource === "custom_json" ? <label>Custom JSON<textarea rows={5} value={block.config.valueJsonText ?? '"Button pressed"'} onChange={(event) => onChange({ ...block.config, variableSource: "custom_json", valueJsonText: event.target.value })} /></label> : <label>Field path<input value={block.config.fieldPath ?? ""} onChange={(event) => onChange({ ...block.config, variableSource, fieldPath: event.target.value })} placeholder={variableSource === "trigger_field" ? "pin" : variableSource === "latest_data_field" ? "temperature" : "hash"} /></label>}
      </Panel>
    );
  }

  if (block.type === "if_payload_field_equals") {
    const conditionSource = block.config.source ?? "trigger";
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <label>Condition source<select value={conditionSource} onChange={(event) => onChange(defaultConditionSourceConfig(block.config, event.target.value as "trigger" | "variable"))}><option value="trigger">Trigger event</option><option value="variable">Variable</option></select></label>
        {conditionSource === "variable" ? <label>Variable name<input value={block.config.variableName ?? "temp"} onChange={(event) => onChange({ ...block.config, source: "variable", variableName: event.target.value })} placeholder="temp" /></label> : <label>Field path<input value={block.config.fieldPath ?? "active"} onChange={(event) => onChange({ ...block.config, source: "trigger", fieldPath: event.target.value })} /></label>}
        <label>Operator<select value={block.config.operator ?? "equals"} onChange={(event) => onChange({ ...block.config, operator: event.target.value as ConditionOperator })}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {!operatorHasNoValue(block.config.operator ?? "equals") && <label>Compare value<input value={compareValueInputText(block.config.value ?? true)} onChange={(event) => onChange({ ...block.config, value: parseCompareValueInput(event.target.value) })} /></label>}
      </Panel>
    );
  }

  if (block.type === "wait") {
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <label>Wait duration ms<input value={String(block.config.durationMs ?? 1000)} inputMode="numeric" onChange={(event) => onChange({ durationMs: Number(event.target.value) })} /></label>
      </Panel>
    );
  }

  if (block.type === "control_output") {
    const selectedOutput = outputTargets.find((source) => source.id === block.config.targetId);
    const selectedAction = selectedOutput?.type === "gpio-output" ? "pulse" : selectedOutput?.type === "http-output" ? "send_request" : selectedOutput?.type === "mqtt-output" ? "publish" : "pulse";
    const selectedBodyTargetType = selectedOutput?.type === "http-output" || selectedOutput?.type === "mqtt-output" ? selectedOutput.type : null;
    const bodyMode = block.config.bodyMode ?? "workflow_context";
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <label>Output target<select value={block.config.targetId ?? ""} onChange={(event) => {
          const target = outputTargets.find((source) => source.id === event.target.value);
          onChange(defaultOutputBlockConfig(target, block.config.durationMs ?? 500));
        }}><option value="">Select output target...</option>{outputTargets.map((source) => <option key={source.id} value={source.id}>{source.name} - {sourceLabel(source)}</option>)}</select></label>
        {selectedOutput?.type === "gpio-output" && <label>Pulse duration ms<input value={String(block.config.durationMs ?? 500)} inputMode="numeric" onChange={(event) => onChange({ ...block.config, action: "pulse", durationMs: Number(event.target.value) })} /></label>}
        {selectedOutput?.type === "gpio-output" && <p className={mutedText}>Selected device active state: <strong>{selectedOutput.config.activeState ?? "high"}</strong>. Use High for common GPIO to resistor to LED to GND wiring. Change this from Devices by editing the GPIO Output target.</p>}
        {selectedBodyTargetType && <>
          <label>{selectedBodyTargetType === "http-output" ? "Request body" : "Message payload"}<select value={bodyMode} onChange={(event) => onChange(outputBodyModeConfig(block.config, event.target.value as NonNullable<AutomationBlock["config"]["bodyMode"]>, selectedBodyTargetType))}>{outputBodyModes(selectedBodyTargetType).map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
          {bodyMode === "custom" && <label>Custom JSON<textarea rows={6} value={block.config.bodyTemplateText ?? defaultCustomBodyText()} onChange={(event) => onChange({ ...block.config, bodyMode: "custom", bodyTemplateText: event.target.value })} /></label>}
          <p className={mutedText}>{bodyModeDescription(bodyMode, selectedBodyTargetType)}</p>
        </>}
        {!selectedOutput && <p className={mutedText}>Choose a configured output target from Devices.</p>}
        {selectedAction === "pulse" && <p className={mutedText}>Verify resistor wiring and test pulse before enabling GPIO output workflows.</p>}
      </Panel>
    );
  }

  if (block.type === "send_transaction") {
    return (
      <Panel className={formGridClass}>
        <strong>Selected block</strong>
        <label>Recipient<select value={block.config.recipientAddressBookId ?? ""} onChange={(event) => onChange({ ...block.config, recipientAddressBookId: event.target.value, tokenId: "0x00" })}><option value="">Select address book recipient...</option>{addressBook.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <label>Token<select value={block.config.tokenId ?? "0x00"} onChange={() => onChange({ ...block.config, tokenId: "0x00" })}>{nativeTokens.length > 0 ? nativeTokens.map((token) => <option key={token.tokenId} value="0x00">Minima (native) - {token.sendable} sendable</option>) : <option value="0x00">Minima (native)</option>}</select></label>
        <label>Amount<input value={block.config.amount ?? ""} inputMode="decimal" onChange={(event) => onChange({ ...block.config, tokenId: "0x00", amount: event.target.value })} /></label>
        <p className={mutedText}>This spends wallet funds automatically when the workflow runs. Consider creating paused until you are ready to test.</p>
      </Panel>
    );
  }

  if (isDataBlock(block.type) && block.attachedBlocks?.some((attached) => attached.type === "stamp_integritas")) {
    return (
      <Panel className={formGridClass}>
        <strong>Selected data block</strong>
        <p className={mutedText}>{draftBlockDescription(block, sources)}</p>
        <AttachedStampSettings block={block} onAttachedChange={onAttachedChange} onAttachedRemove={onAttachedRemove} />
      </Panel>
    );
  }

  return <Panel><strong>Selected block</strong><p className={mutedText}>{draftBlockDescription(block, sources)}</p></Panel>;
}

function AttachedStampSettings({ block, onAttachedChange, onAttachedRemove }: { block: DraftWorkflowBlock; onAttachedChange: (attachedId: string, config: AutomationBlock["config"]) => void; onAttachedRemove: (attachedId: string) => void }) {
  const stamp = block.attachedBlocks?.find((attached) => attached.type === "stamp_integritas");
  if (!stamp) return null;
  const condition = stamp.config.condition;
  const conditionObject = condition && typeof condition === "object" && !Array.isArray(condition) ? condition as NonNullable<AutomationBlock["config"]["condition"]> : null;

  return (
    <div className={cx(softCardClass, formGridClass)}>
      <strong>+ Stamp data attached</strong>
      <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center justify-start gap-2.5"><input className="w-auto" type="checkbox" checked={Boolean(conditionObject)} onChange={(event) => onAttachedChange(stamp.id, { condition: event.target.checked ? { source: "data", fieldPath: "active", operator: "equals", value: true } : null })} /> Only stamp when this block's data matches</label>
      {conditionObject && <>
        <p className={mutedText}>The condition checks the data produced by the Record/Fetch block this stamp is attached to.</p>
        <label>This block's data field path<input value={conditionObject.fieldPath ?? "active"} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", fieldPath: event.target.value } })} /></label>
        <label>Operator<select value={conditionObject.operator ?? "equals"} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", operator: event.target.value as ConditionOperator } })}>{conditionOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {!operatorHasNoValue(conditionObject.operator ?? "equals") && <label>Compare value<input value={compareValueInputText(conditionObject.value ?? true)} onChange={(event) => onAttachedChange(stamp.id, { condition: { ...conditionObject, source: "data", value: parseCompareValueInput(event.target.value) } })} /></label>}
      </>}
      <Button type="button" variant="danger" size="sm" onClick={() => onAttachedRemove(stamp.id)}>Remove attached stamp</Button>
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
  if (type === "capture_camera") return { sourceId: firstCameraSource(sources)?.id ?? "" };
  if (type === "gpio_event_start" || type === "webhook_event_start" || type === "mqtt_event_start") return { sourceId: defaultSourceForStart(type, sources)?.id ?? "" };
  if (type === "if_payload_field_equals") return { source: "trigger", fieldPath: "active", operator: "equals", value: true };
  if (type === "wait") return { durationMs: 1000 };
  if (type === "set_variable") return { variableName: "message", variableSource: "custom_json", valueJsonText: '"Button pressed"' };
  if (type === "control_output") {
    const target = sources.find((source) => isOutputTarget(source));
    return defaultOutputBlockConfig(target, 500);
  }
  if (type === "send_transaction") return { recipientAddressBookId: "", tokenId: "0x00", amount: "" };
  if (type === "stamp_integritas") return { condition: null };
  return {};
}

function defaultEditBlockConfig(type: AutomationBlockType, sources: DataSource[], addressBook: AddressBookEntry[]): AutomationBlock["config"] {
  const config = defaultDraftConfig(type, sources);
  if (type === "send_transaction") return { ...config, recipientAddressBookId: addressBook[0]?.id ?? "" };
  return config;
}

function WorkflowWorkspace({ workflow, runs, validation, source, sources, addressBook, walletStatus, busy, mode, initialRunId, onNavigateMode, onSelectWatchRun, onAddBlock, onDeleteBlock, onUpdateBlock, onUpdateWorkflow, onReorderBlocks, onRunNow, onRunWithPayload }: { workflow: AutomationWorkflow; runs: AutomationRun[]; validation: AutomationValidationResult | null; source: DataSource | undefined; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; mode: "edit" | "watch"; initialRunId?: string; onNavigateMode: (mode: "edit" | "watch") => void; onSelectWatchRun: (runId: string) => void; onAddBlock: (input: Parameters<typeof addAutomationBlock>[1]) => void; onDeleteBlock: (blockId: string) => void; onUpdateBlock: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onUpdateWorkflow: (input: Parameters<typeof updateAutomationWorkflow>[1]) => void; onReorderBlocks: (blockIds: string[]) => void; onRunNow: () => void; onRunWithPayload: (payload: unknown) => void }) {
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(examplePayload(workflow), null, 2));
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const [selectedBlockId, setSelectedBlockId] = useState(startBlock?.id ?? "");
  const selectedBlock = mainBlocks.find((block) => block.id === selectedBlockId) ?? startBlock;
  const selectedDraftBlock = selectedBlock ? { id: selectedBlock.id, type: selectedBlock.type, config: selectedBlock.config, attachedBlocks: workflow.blocks.filter((item) => item.parentBlockId === selectedBlock.id).map((item) => ({ id: item.id, type: item.type, config: item.config })) } : undefined;
  const canvasBlocks = mainBlocks.map((block) => automationBlockToCanvasBlock(block, workflow.blocks));
  const canAddRecordTriggerEvent = Boolean(startBlock && (startBlock.type === "gpio_event_start" || startBlock.type === "webhook_event_start" || startBlock.type === "mqtt_event_start") && !mainBlocks.some((block) => block.type === "record_trigger_event"));
  const hasValidationErrors = Boolean(validation && validation.errors.length > 0);
  const validationByBlockId = validationIssuesByBlockId(validation);
  const selectedRun = mode === "watch" ? runs.find((run) => run.id === selectedRunId) ?? runs[0] : undefined;
  const runtimeByBlockId = mode === "watch" ? runtimeByBlockIdFromRun(selectedRun) : {};
  const watchRunStatusLabel = selectedRun?.status === "running" ? "Live updating" : selectedRun ? "Viewing historic run" : "No run selected";

  useEffect(() => {
    if (startBlock && !mainBlocks.some((block) => block.id === selectedBlockId)) setSelectedBlockId(startBlock.id);
  }, [mainBlocks, selectedBlockId, startBlock]);

  useEffect(() => {
    setWorkflowName(workflow.name);
  }, [workflow.id, workflow.name]);

  useEffect(() => {
    if (mode !== "watch") return;
    if (runs.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (initialRunId && runs.some((run) => run.id === initialRunId)) {
      setSelectedRunId(initialRunId);
      return;
    }
    if (!selectedRunId || !runs.some((run) => run.id === selectedRunId)) setSelectedRunId(runs[0].id);
  }, [initialRunId, mode, runs, selectedRunId]);

  function addBlockFromLibrary(type: AutomationBlockType) {
    onAddBlock({ type, config: defaultEditBlockConfig(type, sources, addressBook) });
  }

  return (
    <WorkflowWorkspaceShell
      eyebrow={mode === "watch" ? "Watch workflow" : "Edit workflow"}
      title={workflow.name}
      description={<>
        <p className={mutedText}>{source?.name ?? "Unknown source"} · {workflowIntervalSeconds(workflow) > 0 ? formatInterval(workflowIntervalSeconds(workflow)) : "Event driven"}</p>
        <p className={mutedText}>{mode === "watch" ? "Run and inspect this workflow from the shared canvas shell." : "Changes are saved per block. Edit fields, then click that block's save button; add/remove/move/pause/enable actions apply immediately."}</p>
        {mode === "watch" && selectedRun && <p className={mutedText}>Canvas showing run from {formatLocalTime(selectedRun.startedAt)} · {selectedRun.status} · {formatDuration(selectedRun.durationMs)}</p>}
      </>}
      actions={<>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onNavigateMode(mode === "watch" ? "edit" : "watch")}>{mode === "watch" ? "Open in edit" : "Open in watch"}</Button>
        <WorkflowStatusPill workflow={workflow} />
        {mode === "watch" && <StatusPill status={selectedRun?.status === "running" ? "good" : "neutral"}>{watchRunStatusLabel}</StatusPill>}
        <StatusPill status="neutral">Blocks {workflow.blocks.length}</StatusPill>
        <StatusPill status="neutral">Last run {workflow.lastRunAt ? formatLocalTime(workflow.lastRunAt) : "Never"}</StatusPill>
        <StatusPill status="neutral">Next {workflow.nextRunAt ? formatLocalTime(workflow.nextRunAt) : workflowIntervalSeconds(workflow) > 0 ? "Paused" : "On incoming data"}</StatusPill>
      </>}
      notices={<>
        {workflow.archived && <p className={mutedText}>Archived workflows do not run automatically or manually until restored.</p>}
        {workflow.lastError && <p className={errorText}>{workflow.lastError}</p>}
      </>}
      left={mode === "edit" ? <WorkflowBlockLibrary mode="edit" hasStartBlock={Boolean(startBlock)} selectedBlock={selectedDraftBlock} canAddRecordTriggerEvent={canAddRecordTriggerEvent} onSelectStartBlock={() => undefined} onAddBlock={addBlockFromLibrary} onAttachStamp={(parentId) => onAddBlock({ type: "stamp_integritas", config: {}, parentBlockId: parentId })} /> : <WatchRunControls workflow={workflow} busy={busy} hasValidationErrors={hasValidationErrors} payloadText={payloadText} payloadError={payloadError} onPayloadTextChange={(value) => {
          setPayloadText(value);
          setPayloadError(null);
        }} onPayloadError={setPayloadError} onResetPayload={() => {
          setPayloadText(JSON.stringify(examplePayload(workflow), null, 2));
          setPayloadError(null);
        }} onRunNow={onRunNow} onRunWithPayload={onRunWithPayload} />}
      center={<WorkflowCanvas mode={mode} blocks={canvasBlocks} sources={sources} statusLabel={workflow.archived ? "Archived" : workflow.enabled ? "Enabled" : "Paused"} statusGood={!workflow.archived && workflow.enabled} selectedBlockId={selectedBlock?.id ?? ""} validationByBlockId={validationByBlockId} runtimeByBlockId={runtimeByBlockId} onSelectBlock={setSelectedBlockId} onMoveBlock={(blockId, direction) => {
          const index = mainBlocks.findIndex((block) => block.id === blockId);
          if (index > 0) onReorderBlocks(moveBlock(mainBlocks, index, index + direction));
        }} onRemoveBlock={(blockId) => {
          const block = mainBlocks.find((item) => item.id === blockId);
          if (block && !block.type.endsWith("_start")) onDeleteBlock(block.id);
        }} />}
      right={<aside className={inspectorClass}>
          {mode === "edit" ? <>
            <div className={cx(softCardClass, formGridClass)}>
              <strong>Workflow setup</strong>
              <label>Workflow name<input value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="Button fetches weather API" /></label>
              <SaveState dirty={workflowName.trim() !== workflow.name} saved={false} />
              <Button type="button" size="sm" disabled={busy || !workflowName.trim() || workflowName.trim() === workflow.name} onClick={() => onUpdateWorkflow({ name: workflowName.trim() })}>Save workflow name</Button>
            </div>
            <WorkflowValidationPanel validation={validation} />
            <div className={softCardClass}>
              <strong>Selected block</strong>
              {selectedBlock ? <PersistedBlockInspector
                key={selectedBlock.id}
                block={selectedBlock}
                attachedBlocks={workflow.blocks.filter((item) => item.parentBlockId === selectedBlock.id)}
                sources={sources}
                addressBook={addressBook}
                walletStatus={walletStatus}
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
              /> : <p className={mutedText}>Select a block on the canvas to edit it.</p>}
            </div>
          </> : <WatchRuntimeInspector selectedBlock={selectedBlock} latestBlockRun={blockRunForBlock(selectedRun, selectedBlock?.id ?? null)} selectedRun={selectedRun} validation={validation} />}
        </aside>}
      bottom={mode === "watch" ? <WatchRunHistory runs={runs} selectedRunId={selectedRun?.id ?? null} onSelectRun={(runId) => {
        setSelectedRunId(runId);
        onSelectWatchRun(runId);
      }} /> : undefined}
    />
  );
}

function WorkflowValidationPanel({ validation }: { validation: AutomationValidationResult | null }) {
  if (!validation) return <Panel><p className={mutedText}>Checking workflow validation...</p></Panel>;
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return <Panel><StatusPill status="good">Workflow validation passed</StatusPill></Panel>;
  }
  const groupedIssues = groupValidationIssues([...validation.errors, ...validation.warnings]);

  return (
    <Panel>
      <div className={statusRowClass}>
        <div>
          <strong>Workflow validation</strong>
          <p className={mutedText}>Fix errors before running. Warnings are allowed, but should be reviewed before enabling hardware or wallet actions.</p>
        </div>
        <StatusPill status={validation.errors.length > 0 ? "warn" : "neutral"}>{validation.errors.length} error(s), {validation.warnings.length} warning(s)</StatusPill>
      </div>
      {groupedIssues.map((issue) => <ValidationIssueRow key={`${issue.issue.level}-${issue.issue.code}-${issue.issue.message}-${issue.issue.blockType ?? "workflow"}`} issue={issue.issue} count={issue.count} />)}
    </Panel>
  );
}

function groupValidationIssues(issues: AutomationValidationResult["errors"]): { issue: AutomationValidationResult["errors"][number]; count: number }[] {
  const grouped = new Map<string, { issue: AutomationValidationResult["errors"][number]; count: number }>();
  for (const issue of issues) {
    const key = [issue.level, issue.code, issue.message, issue.blockType ?? ""].join("|");
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { issue, count: 1 });
  }
  return [...grouped.values()];
}

function validationIssuesByBlockId(validation: AutomationValidationResult | null): Record<string, WorkflowCanvasValidationIssue[]> {
  const result: Record<string, WorkflowCanvasValidationIssue[]> = {};
  if (!validation) return result;
  for (const issue of [...validation.errors, ...validation.warnings]) {
    if (!issue.blockId) continue;
    result[issue.blockId] = [...(result[issue.blockId] ?? []), { level: issue.level, message: issue.message }];
  }
  return result;
}

function runtimeByBlockIdFromRun(run: AutomationRun | undefined): Record<string, WorkflowCanvasRuntimeState> {
  const result: Record<string, WorkflowCanvasRuntimeState> = {};
  if (!run) return result;
  for (const block of run.blocks) {
    if (!block.blockId) continue;
    result[block.blockId] = { status: block.status, durationMs: block.durationMs, error: block.error };
  }
  return result;
}

function PersistedBlockInspector({ block, attachedBlocks, sources, addressBook, walletStatus, busy, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onAttachStamp, onUpdate, onUpdateAttached, onDelete, onDeleteAttached }: { block: AutomationBlock; attachedBlocks: AutomationBlock[]; sources: DataSource[]; addressBook: AddressBookEntry[]; walletStatus: WalletStatus | null; busy: boolean; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void; onAttachStamp: () => void; onUpdate: (input: Parameters<typeof updateAutomationBlock>[2]) => void; onUpdateAttached: (blockId: string, input: Parameters<typeof updateAutomationBlock>[2]) => void; onDelete: () => void; onDeleteAttached: (blockId: string) => void }) {
  const [config, setConfig] = useState(block.config);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const draftBlock: DraftWorkflowBlock = { id: block.id, type: block.type, config, attachedBlocks: attachedBlocks.map((attached) => ({ id: attached.id, type: attached.type, config: attached.config })) };
  const dirty = JSON.stringify(config) !== JSON.stringify(block.config);
  const removable = !block.type.endsWith("_start");
  const canAttachStamp = isDataBlock(block.type) && !attachedBlocks.some((attached) => attached.type === "stamp_integritas");

  useEffect(() => {
    setConfig(block.config);
    setSaveNotice(null);
  }, [block.id, block.config]);

  return (
    <div className={formGridClass}>
      <DraftBlockInspector block={draftBlock} sources={sources} addressBook={addressBook} walletStatus={walletStatus} onChange={(nextConfig) => {
        setConfig(nextConfig);
        setSaveNotice(null);
      }} onAttachedChange={(attachedId, nextConfig) => onUpdateAttached(attachedId, { config: nextConfig })} onAttachedRemove={onDeleteAttached} />
      {block.lastError && <p className={errorText}>{block.lastError}</p>}
      <SaveState dirty={dirty} saved={saveNotice === "Block saved"} />
      <RowActions>
        <Button type="button" size="xs" disabled={busy || !dirty} onClick={() => {
          onUpdate({ config });
          setSaveNotice("Block saved");
        }}>Save selected block</Button>
        {removable && <Button type="button" variant="secondary" size="xs" disabled={busy || !canMoveUp} onClick={onMoveUp}>Move up now</Button>}
        {removable && <Button type="button" variant="secondary" size="xs" disabled={busy || !canMoveDown} onClick={onMoveDown}>Move down now</Button>}
        {removable && canAttachStamp && <Button type="button" variant="secondary" size="xs" disabled={busy} onClick={onAttachStamp}>Attach Integritas now</Button>}
        {removable && <Button type="button" variant="secondary" size="xs" disabled={busy} onClick={() => onUpdate({ enabled: !block.enabled })}>{block.enabled ? "Disable now" : "Enable now"}</Button>}
        {removable && <Button type="button" variant="danger" size="xs" disabled={busy} onClick={onDelete}>Remove block now</Button>}
      </RowActions>
    </div>
  );
}

function WatchRunControls({ workflow, busy, hasValidationErrors, payloadText, payloadError, onPayloadTextChange, onPayloadError, onResetPayload, onRunNow, onRunWithPayload }: { workflow: AutomationWorkflow; busy: boolean; hasValidationErrors: boolean; payloadText: string; payloadError: string | null; onPayloadTextChange: (value: string) => void; onPayloadError: (value: string | null) => void; onResetPayload: () => void; onRunNow: () => void; onRunWithPayload: (payload: unknown) => void }) {
  return (
    <aside className={cx("grid content-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4", formGridClass)}>
      <strong>Run controls</strong>
      <p className={mutedText}>Run this workflow or test it with a manual trigger payload.</p>
      {workflow.archived && <p className={mutedText}>Archived workflows cannot run until restored from the workflow list.</p>}
      {hasValidationErrors && <p className={errorText}>Fix validation errors before running.</p>}
      <Button type="button" size="sm" disabled={busy || hasValidationErrors || workflow.archived} onClick={onRunNow}>Run now</Button>
      <strong>Test payload</strong>
      <p className={mutedText}>This payload is used only for a manual test run.</p>
      <label>Trigger payload<textarea rows={12} value={payloadText} onChange={(event) => onPayloadTextChange(event.target.value)} /></label>
      {payloadError && <p className={errorText}>{payloadError}</p>}
      <RowActions>
        <Button type="button" variant="secondary" size="xs" disabled={busy} onClick={onResetPayload}>Reset example</Button>
        <Button type="button" size="xs" disabled={busy || hasValidationErrors || workflow.archived} onClick={() => {
          try {
            onRunWithPayload(JSON.parse(payloadText) as unknown);
          } catch (error) {
            onPayloadError(error instanceof Error ? error.message : "Payload must be valid JSON");
          }
        }}>Run with payload</Button>
      </RowActions>
    </aside>
  );
}

function WatchRuntimeInspector({ selectedBlock, latestBlockRun, selectedRun, validation }: { selectedBlock: AutomationBlock | undefined; latestBlockRun: AutomationRun["blocks"][number] | null; selectedRun: AutomationRun | undefined; validation: AutomationValidationResult | null }) {
  const readId = readIdFromOutput(latestBlockRun?.output);
  const proofId = proofIdFromOutput(latestBlockRun?.output);

  return (
    <>
      <WorkflowValidationPanel validation={validation} />
      <Panel>
        <strong>Selected run</strong>
        {selectedRun ? <div className="grid gap-3 sm:grid-cols-3">
          <RulePart title="Started" value={formatLocalTime(selectedRun.startedAt)} />
          <RulePart title="Status" value={selectedRun.status} />
          <RulePart title="Duration" value={formatDuration(selectedRun.durationMs)} />
        </div> : <p className={mutedText}>No run selected yet. Run the workflow or choose a historic run below.</p>}
        {selectedRun?.error && <p className={errorText}>{selectedRun.error}</p>}
      </Panel>
      <Panel>
        <strong>Selected block runtime</strong>
        {!selectedBlock && <p className={mutedText}>Select a block on the canvas to inspect its latest run output.</p>}
        {selectedBlock && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <RulePart title="Block" value={blockLabel(selectedBlock)} />
            <RulePart title="Last block run" value={latestBlockRun ? latestBlockRun.status : selectedBlock.lastRunAt ? "No run details loaded" : "Not run yet"} />
            <RulePart title="Duration" value={latestBlockRun ? formatDuration(latestBlockRun.durationMs) : "No timing"} />
          </div>
          {selectedBlock.lastError && <p className={errorText}>{selectedBlock.lastError}</p>}
          {latestBlockRun?.error && <p className={errorText}>{latestBlockRun.error}</p>}
          {latestBlockRun?.output !== null && latestBlockRun?.output !== undefined ? <JsonPreview value={latestBlockRun.output} /> : <p className={mutedText}>No output recorded for the latest selected-block run.</p>}
          {readId && <p className={mutedText}><Link to={diagnosticsLink("reads", readId)}>Open read in Diagnostics</Link></p>}
          {proofId && <p className={mutedText}><Link to={diagnosticsLink("proofs", proofId)}>Open proof in Diagnostics</Link></p>}
        </>}
      </Panel>
    </>
  );
}

function WatchRunHistory({ runs, selectedRunId, onSelectRun }: { runs: AutomationRun[]; selectedRunId: string | null; onSelectRun: (runId: string) => void }) {
  const [rawRunId, setRawRunId] = useState<string | null>(null);
  const rawRun = runs.find((run) => run.id === rawRunId);

  return (
    <Panel>
      <div className={statusRowClass}>
        <div>
          <strong>Historic runs</strong>
          <p className={mutedText}>Choose a run to visualize on the canvas, or expand raw JSON for diagnostics.</p>
        </div>
        <StatusPill status="neutral">{runs.length} run(s)</StatusPill>
      </div>
      {runs.length === 0 ? <p className={mutedText}>No workflow runs recorded yet.</p> : <TableWrap>
        <DataTable>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={tableHeaderCellClass}>Started</th>
              <th className={tableHeaderCellClass}>Trigger</th>
              <th className={tableHeaderCellClass}>Status</th>
              <th className={tableHeaderCellClass}>Duration</th>
              <th className={tableHeaderCellClass}>Blocks</th>
              <th className={tableHeaderCellClass}>Details</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className={tableRowClass}>
                <td className={tableCellClass}>{formatLocalTime(run.startedAt)}</td>
                <td className={tableCellClass}>{run.triggerType}</td>
                <td className={tableCellClass}><StatusPill status={run.status === "success" ? "good" : run.status === "failed" ? "warn" : "neutral"}>{run.status}</StatusPill></td>
                <td className={tableCellClass}>{formatDuration(run.durationMs)}</td>
                <td className={tableCellClass}>{run.blocks.filter((block) => block.status === "success").length}/{run.blockCount}</td>
                <td className={tableCellClass}><RowActions><Button type="button" variant="secondary" size="xs" disabled={selectedRunId === run.id} onClick={() => onSelectRun(run.id)}>{selectedRunId === run.id ? "Showing" : "Show on canvas"}</Button><Button type="button" variant="secondary" size="xs" onClick={() => setRawRunId(rawRunId === run.id ? null : run.id)}>{rawRunId === run.id ? "Hide raw" : "Raw details"}</Button></RowActions></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrap>}
      {rawRun && <Panel>
        <div className={statusRowClass}>
          <div><strong>Raw workflow run JSON</strong><p className={mutedText}>Full stored run payload for diagnostics.</p></div>
          <StatusPill status={rawRun.status === "success" ? "good" : rawRun.status === "failed" ? "warn" : "neutral"}>{rawRun.status}</StatusPill>
        </div>
        <JsonPreview value={rawRun} />
      </Panel>}
    </Panel>
  );
}

function blockRunForBlock(run: AutomationRun | undefined, blockId: string | null) {
  if (!run || !blockId) return null;
  return run.blocks.find((block) => block.blockId === blockId) ?? null;
}

function diagnosticsLink(tab: "proofs" | "reads", id: string) {
  const params = new URLSearchParams({ tab, page: "1", pageSize: "25", q: id });
  return `/diagnostics?${params.toString()}`;
}

function readIdFromOutput(output: unknown) {
  if (!output || typeof output !== "object") return null;
  const record = output as { readId?: unknown; data?: { readId?: unknown } };
  if (typeof record.readId === "string") return record.readId;
  if (record.data && typeof record.data.readId === "string") return record.data.readId;
  return null;
}

function proofIdFromOutput(output: unknown) {
  if (!output || typeof output !== "object") return null;
  const record = output as { proofId?: unknown };
  return typeof record.proofId === "string" ? record.proofId : null;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "Running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
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
    workflowPrimarySourceId(workflow),
    sourceName,
    workflow.lastHash ?? "",
    workflow.lastProofId ?? "",
    workflow.lastError ?? "",
    workflow.blocks.map((block) => `${block.type} ${block.config.sourceId ?? ""} ${block.config.targetId ?? ""}`).join(" ")
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function ValidationIssueRow({ issue, count = 1 }: { issue: AutomationValidationResult["errors"][number]; count?: number }) {
  return (
    <p className={issue.level === "error" ? errorText : mutedText}>
      <StatusPill status={issue.level === "error" ? "warn" : "neutral"}>{issue.level}</StatusPill> {issue.message}{issue.blockType ? ` (${issue.blockType})` : ""}{count > 1 ? ` · ${count} blocks` : ""}
    </p>
  );
}

function SaveState({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty) return <p className={mutedText}><StatusPill status="warn">Unsaved changes</StatusPill> Use this block's save button to apply edits.</p>;
  if (saved) return <p className={mutedText}><StatusPill status="good">Saved</StatusPill></p>;
  return <p className={mutedText}><StatusPill status="neutral">No unsaved changes</StatusPill></p>;
}

function moveBlock(blocks: AutomationBlock[], from: number, to: number) {
  const next = blocks.map((block) => block.id);
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

function RulePart({ title, value }: { title: string; value: string }) {
  return <div><span className={mutedText}>{title}</span><strong>{value}</strong></div>;
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
  if (block.type === "capture_camera") return "Capture camera";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "if_payload_field_equals") return `If ${conditionSourceLabel(block.config.source ?? "trigger")} field matches`;
  if (block.type === "wait") return "Wait";
  if (block.type === "stamp_integritas") return "Stamp data";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  return block.type;
}

function blockShortLabel(block: AutomationBlock) {
  if (block.type.endsWith("_start")) return "Start";
  if (block.type === "record_trigger_event") return "Record event";
  if (block.type === "fetch_data_source") return "Fetch source";
  if (block.type === "capture_camera") return "Capture camera";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "if_payload_field_equals") return "If field matches";
  if (block.type === "stamp_integritas") return "Stamp";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  if (block.type === "wait") return "Wait";
  return block.type;
}

function conditionSourceLabel(source: "trigger" | "variable") {
  return source === "variable" ? "variable" : "trigger";
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

function sourcesForStart(type: AutomationBlockType, sources: DataSource[]) {
  if (type === "gpio_event_start") return sources.filter((source) => source.type === "gpio-input");
  if (type === "webhook_event_start") return sources.filter((source) => source.type === "webhook");
  if (type === "mqtt_event_start") return sources.filter((source) => source.type === "mqtt");
  return [];
}

function defaultSourceForStart(type: AutomationBlockType, sources: DataSource[]) {
  return sourcesForStart(type, sources)[0] ?? null;
}

function workflowPrimarySourceId(workflow: AutomationWorkflow) {
  const mainBlocks = workflow.blocks.filter((block) => !block.parentBlockId);
  const fetchBlock = mainBlocks.find((block) => block.type === "fetch_data_source");
  const captureBlock = mainBlocks.find((block) => block.type === "capture_camera");
  const startBlock = mainBlocks.find((block) => block.type.endsWith("_start"));
  return fetchBlock?.config.sourceId ?? captureBlock?.config.sourceId ?? startBlock?.config.sourceId ?? "";
}

function workflowIntervalSeconds(workflow: AutomationWorkflow) {
  const startBlock = workflow.blocks.find((block) => !block.parentBlockId && block.type === "schedule_start");
  const intervalSeconds = Number(startBlock?.config.intervalSeconds);
  return Number.isFinite(intervalSeconds) ? intervalSeconds : 0;
}

function firstHttpSource(sources: DataSource[]) {
  return sources.find((source) => source.type === "json-api" || source.type === "internal-json-api") ?? null;
}

function firstCameraSource(sources: DataSource[]) {
  return sources.find((source) => source.type === "pi-camera") ?? null;
}

function nativeMinimaTokens(walletStatus: WalletStatus | null) {
  return (walletStatus?.tokens ?? []).filter((token) => token.isNative || token.tokenId.toLowerCase() === "0x00");
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
  if (source.type === "gpio-output") return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"} active:${source.config.activeState ?? "high"}`;
  if (source.type === "http-output") return `${source.config.method ?? "POST"} ${source.config.url ?? "HTTP output"}`;
  if (source.type === "mqtt-output") return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "pi-camera") return `${source.config.mode ?? "photo"} ${source.config.width ?? 1280}x${source.config.height ?? 720}`;
  return source.config.url ?? "HTTP JSON API";
}

function isOutputTarget(source: DataSource) {
  return source.type === "gpio-output" || source.type === "http-output" || source.type === "mqtt-output";
}

function outputActionForTarget(source: DataSource | undefined) {
  if (source?.type === "http-output") return "send_request";
  if (source?.type === "mqtt-output") return "publish";
  return "pulse";
}

function defaultOutputBlockConfig(source: DataSource | undefined, durationMs: number): AutomationBlock["config"] {
  if (source?.type === "gpio-output") return { targetId: source.id, action: "pulse", durationMs };
  if (source?.type === "http-output") return { targetId: source.id, action: "send_request", bodyMode: "custom", bodyTemplateText: defaultCustomBodyText() };
  if (source?.type === "mqtt-output") return { targetId: source.id, action: "publish", bodyMode: "workflow_context" };
  return { targetId: "", action: "pulse", durationMs };
}

function outputBodyModeConfig(config: AutomationBlock["config"], bodyMode: NonNullable<AutomationBlock["config"]["bodyMode"]>, targetType: "http-output" | "mqtt-output"): AutomationBlock["config"] {
  const next = { ...config, bodyMode };
  if (bodyMode === "custom" && !next.bodyTemplateText) next.bodyTemplateText = defaultCustomBodyText();
  if (bodyMode !== "custom") delete next.bodyTemplateText;
  if (targetType === "mqtt-output" && bodyMode === "none") return { ...next, bodyMode: "workflow_context" };
  return next;
}

function defaultVariableSourceConfig(config: AutomationBlock["config"], variableSource: NonNullable<AutomationBlock["config"]["variableSource"]>): AutomationBlock["config"] {
  const base = { variableName: config.variableName ?? "message", variableSource };
  if (variableSource === "custom_json") return { ...base, valueJsonText: config.valueJsonText ?? '"Button pressed"' };
  return { ...base, fieldPath: variableSource === "trigger_field" ? "pin" : variableSource === "latest_data_field" ? "temperature" : "hash" };
}

function defaultConditionSourceConfig(config: AutomationBlock["config"], source: "trigger" | "variable"): AutomationBlock["config"] {
  if (source === "variable") return { ...config, source, variableName: config.variableName ?? "temp", fieldPath: undefined };
  return { ...config, source, fieldPath: config.fieldPath ?? "active", variableName: undefined };
}

function outputBodyModes(targetType: "http-output" | "mqtt-output") {
  return [
    { value: "custom", label: "Custom JSON" },
    { value: "workflow_context", label: "Workflow context" },
    { value: "trigger_payload", label: "Trigger payload" },
    { value: "latest_data", label: "Latest data" },
    ...(targetType === "http-output" ? [{ value: "none", label: "No body" }] : [])
  ] as { value: NonNullable<AutomationBlock["config"]["bodyMode"]>; label: string }[];
}

function bodyModeDescription(bodyMode: AutomationBlock["config"]["bodyMode"], targetType: "http-output" | "mqtt-output") {
  if (bodyMode === "custom") return targetType === "http-output" ? "Send exactly this JSON as the request body." : "Publish exactly this JSON as the message payload.";
  if (bodyMode === "trigger_payload") return "Send only the event payload that started this workflow.";
  if (bodyMode === "latest_data") return "Send the data recorded or fetched earlier in this workflow.";
  if (bodyMode === "none") return "Send the request without a body.";
  return "Send workflow trigger, data, output, hash, and proof references.";
}

function defaultCustomBodyText() {
  return '{\n  "content": "Integritas Pi workflow triggered."\n}';
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds} seconds`;
  if (seconds < 3600) return `Every ${seconds / 60} minute${seconds === 60 ? "" : "s"}`;
  return `Every ${seconds / 3600} hour${seconds === 3600 ? "" : "s"}`;
}
