import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { UserRecord } from "./auth.types.js";

export function countUsers() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  return row.count;
}

export function findUserByUsername(username: string): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRecord | undefined;
}

export function findUserById(id: string): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function createUser(input: {
  username: string;
  passwordHash: string;
  totpSecretEncrypted: string;
  role?: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, password, totp_secret, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.username, input.passwordHash, input.totpSecretEncrypted, input.role ?? "admin", now);
  return id;
}

export function updateUserLastLogin(userId: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now, userId);
}

export function createSessionRow(input: {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.userId, input.tokenHash, now, input.expiresAt, now);
}

export function findSessionByTokenHash(tokenHash: string) {
  return db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(tokenHash) as
    | {
        id: string;
        user_id: string;
        token_hash: string;
        created_at: string;
        expires_at: string;
        last_seen_at: string;
      }
    | undefined;
}

export function updateSessionLastSeen(sessionId: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now, sessionId);
}

export function deleteSessionByTokenHash(tokenHash: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteAllUserSessions(userId: string) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function deleteExpiredSessions() {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
}

export function deleteExpiredSetupPending() {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM setup_pending WHERE expires_at < ?").run(now);
}

export function clearSetupPending() {
  db.prepare("DELETE FROM setup_pending").run();
}

export function createSetupPending(totpSecretEncrypted: string, expiresAt: string) {
  deleteExpiredSetupPending();
  clearSetupPending();
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO setup_pending (id, totp_secret, expires_at) VALUES (?, ?, ?)").run(
    id,
    totpSecretEncrypted,
    expiresAt
  );
  return id;
}

export function getLatestSetupPending() {
  deleteExpiredSetupPending();
  return db.prepare("SELECT * FROM setup_pending ORDER BY expires_at DESC LIMIT 1").get() as
    | { id: string; totp_secret: string; expires_at: string }
    | undefined;
}

export function insertAuditEvent(input: { userId?: string | null; action: string; detail?: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO audit_events (id, created_at, user_id, action, detail) VALUES (?, ?, ?, ?, ?)").run(
    id,
    now,
    input.userId ?? null,
    input.action,
    input.detail ?? null
  );
}
