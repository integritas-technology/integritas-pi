import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { ParsedListQuery } from "../../shared/list-query.js";

export type DataSourceReadRecord = {
  id: string;
  created_at: string;
  data_source_id: string;
  workflow_id: string | null;
  integritas_proof_id: string | null;
  source_name: string;
  source_url: string;
  trigger_type: string;
  status: string;
  hash: string | null;
  preview_json: string | null;
  error: string | null;
};

export const DATA_READ_LIST_STATUSES = ["success", "failed"] as const;

export type DataReadListQuery = ParsedListQuery;

function buildDataReadListWhere(query: Pick<DataReadListQuery, "status" | "q">) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    clauses.push("status = ?");
    params.push(query.status);
  }

  if (query.q) {
    const like = `%${query.q}%`;
    clauses.push("(hash LIKE ? OR source_name LIKE ? OR source_url LIKE ?)");
    params.push(like, like, like);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function countDataSourceReads(query: Pick<DataReadListQuery, "status" | "q"> = {}) {
  const { where, params } = buildDataReadListWhere(query);
  const row = db.prepare(`SELECT COUNT(*) as count FROM data_source_reads ${where}`).get(...params) as { count: number };
  return row.count;
}

export function listDataSourceReads(query: DataReadListQuery) {
  const { where, params } = buildDataReadListWhere(query);
  const offset = (query.page - 1) * query.pageSize;
  return db.prepare(`
    SELECT * FROM data_source_reads
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, query.pageSize, offset) as DataSourceReadRecord[];
}

export function getDataSourceRead(id: string) {
  return db.prepare("SELECT * FROM data_source_reads WHERE id = ?").get(id) as DataSourceReadRecord | undefined;
}

export function createDataSourceRead(input: { dataSourceId: string; workflowId?: string | null; sourceName: string; sourceUrl: string; triggerType: "manual" | "automation" | "webhook" | "mqtt" | "gpio"; status: "success" | "failed"; hash?: string | null; preview?: unknown; error?: string | null }) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO data_source_reads (id, created_at, data_source_id, workflow_id, source_name, source_url, trigger_type, status, hash, preview_json, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, new Date().toISOString(), input.dataSourceId, input.workflowId ?? null, input.sourceName, input.sourceUrl, input.triggerType, input.status, input.hash ?? null, input.preview === undefined ? null : JSON.stringify(input.preview), input.error ?? null);
  return getDataSourceRead(id)!;
}

export function linkDataSourceReadProof(id: string, proofId: string) {
  db.prepare("UPDATE data_source_reads SET integritas_proof_id = ? WHERE id = ?").run(proofId, id);
  return getDataSourceRead(id)!;
}
