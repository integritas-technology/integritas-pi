import Database from "better-sqlite3";
import "../config/loadEnv.js";
import { env } from "../config/env.js";
import { ensureDatabaseDirectory } from "./ensureDatabaseDirectory.js";

ensureDatabaseDirectory(env.databasePath);

export const db = new Database(env.databasePath);
db.pragma("journal_mode = WAL");

export function runMigrations() {
  resetLegacyAutomationSchema();

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
      enabled INTEGER NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT,
      last_hash TEXT,
      last_proof_id TEXT,
      last_error TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_blocks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      last_run_at TEXT,
      last_error TEXT,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
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
      trigger_source_id TEXT,
      trigger_payload_json TEXT,
      block_id TEXT,
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE SET NULL,
      FOREIGN KEY (integritas_proof_id) REFERENCES integritas_proofs(id) ON DELETE SET NULL,
      FOREIGN KEY (block_id) REFERENCES automation_blocks(id) ON DELETE SET NULL
    )
  `);

  ensureColumn("data_source_reads", "trigger_source_id", "TEXT");
  ensureColumn("data_source_reads", "trigger_payload_json", "TEXT");
  ensureColumn("data_source_reads", "block_id", "TEXT");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      totp_secret TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      last_login TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS setup_pending (
      id TEXT PRIMARY KEY,
      totp_secret TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified_at TEXT
    )
  `);

  const setupPendingColumns = db
    .prepare("PRAGMA table_info(setup_pending)")
    .all() as { name: string }[];
  if (!setupPendingColumns.some((column) => column.name === "verified_at")) {
    db.exec("ALTER TABLE setup_pending ADD COLUMN verified_at TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      detail TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      address TEXT NOT NULL UNIQUE,
      mini_address TEXT NOT NULL UNIQUE,
      public_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_send_history (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      from_account_label TEXT,
      from_account_address TEXT,
      to_address TEXT NOT NULL,
      token_id TEXT NOT NULL,
      token_name TEXT NOT NULL,
      amount TEXT NOT NULL,
      txpow_id TEXT,
      status TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_tokens (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      amount TEXT NOT NULL,
      decimal INTEGER NOT NULL,
      txpow_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS address_book (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      address    TEXT NOT NULL UNIQUE,
      notes      TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`DROP TABLE IF EXISTS wallet_accounts`);
}

function resetLegacyAutomationSchema() {
  const workflowColumns = db.prepare("PRAGMA table_info(automation_workflows)").all() as { name: string }[];
  if (!workflowColumns.some((column) => column.name === "data_source_id")) return;

  db.exec(`
    DROP TABLE IF EXISTS data_source_reads;
    DROP TABLE IF EXISTS automation_rules;
    DROP TABLE IF EXISTS automation_blocks;
    DROP TABLE IF EXISTS automation_workflows;
  `);
}

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
