import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { ParsedListQuery } from "../../shared/list-query.js";

export type AutomationRunRecord = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed";
  trigger_type: string;
  trigger_source_id: string | null;
  trigger_payload_json: string | null;
  duration_ms: number | null;
  block_count: number;
  error: string | null;
};

export type AutomationBlockRunRecord = {
  id: string;
  run_id: string;
  workflow_id: string;
  block_id: string | null;
  order_index: number;
  block_type: string;
  block_label: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed" | "skipped";
  duration_ms: number | null;
  input_json: string | null;
  output_json: string | null;
  error: string | null;
};

export function createAutomationRun(input: { workflowId: string; workflowName: string; triggerType: string; triggerSourceId?: string | null; triggerPayload?: unknown; blockCount: number }) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO automation_runs (id, workflow_id, workflow_name, started_at, status, trigger_type, trigger_source_id, trigger_payload_json, block_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.workflowId, input.workflowName, new Date().toISOString(), "running", input.triggerType, input.triggerSourceId ?? null, input.triggerPayload === undefined ? null : JSON.stringify(input.triggerPayload), input.blockCount);
  return getAutomationRun(id)!;
}

export function finishAutomationRun(id: string, input: { status: "success" | "failed"; error?: string | null }) {
  const run = getAutomationRun(id);
  if (!run) return undefined;
  const finishedAt = new Date().toISOString();
  db.prepare(`
    UPDATE automation_runs
    SET finished_at = ?, status = ?, duration_ms = ?, error = ?
    WHERE id = ?
  `).run(finishedAt, input.status, duration(run.started_at, finishedAt), input.error ?? null, id);
  return getAutomationRun(id)!;
}

export function createAutomationBlockRun(input: { runId: string; workflowId: string; blockId: string; orderIndex: number; blockType: string; blockLabel: string; input?: unknown }) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO automation_block_runs (id, run_id, workflow_id, block_id, order_index, block_type, block_label, started_at, status, input_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.runId, input.workflowId, input.blockId, input.orderIndex, input.blockType, input.blockLabel, new Date().toISOString(), "running", input.input === undefined ? null : JSON.stringify(input.input));
  return getAutomationBlockRun(id)!;
}

export function finishAutomationBlockRun(id: string, input: { status: "success" | "failed" | "skipped"; output?: unknown; error?: string | null }) {
  const run = getAutomationBlockRun(id);
  if (!run) return undefined;
  const finishedAt = new Date().toISOString();
  db.prepare(`
    UPDATE automation_block_runs
    SET finished_at = ?, status = ?, duration_ms = ?, output_json = ?, error = ?
    WHERE id = ?
  `).run(finishedAt, input.status, duration(run.started_at, finishedAt), input.output === undefined ? null : JSON.stringify(input.output), input.error ?? null, id);
  return getAutomationBlockRun(id)!;
}

export const AUTOMATION_RUN_LIST_STATUSES = ["running", "success", "failed"] as const;

export type AutomationRunListQuery = ParsedListQuery;

function buildAutomationRunListWhere(query: Pick<AutomationRunListQuery, "status" | "q">) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    clauses.push("status = ?");
    params.push(query.status);
  }

  if (query.q) {
    const like = `%${query.q}%`;
    clauses.push("(id LIKE ? OR workflow_name LIKE ? OR trigger_type LIKE ? OR trigger_source_id LIKE ? OR error LIKE ?)");
    params.push(like, like, like, like, like);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function countAutomationRuns(query: Pick<AutomationRunListQuery, "status" | "q"> = {}) {
  const { where, params } = buildAutomationRunListWhere(query);
  const row = db.prepare(`SELECT COUNT(*) as count FROM automation_runs ${where}`).get(...params) as { count: number };
  return row.count;
}

export function listAutomationRuns(query: AutomationRunListQuery) {
  const { where, params } = buildAutomationRunListWhere(query);
  const offset = (query.page - 1) * query.pageSize;
  return db.prepare(`
    SELECT * FROM automation_runs
    ${where}
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, query.pageSize, offset) as AutomationRunRecord[];
}

export function listAutomationRunsForWorkflow(workflowId: string, limit = 20) {
  return db.prepare("SELECT * FROM automation_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?").all(workflowId, limit) as AutomationRunRecord[];
}

export function getAutomationRun(id: string) {
  return db.prepare("SELECT * FROM automation_runs WHERE id = ?").get(id) as AutomationRunRecord | undefined;
}

export function listAutomationBlockRuns(runId: string) {
  return db.prepare("SELECT * FROM automation_block_runs WHERE run_id = ? ORDER BY order_index ASC, started_at ASC").all(runId) as AutomationBlockRunRecord[];
}

function getAutomationBlockRun(id: string) {
  return db.prepare("SELECT * FROM automation_block_runs WHERE id = ?").get(id) as AutomationBlockRunRecord | undefined;
}

function duration(startedAt: string, finishedAt: string) {
  return Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());
}
