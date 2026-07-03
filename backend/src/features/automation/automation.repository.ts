import crypto from "node:crypto";
import { db } from "../../db/database.js";

export type AutomationBlockType =
  | "manual_start"
  | "schedule_start"
  | "gpio_event_start"
  | "webhook_event_start"
  | "mqtt_event_start"
  | "record_trigger_event"
  | "fetch_data_source"
  | "if_payload_field_equals"
  | "wait"
  | "stamp_integritas"
  | "control_output"
  | "send_transaction";

export type AutomationWorkflowRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_hash: string | null;
  last_proof_id: string | null;
  last_error: string | null;
};

export type AutomationBlockRecord = {
  id: string;
  workflow_id: string;
  created_at: string;
  updated_at: string;
  type: AutomationBlockType;
  enabled: number;
  order_index: number;
  parent_block_id: string | null;
  config_json: string;
  last_run_at: string | null;
  last_error: string | null;
};

export function listAutomationWorkflows() {
  return db.prepare("SELECT * FROM automation_workflows ORDER BY created_at DESC").all() as AutomationWorkflowRecord[];
}

export function getAutomationWorkflow(id: string) {
  return db.prepare("SELECT * FROM automation_workflows WHERE id = ?").get(id) as AutomationWorkflowRecord | undefined;
}

export function listAutomationBlocks(workflowId: string) {
  return db.prepare("SELECT * FROM automation_blocks WHERE workflow_id = ? ORDER BY order_index ASC, created_at ASC").all(workflowId) as AutomationBlockRecord[];
}

export function getAutomationBlock(id: string) {
  return db.prepare("SELECT * FROM automation_blocks WHERE id = ?").get(id) as AutomationBlockRecord | undefined;
}

export function listDueScheduleWorkflows(nowIso: string) {
  return db.prepare(`
    SELECT DISTINCT workflow.* FROM automation_workflows workflow
    JOIN automation_blocks block ON block.workflow_id = workflow.id
    WHERE workflow.enabled = 1
      AND block.enabled = 1
      AND block.order_index = 1
      AND block.parent_block_id IS NULL
      AND block.type = 'schedule_start'
      AND (workflow.next_run_at IS NULL OR workflow.next_run_at <= ?)
    ORDER BY workflow.next_run_at ASC
  `).all(nowIso) as AutomationWorkflowRecord[];
}

export function listEnabledEventWorkflows(type: "gpio_event_start" | "webhook_event_start" | "mqtt_event_start", sourceId: string) {
  return db.prepare(`
    SELECT workflow.* FROM automation_workflows workflow
    JOIN automation_blocks block ON block.workflow_id = workflow.id
    WHERE workflow.enabled = 1
      AND block.enabled = 1
      AND block.order_index = 1
      AND block.parent_block_id IS NULL
      AND block.type = ?
      AND json_extract(block.config_json, '$.sourceId') = ?
    ORDER BY workflow.created_at ASC
  `).all(type, sourceId) as AutomationWorkflowRecord[];
}

export function getEnabledAutomationWorkflowForDataSource(dataSourceId: string) {
  return listEnabledEventWorkflows("webhook_event_start", dataSourceId)[0]
    ?? listEnabledEventWorkflows("mqtt_event_start", dataSourceId)[0]
    ?? listEnabledEventWorkflows("gpio_event_start", dataSourceId)[0];
}

export function createAutomationWorkflow(input: { name: string; enabled: boolean; blocks?: { type: AutomationBlockType; config: unknown; enabled?: boolean; parentBlockId?: string | null }[]; nextRunAt?: string | null }) {
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO automation_workflows (id, created_at, updated_at, name, enabled, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, nowIso, nowIso, input.name, input.enabled ? 1 : 0, input.nextRunAt ?? null);

  for (const [index, block] of (input.blocks ?? []).entries()) {
    createAutomationBlock(id, { ...block, orderIndex: index + 1 });
  }

  return getAutomationWorkflow(id)!;
}

export function updateAutomationWorkflow(id: string, input: { name?: string; enabled?: boolean; nextRunAt?: string | null; lastError?: string | null }) {
  const current = getAutomationWorkflow(id);
  if (!current) return undefined;
  db.prepare(`
    UPDATE automation_workflows
    SET updated_at = ?, name = ?, enabled = ?, next_run_at = ?, last_error = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    input.name ?? current.name,
    input.enabled === undefined ? current.enabled : input.enabled ? 1 : 0,
    input.nextRunAt === undefined ? current.next_run_at : input.nextRunAt,
    input.lastError === undefined ? current.last_error : input.lastError,
    id
  );
  return getAutomationWorkflow(id)!;
}

export function updateAutomationRunSuccess(id: string, input: { hash?: string | null; proofId?: string | null; nextRunAt?: string | null; lastError?: string | null }) {
  db.prepare(`
    UPDATE automation_workflows
    SET updated_at = ?, last_run_at = ?, next_run_at = ?, last_hash = COALESCE(?, last_hash), last_proof_id = ?, last_error = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), input.nextRunAt ?? null, input.hash ?? null, input.proofId ?? null, input.lastError ?? null, id);
  return getAutomationWorkflow(id)!;
}

