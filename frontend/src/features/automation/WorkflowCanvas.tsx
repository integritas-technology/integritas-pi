import type { ReactNode } from "react";
import type { DataSource } from "../data-sources/dataSourceTypes";
import { DarkHeroCard } from "../../components/DarkHeroCard";
import { cx } from "../../lib/cx";
import type { AutomationBlock, AutomationBlockType } from "./automationTypes";

export type DraftWorkflowBlock = {
  id: string;
  type: AutomationBlockType;
  config: AutomationBlock["config"];
  attachedBlocks?: DraftWorkflowBlock[];
  enabled?: boolean;
  lastRunAt?: string | null;
  lastError?: string | null;
};

export type WorkflowCanvasMode = "build" | "edit" | "watch";

export type WorkflowCanvasBlock = DraftWorkflowBlock;

export type WorkflowCanvasValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type WorkflowCanvasRuntimeState = {
  status: "running" | "success" | "failed" | "skipped";
  durationMs: number | null;
  error?: string | null;
};

const mutedText = "text-sm text-slate-500";
const shellClass = "grid gap-5 rounded-[28px] border border-slate-200 bg-white/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-5";
const topbarClass = "flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between";
const gridClass = "grid gap-4 xl:grid-cols-[280px_minmax(360px,1fr)_360px]";
const rowActionsClass = "flex flex-wrap items-center gap-2";
const neutralPillClass = "inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-slate-600";
const statusPillClass = (good: boolean) => cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide", good ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600");
const libraryClass = "grid content-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4";
const libraryCardClass = "grid gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";
const canvasClass = "rounded-[22px] border border-blue-200 bg-blue-50/55 p-4";
const canvasLaneClass = "mt-4 rounded-[22px] border-2 border-dashed border-blue-300 bg-white/80 p-4";
const emptyCanvasClass = "rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center";
const blockBaseClass = "relative max-w-[430px] cursor-pointer rounded-[18px] px-[18px] py-3.5 text-white shadow-[0_12px_20px_rgba(15,23,42,0.15)] before:absolute before:left-[34px] before:top-[-18px] before:hidden before:h-[18px] before:w-1 before:bg-slate-400 [&+&]:mt-[18px] [&+&]:before:block";
const selectedBlockClass = "outline outline-4 outline-offset-4 outline-sky-500/30";
const blockActionClass = "rounded-full border-0 bg-white/90 px-2 py-1 text-xs font-extrabold text-slate-950 disabled:opacity-45";

export function WorkflowWorkspaceShell({ eyebrow, title, description, actions, left, center, right, bottom, notices }: { eyebrow: string; title: string; description: ReactNode; actions?: ReactNode; left: ReactNode; center: ReactNode; right: ReactNode; bottom?: ReactNode; notices?: ReactNode }) {
  return (
    <section className={shellClass}>
      <DarkHeroCard layout="none" className={topbarClass}>
        <div className="relative z-10">
          <span className="inline-flex w-fit items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-slate-200">{eyebrow}</span>
          <h2>{title}</h2>
          {typeof description === "string" ? <p className="text-sm text-slate-300">{description}</p> : description}
        </div>
        {actions && <div className={cx("relative z-10", rowActionsClass)}>{actions}</div>}
      </DarkHeroCard>
      {notices}
      <div className={gridClass}>
        {left}
        {center}
        {right}
      </div>
      {bottom}
    </section>
  );
}

