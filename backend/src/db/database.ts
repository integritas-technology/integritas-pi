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
    CREATE INDEX IF NOT EXISTS idx_integritas_proofs_status_created
      ON integritas_proofs(proof_status, created_at);
    CREATE INDEX IF NOT EXISTS idx_integritas_proofs_created
      ON integritas_proofs(created_at);
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
      archived INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      next_run_at TEXT,
      last_hash TEXT,
      last_proof_id TEXT,
      last_error TEXT
    )
  `);

  ensureColumn("automation_workflows", "archived", "INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_blocks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      parent_block_id TEXT,
      config_json TEXT NOT NULL,
      last_run_at TEXT,
      last_error TEXT,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_block_id) REFERENCES automation_blocks(id) ON DELETE CASCADE
    )
  `);

  ensureColumn("automation_blocks", "parent_block_id", "TEXT");

  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_source_id TEXT,
      trigger_payload_json TEXT,
      duration_ms INTEGER,
      block_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_block_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      workflow_id TEXT NOT NULL,
      block_id TEXT,
      order_index INTEGER NOT NULL,
      block_type TEXT NOT NULL,
      block_label TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      input_json TEXT,
      output_json TEXT,
      error TEXT,
      FOREIGN KEY (run_id) REFERENCES automation_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (block_id) REFERENCES automation_blocks(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS data_source_reads (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      data_source_id TEXT,
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
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE SET NULL,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE SET NULL,
      FOREIGN KEY (integritas_proof_id) REFERENCES integritas_proofs(id) ON DELETE SET NULL,
      FOREIGN KEY (block_id) REFERENCES automation_blocks(id) ON DELETE SET NULL
    )
  `);

  ensureColumn("data_source_reads", "trigger_source_id", "TEXT");
  ensureColumn("data_source_reads", "trigger_payload_json", "TEXT");
  ensureColumn("data_source_reads", "block_id", "TEXT");
  migrateDataSourceReadsToPreserveDeletedSources();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_data_source_reads_status_created
      ON data_source_reads(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_data_source_reads_created
      ON data_source_reads(created_at);
  `);

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

  const setupPendingColumns = db.prepare("PRAGMA table_info(setup_pending)").all() as { name: string }[];
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS integritas_device (
      id TEXT PRIMARY KEY DEFAULT 'default',
      device_id TEXT NOT NULL UNIQUE,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS integritas_activation (
      id TEXT PRIMARY KEY DEFAULT 'current',
      activation_id TEXT,
      user_code TEXT,
      verification_url TEXT,
      status TEXT NOT NULL,
      expires_at TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS integritas_auth (
      id TEXT PRIMARY KEY DEFAULT 'default',
      connected_device_id TEXT,
      integritas_user_id TEXT,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      api_key_enc TEXT,
      token_expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS integritas_account_cache (
      id TEXT PRIMARY KEY DEFAULT 'default',
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    SELECT 'setup.completed_at', auth.updated_at, CURRENT_TIMESTAMP
    FROM integritas_auth AS auth
    WHERE auth.id = 'default'
      AND EXISTS (SELECT 1 FROM users)
    LIMIT 1
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

function migrateDataSourceReadsToPreserveDeletedSources() {
  const columns = db.prepare("PRAGMA table_info(data_source_reads)").all() as { name: string; notnull: number }[];
  const dataSourceIdColumn = columns.find((column) => column.name === "data_source_id");
  const foreignKeys = db.prepare("PRAGMA foreign_key_list(data_source_reads)").all() as { from: string; table: string; on_delete: string }[];
  const dataSourceForeignKey = foreignKeys.find((key) => key.from === "data_source_id" && key.table === "data_sources");

  if (dataSourceIdColumn?.notnull !== 1 && dataSourceForeignKey?.on_delete?.toUpperCase() !== "CASCADE") return;

  const foreignKeysEnabled = db.pragma("foreign_keys", { simple: true }) as number;
  db.pragma("foreign_keys = OFF");

  try {
    db.exec(`
    DROP TABLE IF EXISTS data_source_reads_new;

    CREATE TABLE data_source_reads_new (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      data_source_id TEXT,
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
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE SET NULL,
      FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE SET NULL,
      FOREIGN KEY (integritas_proof_id) REFERENCES integritas_proofs(id) ON DELETE SET NULL,
      FOREIGN KEY (block_id) REFERENCES automation_blocks(id) ON DELETE SET NULL
    );

    INSERT INTO data_source_reads_new (
      id, created_at, data_source_id, workflow_id, integritas_proof_id, source_name, source_url,
      trigger_type, status, hash, preview_json, error, trigger_source_id, trigger_payload_json, block_id
    )
    SELECT
      id, created_at, data_source_id, workflow_id, integritas_proof_id, source_name, source_url,
      trigger_type, status, hash, preview_json, error, trigger_source_id, trigger_payload_json, block_id
    FROM data_source_reads;

    DROP TABLE data_source_reads;
    ALTER TABLE data_source_reads_new RENAME TO data_source_reads;
  `);
  } finally {
    db.pragma(`foreign_keys = ${foreignKeysEnabled ? "ON" : "OFF"}`);
  }
}
