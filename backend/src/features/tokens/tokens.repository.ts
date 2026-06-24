import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { CustomTokenRecord } from "./tokens.types.js";

export function insertCustomToken(input: {
  tokenId: string;
  name: string;
  amount: string;
  decimal: number;
  txpowId: string | null;
}): CustomTokenRecord {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO custom_tokens (id, token_id, name, amount, decimal, txpow_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.tokenId, input.name, input.amount, input.decimal, input.txpowId, createdAt);
  return getCustomTokenByTokenId(input.tokenId)!;
}

export function listCustomTokens(): CustomTokenRecord[] {
  return db.prepare(`
    SELECT id, token_id, name, amount, decimal, txpow_id, created_at
    FROM custom_tokens
    ORDER BY datetime(created_at) DESC
  `).all() as CustomTokenRecord[];
}

export function getCustomTokenByTokenId(tokenId: string): CustomTokenRecord | null {
  const row = db.prepare(`
    SELECT id, token_id, name, amount, decimal, txpow_id, created_at
    FROM custom_tokens
    WHERE token_id = ?
    LIMIT 1
  `).get(tokenId.trim()) as CustomTokenRecord | undefined;
  return row ?? null;
}
