import type { DataSource } from "../data-sources/dataSourceTypes";
import type { AutomationBlock, AutomationBlockType } from "./automationTypes";

export type DraftWorkflowBlock = {
  id: string;
  type: AutomationBlockType;
  config: AutomationBlock["config"];
  attachedBlocks?: DraftWorkflowBlock[];
};

export function WorkflowBlockLibrary({ mode = "build", hasStartBlock, selectedBlock, canAddRecordTriggerEvent = true, onSelectStartBlock, onAddBlock, onAttachStamp }: { mode?: "build" | "edit"; hasStartBlock: boolean; selectedBlock: DraftWorkflowBlock | undefined; canAddRecordTriggerEvent?: boolean; onSelectStartBlock: (type: AutomationBlockType) => void; onAddBlock: (type: AutomationBlockType) => void; onAttachStamp: (parentId: string) => void }) {
  const canAddMainBlock = hasStartBlock;
  return (
    <aside className="workflow-block-library">
      <strong>Block library</strong>
      <p className="muted">{mode === "build" ? "Choose one start block first. Reset the canvas if you need to choose a different start." : "Add blocks to this workflow. Select a block on the canvas to configure it."}</p>
      {mode === "build" && !hasStartBlock && <strong>Start blocks</strong>}
      {mode === "build" && !hasStartBlock && <button type="button" className="workflow-library-card" onClick={() => onSelectStartBlock("manual_start")}><span>Manual run</span><small>Run only when an operator starts it.</small></button>}
      {mode === "build" && !hasStartBlock && <button type="button" className="workflow-library-card" onClick={() => onSelectStartBlock("schedule_start")}><span>Schedule</span><small>Run repeatedly on an interval.</small></button>}
      {mode === "build" && !hasStartBlock && <button type="button" className="workflow-library-card" onClick={() => onSelectStartBlock("gpio_event_start")}><span>GPIO input event</span><small>Start from a configured GPIO input device.</small></button>}
      {mode === "build" && !hasStartBlock && <button type="button" className="workflow-library-card" onClick={() => onSelectStartBlock("webhook_event_start")}><span>Webhook received</span><small>Start when JSON arrives at a webhook URL.</small></button>}
      {mode === "build" && !hasStartBlock && <button type="button" className="workflow-library-card" onClick={() => onSelectStartBlock("mqtt_event_start")}><span>MQTT message received</span><small>Start when JSON arrives on an MQTT topic.</small></button>}
      {mode === "build" && hasStartBlock && <p className="muted">Start block selected. Data and logic blocks can now be added.</p>}
      <strong>Data blocks</strong>
      <button type="button" className="workflow-library-card" disabled={!canAddMainBlock || !canAddRecordTriggerEvent} onClick={() => onAddBlock("record_trigger_event")}><span>Record trigger event</span><small>Store the trigger payload as data.</small></button>
      <button type="button" className="workflow-library-card" disabled={!canAddMainBlock} onClick={() => onAddBlock("fetch_data_source")}><span>Fetch HTTP JSON</span><small>Fetch a configured HTTP source.</small></button>
      <strong>Logic blocks</strong>
      <button type="button" className="workflow-library-card" disabled={!canAddMainBlock} onClick={() => onAddBlock("if_payload_field_equals")}><span>If field matches</span><small>Stop unless a trigger/data field matches.</small></button>
      <button type="button" className="workflow-library-card" disabled={!canAddMainBlock} onClick={() => onAddBlock("wait")}><span>Wait</span><small>Pause before the next block.</small></button>
      <strong>Action blocks</strong>
      <button type="button" className="workflow-library-card" disabled={!canAddMainBlock} onClick={() => onAddBlock("control_output")}><span>Pulse output</span><small>Pulse a configured GPIO LED output.</small></button>
      <button type="button" className="workflow-library-card" disabled={!canAddMainBlock} onClick={() => onAddBlock("send_transaction")}><span>Send transaction</span><small>Send native MINIMA to an address book recipient.</small></button>
      <strong>Attached actions</strong>
      <button type="button" className="workflow-library-card" disabled={!selectedBlock || !isDataBlock(selectedBlock.type) || Boolean(selectedBlock.attachedBlocks?.some((block) => block.type === "stamp_integritas"))} onClick={() => selectedBlock && onAttachStamp(selectedBlock.id)}><span>Stamp with Integritas</span><small>Select a Record or Fetch block to attach a stamp.</small></button>
    </aside>
  );
}

