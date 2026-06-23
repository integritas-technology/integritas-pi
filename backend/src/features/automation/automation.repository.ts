import crypto from "node:crypto";
import { db } from "../../db/database.js";

export type AutomationWorkflowRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  data_source_id: string;
  enabled: number;
  polling_interval_seconds: number;
  stamp_with_integritas: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_hash: string | null;
  last_proof_id: string | null;
  last_error: string | null;
};

export function listAutomationWorkflows() {
  return db.prepare("SELECT * FROM automation_workflows ORDER BY created_at DESC").all() as AutomationWorkflowRecord[];
}

export function listDueAutomationWorkflows(nowIso: string) {
  return db.prepare(`
    SELECT * FROM automation_workflows
    WHERE enabled = 1 AND polling_interval_seconds > 0 AND (next_run_at IS NULL OR next_run_at <= ?)
    ORDER BY next_run_at ASC
  `).all(nowIso) as AutomationWorkflowRecord[];
}

export function getEnabledAutomationWorkflowForDataSource(dataSourceId: string) {
  return db.prepare(`
    SELECT * FROM automation_workflows
    WHERE data_source_id = ? AND enabled = 1
    ORDER BY created_at ASC
    LIMIT 1
  `).get(dataSourceId) as AutomationWorkflowRecord | undefined;
}

export function getAutomationWorkflow(id: string) {
  return db.prepare("SELECT * FROM automation_workflows WHERE id = ?").get(id) as AutomationWorkflowRecord | undefined;
}

export function createAutomationWorkflow(input: { name: string; dataSourceId: string; enabled: boolean; pollingIntervalSeconds: number; stampWithIntegritas: boolean }) {
  const id = crypto.randomUUID();
  const now = new Date();
  const nowIso = now.toISOString();
  const nextRunAt = input.enabled && input.pollingIntervalSeconds > 0 ? new Date(now.getTime() + input.pollingIntervalSeconds * 1000).toISOString() : null;
  db.prepare(`
    INSERT INTO automation_workflows (id, created_at, updated_at, name, data_source_id, enabled, polling_interval_seconds, stamp_with_integritas, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nowIso, nowIso, input.name, input.dataSourceId, input.enabled ? 1 : 0, input.pollingIntervalSeconds, input.stampWithIntegritas ? 1 : 0, nextRunAt);
  return getAutomationWorkflow(id)!;
}

export function updateAutomationWorkflow(id: string, input: { name?: string; enabled?: boolean; pollingIntervalSeconds?: number; stampWithIntegritas?: boolean }) {
  const current = getAutomationWorkflow(id);
  if (!current) return undefined;
  const enabled = input.enabled ?? Boolean(current.enabled);
  const interval = input.pollingIntervalSeconds ?? current.polling_interval_seconds;
  const nextRunAt = enabled && interval > 0 ? current.next_run_at ?? new Date(Date.now() + interval * 1000).toISOString() : null;
  db.prepare(`
    UPDATE automation_workflows
    SET updated_at = ?, name = ?, enabled = ?, polling_interval_seconds = ?, stamp_with_integritas = ?, next_run_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), input.name ?? current.name, enabled ? 1 : 0, interval, input.stampWithIntegritas === undefined ? current.stamp_with_integritas : input.stampWithIntegritas ? 1 : 0, nextRunAt, id);
  return getAutomationWorkflow(id)!;
}

export function updateAutomationRunSuccess(id: string, input: { hash: string; proofId: string | null; lastError?: string | null }) {
  const current = getAutomationWorkflow(id)!;
  const now = new Date();
  const nextRunAt = current.polling_interval_seconds > 0 ? new Date(now.getTime() + current.polling_interval_seconds * 1000).toISOString() : null;
  db.prepare(`
    UPDATE automation_workflows
    SET updated_at = ?, last_run_at = ?, next_run_at = ?, last_hash = ?, last_proof_id = ?, last_error = ?
    WHERE id = ?
  `).run(now.toISOString(), now.toISOString(), nextRunAt, input.hash, input.proofId, input.lastError ?? null, id);
  return getAutomationWorkflow(id)!;
}

export function updateAutomationRunError(id: string, error: string, input: { hash?: string; proofId?: string | null } = {}) {
  const current = getAutomationWorkflow(id)!;
  const now = new Date();
  const nextRunAt = current.polling_interval_seconds > 0 ? new Date(now.getTime() + current.polling_interval_seconds * 1000).toISOString() : null;
  db.prepare(`
    UPDATE automation_workflows
    SET updated_at = ?, last_run_at = ?, next_run_at = ?, last_hash = COALESCE(?, last_hash), last_proof_id = COALESCE(?, last_proof_id), last_error = ?
    WHERE id = ?
  `).run(now.toISOString(), now.toISOString(), nextRunAt, input.hash ?? null, input.proofId ?? null, error, id);
  return getAutomationWorkflow(id)!;
}

export function deleteAutomationWorkflow(id: string) {
  db.prepare("DELETE FROM automation_workflows WHERE id = ?").run(id);
}
