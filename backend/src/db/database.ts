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
}