export function WorkflowDraftCanvas({ blocks, sources, enabled, selectedBlockId, onSelectBlock, onMoveBlock, onRemoveBlock }: { blocks: DraftWorkflowBlock[]; sources: DataSource[]; enabled: boolean; selectedBlockId: string; onSelectBlock: (id: string) => void; onMoveBlock: (id: string, direction: -1 | 1) => void; onRemoveBlock: (id: string) => void }) {
  return (
    <section className="workflow-draft-canvas">
      <div className="status-row">
        <div>
          <strong>Draft canvas</strong>
          <p className="muted">This is the starter chain that will be created.</p>
        </div>
        <span className={`pill ${enabled ? "pill-good" : "pill-neutral"}`}>{enabled ? "Enabled on create" : "Paused on create"}</span>
      </div>
      <div className="workflow-canvas-lane">
        {blocks.length === 0 && <div className="workflow-canvas-empty"><strong>Choose a start block</strong><p className="muted">Start with Manual, Schedule, GPIO, Webhook, or MQTT. Then add data and logic blocks.</p></div>}
        {blocks.map((block, index) => (
          <DraftBlockCard key={block.id} block={block} index={index} sources={sources} selected={block.id === selectedBlockId} canMoveUp={index > 1} canMoveDown={index > 0 && index < blocks.length - 1} onSelect={() => onSelectBlock(block.id)} onMoveUp={() => onMoveBlock(block.id, -1)} onMoveDown={() => onMoveBlock(block.id, 1)} onRemove={() => onRemoveBlock(block.id)} />
        ))}
      </div>
    </section>
  );
}

export function WorkflowSavedCanvas({ blocks, sources, workflowEnabled, workflowArchived, selectedBlockId, onSelectBlock, onMoveBlock, onRemoveBlock }: { blocks: AutomationBlock[]; sources: DataSource[]; workflowEnabled: boolean; workflowArchived: boolean; selectedBlockId: string; onSelectBlock: (id: string) => void; onMoveBlock: (id: string, direction: -1 | 1) => void; onRemoveBlock: (id: string) => void }) {
  const mainBlocks = blocks.filter((block) => !block.parentBlockId);

  return (
    <section className="workflow-draft-canvas">
      <div className="status-row">
        <div>
          <strong>Workflow canvas</strong>
          <p className="muted">Select a block to edit it below. Move and remove actions apply immediately.</p>
        </div>
        <span className={`pill ${workflowArchived ? "pill-neutral" : workflowEnabled ? "pill-good" : "pill-neutral"}`}>{workflowArchived ? "Archived" : workflowEnabled ? "Enabled" : "Paused"}</span>
      </div>
      <div className="workflow-canvas-lane">
        {mainBlocks.length === 0 && <div className="workflow-canvas-empty"><strong>No blocks</strong><p className="muted">Add a start block by creating a new workflow.</p></div>}
        {mainBlocks.map((block, index) => (
          <WorkflowBlockCard key={block.id} block={block} index={index} sources={sources} selected={block.id === selectedBlockId} canMoveUp={index > 1} canMoveDown={index > 0 && index < mainBlocks.length - 1} onSelect={() => onSelectBlock(block.id)} onMoveUp={() => onMoveBlock(block.id, -1)} onMoveDown={() => onMoveBlock(block.id, 1)} onRemove={() => onRemoveBlock(block.id)} attachedBlocks={blocks.filter((item) => item.parentBlockId === block.id)} />
        ))}
      </div>
    </section>
  );
}