export function WorkflowBlockLibrary({ mode = "build", hasStartBlock, selectedBlock, canAddRecordTriggerEvent = true, onSelectStartBlock, onAddBlock, onAttachStamp }: { mode?: "build" | "edit"; hasStartBlock: boolean; selectedBlock: DraftWorkflowBlock | undefined; canAddRecordTriggerEvent?: boolean; onSelectStartBlock: (type: AutomationBlockType) => void; onAddBlock: (type: AutomationBlockType) => void; onAttachStamp: (parentId: string) => void }) {
  const canAddMainBlock = hasStartBlock;
  return (
    <aside className={libraryClass}>
      <strong>Block library</strong>
      <p className={mutedText}>{mode === "build" ? "Choose one start block first. Reset the canvas if you need to choose a different start." : "Add blocks to this workflow. Select a block on the canvas to configure it."}</p>
      {mode === "build" && !hasStartBlock && <strong>Start blocks</strong>}
      {mode === "build" && !hasStartBlock && <LibraryCard onClick={() => onSelectStartBlock("manual_start")} title="Manual run" description="Run only when an operator starts it." />}
      {mode === "build" && !hasStartBlock && <LibraryCard onClick={() => onSelectStartBlock("schedule_start")} title="Schedule" description="Run repeatedly on an interval." />}
      {mode === "build" && !hasStartBlock && <LibraryCard onClick={() => onSelectStartBlock("gpio_event_start")} title="GPIO input event" description="Start from a configured GPIO input device." />}
      {mode === "build" && !hasStartBlock && <LibraryCard onClick={() => onSelectStartBlock("webhook_event_start")} title="Webhook received" description="Start when JSON arrives at a webhook URL." />}
      {mode === "build" && !hasStartBlock && <LibraryCard onClick={() => onSelectStartBlock("mqtt_event_start")} title="MQTT message received" description="Start when JSON arrives on an MQTT topic." />}
      {mode === "build" && hasStartBlock && <p className={mutedText}>Start block selected. Data and logic blocks can now be added.</p>}
      <strong>Data blocks</strong>
      <LibraryCard disabled={!canAddMainBlock || !canAddRecordTriggerEvent} onClick={() => onAddBlock("record_trigger_event")} title="Record trigger event" description="Store the trigger payload as data." />
      <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("fetch_data_source")} title="Fetch HTTP JSON" description="Fetch a configured HTTP source." />
      <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("set_variable")} title="Set variable" description="Save a value for later blocks." />
      <strong>Logic blocks</strong>
      <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("if_payload_field_equals")} title="If field matches" description="Stop unless a trigger/data field matches." />
      <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("wait")} title="Wait" description="Pause before the next block." />
      <strong>Action blocks</strong>
      <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("control_output")} title="Control device" description="Send a command to a configured output target." />
      <LibraryCard disabled={!canAddMainBlock} onClick={() => onAddBlock("send_transaction")} title="Send payment" description="Send funds to a saved recipient." />
      <strong>Attached actions</strong>
      <LibraryCard disabled={!selectedBlock || !isDataBlock(selectedBlock.type) || Boolean(selectedBlock.attachedBlocks?.some((block) => block.type === "stamp_integritas"))} onClick={() => selectedBlock && onAttachStamp(selectedBlock.id)} title="Stamp data" description="Create an Integritas proof for recorded or fetched data." />
    </aside>
  );
}

