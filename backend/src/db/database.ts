import Database from "better-sqlite3";
import { env } from "../config/env.js";

export const db = new Database(env.databasePath);

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS integritas_proofs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      hash TEXT NOT NULL,
      proof_uid TEXT,
      proof_status TEXT NOT NULL,
      proof_payload TEXT,
      status_response TEXT,
      verify_response TEXT,
      proof_error TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      config TEXT NOT NULL,
      last_read_at TEXT,
      last_error TEXT,
      last_preview TEXT,
      last_hash TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_workflows (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      data_source_id TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      polling_interval_seconds INTEGER NOT NULL,
      stamp_with_integritas INTEGER NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT,
      last_hash TEXT,
      last_proof_id TEXT,
      last_error TEXT,
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS data_source_reads (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      data_source_id TEXT NOT NULL,
      workflow_id TEXT,
      integritas_proof_id TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      hash TEXT,
      preview_json TEXT,
      error TEXT,
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE SET NULL,
      FOREIGN KEY (integritas_proof_id) REFERENCES integritas_proofs(id) ON DELETE SET NULL
    )
  `);
}