export function updateAutomationRunError(id: string, error: string, input: { hash?: string | null; proofId?: string | null; nextRunAt?: string | null } = {}) {
  db.prepare(`
    UPDATE automation_workflows
    SET updated_at = ?, last_run_at = ?, next_run_at = ?, last_hash = COALESCE(?, last_hash), last_proof_id = COALESCE(?, last_proof_id), last_error = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), input.nextRunAt ?? null, input.hash ?? null, input.proofId ?? null, error, id);
  return getAutomationWorkflow(id)!;
}

export function updateAutomationBlockRun(id: string, input: { error?: string | null } = {}) {
  db.prepare("UPDATE automation_blocks SET updated_at = ?, last_run_at = ?, last_error = ? WHERE id = ?")
    .run(new Date().toISOString(), new Date().toISOString(), input.error ?? null, id);
  return getAutomationBlock(id)!;
}

export function createAutomationBlock(workflowId: string, input: { type: AutomationBlockType; config: unknown; enabled?: boolean; orderIndex?: number; parentBlockId?: string | null }) {
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const orderIndex = input.orderIndex ?? nextBlockOrder(workflowId, input.parentBlockId ?? null);
  db.prepare(`
    INSERT INTO automation_blocks (id, workflow_id, created_at, updated_at, type, enabled, order_index, parent_block_id, config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, workflowId, nowIso, nowIso, input.type, input.enabled === false ? 0 : 1, orderIndex, input.parentBlockId ?? null, JSON.stringify(input.config));
  return getAutomationBlock(id)!;
}

export function updateAutomationBlock(workflowId: string, blockId: string, input: { config?: unknown; enabled?: boolean }) {
  const current = db.prepare("SELECT * FROM automation_blocks WHERE id = ? AND workflow_id = ?").get(blockId, workflowId) as AutomationBlockRecord | undefined;
  if (!current) return undefined;
  db.prepare(`
    UPDATE automation_blocks
    SET updated_at = ?, enabled = ?, config_json = ?, last_error = NULL
    WHERE id = ? AND workflow_id = ?
  `).run(
    new Date().toISOString(),
    input.enabled === undefined ? current.enabled : input.enabled ? 1 : 0,
    input.config === undefined ? current.config_json : JSON.stringify(input.config),
    blockId,
    workflowId
  );
  return getAutomationBlock(blockId)!;
}

export function reorderAutomationBlocks(workflowId: string, blockIds: string[]) {
  const currentBlocks = listAutomationBlocks(workflowId).filter((block) => !block.parent_block_id);
  const currentIds = currentBlocks.map((block) => block.id);
  if (blockIds.length !== currentIds.length || new Set(blockIds).size !== blockIds.length || !currentIds.every((id) => blockIds.includes(id))) {
    throw new Error("blockIds must include every workflow block exactly once");
  }

  const firstBlock = currentBlocks.find((block) => block.id === blockIds[0]);
  if (!firstBlock?.type.endsWith("_start")) throw new Error("The first workflow block must be a start block");
  if (blockIds.slice(1).some((id) => currentBlocks.find((block) => block.id === id)?.type.endsWith("_start"))) throw new Error("Start blocks cannot be moved after action blocks");

  const update = db.prepare("UPDATE automation_blocks SET updated_at = ?, order_index = ? WHERE id = ? AND workflow_id = ?");
  const nowIso = new Date().toISOString();
  for (const [index, id] of blockIds.entries()) update.run(nowIso, index + 1, id, workflowId);
  return listAutomationBlocks(workflowId);
}

export function deleteAutomationBlock(workflowId: string, blockId: string) {
  const block = db.prepare("SELECT * FROM automation_blocks WHERE id = ? AND workflow_id = ?").get(blockId, workflowId) as AutomationBlockRecord | undefined;
  if (!block) return undefined;
  db.prepare("DELETE FROM automation_blocks WHERE id = ? AND workflow_id = ?").run(blockId, workflowId);
  normalizeBlockOrder(workflowId);
  return block;
}

export function deleteAutomationWorkflow(id: string) {
  db.prepare("DELETE FROM automation_workflows WHERE id = ?").run(id);
}

export function replaceAutomationBlocks(workflowId: string, blocks: { type: AutomationBlockType; config: unknown; enabled?: boolean }[]) {
  db.prepare("DELETE FROM automation_blocks WHERE workflow_id = ?").run(workflowId);
  for (const [index, block] of blocks.entries()) createAutomationBlock(workflowId, { ...block, orderIndex: index + 1 });
}

function nextBlockOrder(workflowId: string, parentBlockId: string | null) {
  if (parentBlockId) {
    const parent = db.prepare("SELECT order_index FROM automation_blocks WHERE id = ? AND workflow_id = ?").get(parentBlockId, workflowId) as { order_index: number } | undefined;
    return parent?.order_index ?? 1;
  }

  const row = db.prepare("SELECT COALESCE(MAX(order_index), 0) + 1 as nextOrder FROM automation_blocks WHERE workflow_id = ? AND parent_block_id IS NULL").get(workflowId) as { nextOrder: number };
  return row.nextOrder;
}

function normalizeBlockOrder(workflowId: string) {
  for (const [index, block] of listAutomationBlocks(workflowId).filter((item) => !item.parent_block_id).entries()) {
    db.prepare("UPDATE automation_blocks SET order_index = ? WHERE id = ?").run(index + 1, block.id);
    db.prepare("UPDATE automation_blocks SET order_index = ? WHERE workflow_id = ? AND parent_block_id = ?").run(index + 1, workflowId, block.id);
  }
}