function LibraryCard({ title, description, disabled, onClick }: { title: string; description: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={libraryCardClass} disabled={disabled} onClick={onClick}><span className="font-extrabold text-slate-950">{title}</span><small className="text-sm text-slate-500">{description}</small></button>;
}

export function WorkflowCanvas({ mode, blocks, sources, selectedBlockId, statusLabel, statusGood, validationByBlockId = {}, runtimeByBlockId = {}, onSelectBlock, onMoveBlock, onRemoveBlock }: { mode: WorkflowCanvasMode; blocks: WorkflowCanvasBlock[]; sources: DataSource[]; selectedBlockId: string; statusLabel: string; statusGood: boolean; validationByBlockId?: Record<string, WorkflowCanvasValidationIssue[]>; runtimeByBlockId?: Record<string, WorkflowCanvasRuntimeState>; onSelectBlock: (id: string) => void; onMoveBlock: (id: string, direction: -1 | 1) => void; onRemoveBlock: (id: string) => void }) {
  const isBuild = mode === "build";
  const actionLabels = isBuild ? { up: "Up", down: "Down", remove: "Remove" } : { up: "Move up", down: "Move down", remove: "Remove" };
  return (
    <section className={canvasClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <strong>{isBuild ? "Draft canvas" : "Workflow canvas"}</strong>
          <p className={mutedText}>{isBuild ? "This is the starter chain that will be created." : "Select a block to edit or inspect it. Move and remove actions apply immediately."}</p>
        </div>
        <span className={statusPillClass(statusGood)}>{statusLabel}</span>
      </div>
      <div className={canvasLaneClass}>
        {blocks.length === 0 && <div className={emptyCanvasClass}><strong>{isBuild ? "Choose a start block" : "No blocks"}</strong><p className={mutedText}>{isBuild ? "Start with Manual, Schedule, GPIO, Webhook, or MQTT. Then add data and logic blocks." : "Add a start block by creating a new workflow."}</p></div>}
        {blocks.map((block, index) => (
          <WorkflowBlockCard key={block.id} block={block} index={index} sources={sources} selected={block.id === selectedBlockId} canMoveUp={index > 1} canMoveDown={index > 0 && index < blocks.length - 1} actionLabels={actionLabels} validationIssues={validationByBlockId[block.id] ?? []} runtime={runtimeByBlockId[block.id]} onSelect={() => onSelectBlock(block.id)} onMoveUp={() => onMoveBlock(block.id, -1)} onMoveDown={() => onMoveBlock(block.id, 1)} onRemove={() => onRemoveBlock(block.id)} />
        ))}
      </div>
    </section>
  );
}

function WorkflowBlockCard({ block, index, sources, selected, canMoveUp, canMoveDown, actionLabels, validationIssues, runtime, onSelect, onMoveUp, onMoveDown, onRemove }: { block: DraftWorkflowBlock; index: number; sources: DataSource[]; selected: boolean; canMoveUp: boolean; canMoveDown: boolean; actionLabels: { up: string; down: string; remove: string }; validationIssues: WorkflowCanvasValidationIssue[]; runtime?: WorkflowCanvasRuntimeState; onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void }) {
  const presentation = blockPresentation(block, sources, validationIssues, runtime);
  return (
    <div className={cx(blockBaseClass, presentation.className, selected && selectedBlockClass)} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}>
      <span className="mb-1 block text-xs font-black uppercase tracking-widest opacity-80">{index === 0 ? "When" : "Then"}</span>
      <strong>{presentation.title}</strong>
      <p className="mt-1.5 text-sm text-white/85">{presentation.description}</p>
      <WorkflowBadges badges={presentation.badges} />
      {block.attachedBlocks?.map((attached) => <AttachedBlockCard key={attached.id} block={attached} sources={sources} />)}
      {!block.type.endsWith("_start") && <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className={blockActionClass} disabled={!canMoveUp} onClick={(event) => { event.stopPropagation(); onMoveUp(); }}>{actionLabels.up}</button>
        <button type="button" className={blockActionClass} disabled={!canMoveDown} onClick={(event) => { event.stopPropagation(); onMoveDown(); }}>{actionLabels.down}</button>
        <button type="button" className={blockActionClass} onClick={(event) => { event.stopPropagation(); onRemove(); }}>{actionLabels.remove}</button>
      </div>}
    </div>
  );
}

function AttachedBlockCard({ block, sources }: { block: DraftWorkflowBlock; sources: DataSource[] }) {
  const presentation = blockPresentation(block, sources, [], undefined);
  return <div className="mt-3 grid gap-1 rounded-[14px] border border-indigo-200 bg-indigo-50/95 p-3 text-indigo-900"><strong>+ {presentation.title}</strong><p className="m-0 text-sm text-slate-600">{presentation.description}</p><WorkflowBadges badges={presentation.badges} /></div>;
}

function WorkflowBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return <div className="mt-2.5 flex flex-wrap gap-1.5">{badges.map((badge) => <span key={badge} className="rounded-full bg-white/90 px-2 py-1 text-xs font-black text-slate-950">{badge}</span>)}</div>;
}

function blockPresentation(block: DraftWorkflowBlock, sources: DataSource[], validationIssues: WorkflowCanvasValidationIssue[], runtime?: WorkflowCanvasRuntimeState) {
  const validationErrors = validationIssues.filter((issue) => issue.level === "error");
  const validationWarnings = validationIssues.filter((issue) => issue.level === "warning");
  const badges = capabilityBadges(block);

  if (typeof block.enabled === "boolean") badges.push(block.enabled ? "Enabled" : "Disabled");
  if (block.lastRunAt) badges.push(`Ran ${new Date(block.lastRunAt).toLocaleString()}`);
  if (block.lastError) badges.push("Error");
  if (validationErrors.length > 0) badges.push(`${validationErrors.length} validation error${validationErrors.length === 1 ? "" : "s"}`);
  if (validationWarnings.length > 0) badges.push(`${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`);
  if (runtime) badges.push(runtime.durationMs === null ? runtime.status : `${runtime.status} · ${formatDuration(runtime.durationMs)}`);
  if (runtime?.error) badges.push("Run error");

  return {
    title: draftBlockTitle(block),
    description: draftBlockDescription(block, sources),
    badges,
    className: [blockCategoryClass(block.type), validationErrors.length > 0 ? "outline outline-4 outline-offset-4 outline-red-500/50" : "", validationWarnings.length > 0 ? "outline outline-4 outline-offset-4 outline-amber-500/50" : "", runtimeClass(runtime)].filter(Boolean).join(" ")
  };
}

