import crypto from "node:crypto";
import { db } from "../../db/database.js";

export type DataSourceRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  config: string;
  last_read_at: string | null;
  last_error: string | null;
  last_preview: string | null;
  last_hash: string | null;
};

export function listDataSources() {
  return db.prepare("SELECT * FROM data_sources ORDER BY created_at DESC").all() as DataSourceRecord[];
}

export function findWebhookDataSource(token: string) {
  return listDataSources().find((record) => {
    if (record.type !== "webhook") return false;
    try {
      const config = JSON.parse(record.config) as { webhookToken?: string };
      return config.webhookToken === token;
    } catch {
      return false;
    }
  });
}

export function getDataSource(id: string) {
  return db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id) as DataSourceRecord | undefined;
}

export function createDataSource(input: { name: string; type: string; description?: string; config: unknown }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO data_sources (id, created_at, updated_at, name, type, status, description, config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, now, now, input.name, input.type, "active", input.description ?? null, JSON.stringify(input.config));
  return getDataSource(id)!;
}

export function updateDataSource(id: string, input: { name: string; type: string; description?: string; config: unknown }) {
  db.prepare(`
    UPDATE data_sources
    SET updated_at = ?, name = ?, type = ?, description = ?, config = ?
    WHERE id = ?
  `).run(new Date().toISOString(), input.name, input.type, input.description ?? null, JSON.stringify(input.config), id);
  return getDataSource(id);
}

export function deleteDataSource(id: string) {
  db.prepare("DELETE FROM data_sources WHERE id = ?").run(id);
}

export function updateDataSourceReadResult(id: string, input: { hash?: string; preview?: unknown; error?: string | null }) {
  db.prepare(`
    UPDATE data_sources
    SET updated_at = ?, last_read_at = ?, last_error = ?, last_preview = ?, last_hash = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), input.error ?? null, input.preview === undefined ? null : JSON.stringify(input.preview), input.hash ?? null, id);
  return getDataSource(id)!;
}