function DraftBlockCard({ block, index, sources, selected, canMoveUp, canMoveDown, onSelect, onMoveUp, onMoveDown, onRemove }: { block: DraftWorkflowBlock; index: number; sources: DataSource[]; selected: boolean; canMoveUp: boolean; canMoveDown: boolean; onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void }) {
  return (
    <div className={`workflow-draft-block ${blockCategoryClass(block.type)} ${selected ? "selected" : ""}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}>
      <span className="workflow-draft-kicker">{index === 0 ? "When" : "Then"}</span>
      <strong>{draftBlockTitle(block)}</strong>
      <p>{draftBlockDescription(block, sources)}</p>
      <DraftBlockBadges block={block} />
      {block.attachedBlocks?.map((attached) => <div key={attached.id} className="workflow-attached-draft-block"><strong>+ {draftBlockTitle(attached)}</strong><p>{draftBlockDescription(attached, sources)}</p><DraftBlockBadges block={attached} /></div>)}
      {!block.type.endsWith("_start") && <div className="workflow-draft-actions">
        <button type="button" disabled={!canMoveUp} onClick={(event) => { event.stopPropagation(); onMoveUp(); }}>Up</button>
        <button type="button" disabled={!canMoveDown} onClick={(event) => { event.stopPropagation(); onMoveDown(); }}>Down</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }}>Remove</button>
      </div>}
    </div>
  );
}

function WorkflowBlockCard({ block, index, sources, selected, canMoveUp, canMoveDown, onSelect, onMoveUp, onMoveDown, onRemove, attachedBlocks }: { block: AutomationBlock; index: number; sources: DataSource[]; selected: boolean; canMoveUp: boolean; canMoveDown: boolean; onSelect: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void; attachedBlocks: AutomationBlock[] }) {
  return (
    <div className={`workflow-draft-block ${blockCategoryClass(block.type)} ${selected ? "selected" : ""}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}>
      <span className="workflow-draft-kicker">{index === 0 ? "When" : "Then"}</span>
      <strong>{draftBlockTitle(block)}</strong>
      <p>{draftBlockDescription(block, sources)}</p>
      <DraftBlockBadges block={block} />
      <div className="workflow-draft-badges">
        <span>{block.enabled ? "Enabled" : "Disabled"}</span>
        {block.lastRunAt && <span>Ran {new Date(block.lastRunAt).toLocaleString()}</span>}
        {block.lastError && <span>Error</span>}
      </div>
      {attachedBlocks.map((attached) => <div key={attached.id} className="workflow-attached-draft-block"><strong>+ {draftBlockTitle(attached)}</strong><p>{draftBlockDescription(attached, sources)}</p><DraftBlockBadges block={attached} /></div>)}
      {!block.type.endsWith("_start") && <div className="workflow-draft-actions">
        <button type="button" disabled={!canMoveUp} onClick={(event) => { event.stopPropagation(); onMoveUp(); }}>Move up</button>
        <button type="button" disabled={!canMoveDown} onClick={(event) => { event.stopPropagation(); onMoveDown(); }}>Move down</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }}>Remove</button>
      </div>}
    </div>
  );
}

function DraftBlockBadges({ block }: { block: DraftWorkflowBlock }) {
  const badges: string[] = [];
  if (block.type.endsWith("_start")) badges.push("Provides trigger event");
  if (isDataBlock(block.type)) badges.push("Provides latest data");
  if (block.type === "if_payload_field_equals") badges.push((block.config.source ?? "trigger") === "data" ? "Reads latest data" : "Reads trigger event");
  if (block.type === "stamp_integritas") badges.push("Reads parent data");
  if (badges.length === 0) return null;
  return <div className="workflow-draft-badges">{badges.map((badge) => <span key={badge}>{badge}</span>)}</div>;
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
  if (block.type === "stamp_integritas") return "Stamp with Integritas";
  if (block.type === "control_output") return "Pulse output";
  if (block.type === "send_transaction") return "Send transaction";
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
  if (block.type === "stamp_integritas") return "Stamp this data block's hash.";
  if (block.type === "control_output") return `Pulse configured LED output for ${block.config.durationMs ?? 0} ms.`;
  if (block.type === "send_transaction") return `Send ${block.config.amount || "?"} native MINIMA.`;
  return "Select a source in Setup.";
}

function blockCategoryClass(type: AutomationBlockType) {
  if (type.endsWith("_start")) return "workflow-draft-start";
  if (type === "record_trigger_event" || type === "fetch_data_source") return "workflow-draft-data";
  return "workflow-draft-action";
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