export function automationBlockToCanvasBlock(block: AutomationBlock, allBlocks: AutomationBlock[]): WorkflowCanvasBlock {
  return {
    id: block.id,
    type: block.type,
    config: block.config,
    enabled: block.enabled,
    lastRunAt: block.lastRunAt,
    lastError: block.lastError,
    attachedBlocks: allBlocks.filter((item) => item.parentBlockId === block.id).map((attached) => ({
      id: attached.id,
      type: attached.type,
      config: attached.config,
      enabled: attached.enabled,
      lastRunAt: attached.lastRunAt,
      lastError: attached.lastError
    }))
  };
}

function capabilityBadges(block: DraftWorkflowBlock) {
  const badges: string[] = [];
  if (block.type.endsWith("_start")) badges.push("Provides trigger event");
  if (isDataBlock(block.type)) badges.push("Provides latest data");
  if (block.type === "if_payload_field_equals") badges.push((block.config.source ?? "trigger") === "data" ? "Reads latest data" : "Reads trigger event");
  if (block.type === "stamp_integritas") badges.push("Reads parent data");
  return badges;
}

export function isDataBlock(type: AutomationBlockType) {
  return type === "record_trigger_event" || type === "fetch_data_source";
}

export function draftBlockTitle(block: { type: AutomationBlockType }) {
  if (block.type === "manual_start") return "Manual run";
  if (block.type === "schedule_start") return "Schedule";
  if (block.type === "gpio_event_start") return "GPIO input event";
  if (block.type === "webhook_event_start") return "Webhook received";
  if (block.type === "mqtt_event_start") return "MQTT message received";
  if (block.type === "record_trigger_event") return "Record trigger event";
  if (block.type === "fetch_data_source") return "Fetch HTTP JSON";
  if (block.type === "set_variable") return "Set variable";
  if (block.type === "stamp_integritas") return "Stamp data";
  if (block.type === "control_output") return "Control device";
  if (block.type === "send_transaction") return "Send payment";
  return block.type;
}

export function draftBlockDescription(block: { type: AutomationBlockType; config: AutomationBlock["config"] }, sources: DataSource[]) {
  if (block.type === "schedule_start") return `Every ${formatInterval(Number(block.config.intervalSeconds ?? 60)).replace("Every ", "")}`;
  const sourceId = block.config.sourceId ?? block.config.targetId;
  const source = sourceId ? sources.find((item) => item.id === sourceId) : undefined;
  if (source) return `${source.name} - ${sourceLabel(source)}`;
  if (block.type === "manual_start") return "Runs only from a manual test/action.";
  if (block.type === "record_trigger_event") return "Stores the trigger payload as a data read.";
  if (block.type === "fetch_data_source") return "Fetches JSON and creates a hash.";
  if (block.type === "set_variable") return `Save ${block.config.variableName || "a variable"} for later blocks.`;
  if (block.type === "stamp_integritas") return "Stamp this data block's hash.";
  if (block.type === "control_output") return "Send a command to a configured output target.";
  if (block.type === "send_transaction") return `Send ${block.config.amount || "?"} to a saved recipient.`;
  return "Select a source in Setup.";
}

function blockCategoryClass(type: AutomationBlockType) {
  if (type.endsWith("_start")) return "bg-gradient-to-br from-amber-500 to-orange-500";
  if (type === "record_trigger_event" || type === "fetch_data_source" || type === "set_variable") return "bg-gradient-to-br from-blue-600 to-sky-500";
  return "bg-gradient-to-br from-violet-600 to-purple-500";
}

function runtimeClass(runtime?: WorkflowCanvasRuntimeState) {
  if (!runtime) return "";
  if (runtime.status === "running") return "shadow-[0_0_0_4px_rgba(14,165,233,0.35),0_12px_20px_rgba(15,23,42,0.15)]";
  if (runtime.status === "success") return "shadow-[0_0_0_4px_rgba(34,197,94,0.35),0_12px_20px_rgba(15,23,42,0.15)]";
  if (runtime.status === "failed") return "shadow-[0_0_0_4px_rgba(239,68,68,0.45),0_12px_20px_rgba(15,23,42,0.15)]";
  if (runtime.status === "skipped") return "opacity-80";
  return "";
}

function sourceLabel(source: DataSource) {
  if (source.type === "webhook") return "Webhook receive URL";
  if (source.type === "mqtt") return `${source.config.brokerUrl ?? "MQTT broker"} ${source.config.topic ?? ""}`;
  if (source.type === "gpio-input") return `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  if (source.type === "gpio-output") return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"}`;
  return source.config.url ?? "HTTP JSON API";
}

function formatInterval(seconds: number) {
  if (seconds < 60) return `Every ${seconds}s`;
  if (seconds < 3600) return `Every ${seconds / 60}m`;
  return `Every ${seconds / 3600}h`;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "running";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
