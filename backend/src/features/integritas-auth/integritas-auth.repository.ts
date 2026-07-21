import { db } from "../../db/database.js";

export type IntegritasActivationRow = {
  id: string;
  activation_id: string | null;
  user_code: string | null;
  verification_url: string | null;
  status: string;
  expires_at: string | null;
  started_at: string;
  updated_at: string;
};

export type IntegritasAuthRow = {
  id: string;
  connected_device_id: string | null;
  integritas_user_id: string | null;
  access_token_enc: string;
  refresh_token_enc: string;
  api_key_enc: string | null;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type IntegritasAccountCacheRow = {
  id: string;
  payload_json: string;
  fetched_at: string;
};

export function getActivation(): IntegritasActivationRow | undefined {
  return db
    .prepare(
      `SELECT id, activation_id, user_code, verification_url, status, expires_at, started_at, updated_at
       FROM integritas_activation WHERE id = 'current'`,
    )
    .get() as IntegritasActivationRow | undefined;
}

export function upsertActivation(input: {
  activationId: string;
  userCode: string;
  verificationUrl: string;
  status: string;
  expiresAt: string;
}): void {
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO integritas_activation (
      id, activation_id, user_code, verification_url, status, expires_at, started_at, updated_at
    ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      activation_id = excluded.activation_id,
      user_code = excluded.user_code,
      verification_url = excluded.verification_url,
      status = excluded.status,
      expires_at = excluded.expires_at,
      started_at = excluded.started_at,
      updated_at = excluded.updated_at
  `,
  ).run(input.activationId, input.userCode, input.verificationUrl, input.status, input.expiresAt, now, now);
}

export function updateActivationStatus(status: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE integritas_activation SET status = ?, updated_at = ? WHERE id = 'current'`).run(status, now);
}

export function clearActivation(): void {
  db.prepare(`DELETE FROM integritas_activation WHERE id = 'current'`).run();
}

export function getIntegritasAuth(): IntegritasAuthRow | undefined {
  return db
    .prepare(
      `SELECT id, connected_device_id, integritas_user_id, access_token_enc, refresh_token_enc,
              api_key_enc, token_expires_at, created_at, updated_at
       FROM integritas_auth WHERE id = 'default'`,
    )
    .get() as IntegritasAuthRow | undefined;
}

export function upsertIntegritasAuth(input: {
  connectedDeviceId: string | null;
  integritasUserId: string | null;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  apiKeyEnc: string | null;
  tokenExpiresAt: string;
}): void {
  const now = new Date().toISOString();
  const existing = getIntegritasAuth();
  const createdAt = existing?.created_at ?? now;

  db.prepare(
    `
    INSERT INTO integritas_auth (
      id, connected_device_id, integritas_user_id, access_token_enc, refresh_token_enc,
      api_key_enc, token_expires_at, created_at, updated_at
    ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      connected_device_id = excluded.connected_device_id,
      integritas_user_id = excluded.integritas_user_id,
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      api_key_enc = excluded.api_key_enc,
      token_expires_at = excluded.token_expires_at,
      updated_at = excluded.updated_at
  `,
  ).run(
    input.connectedDeviceId,
    input.integritasUserId,
    input.accessTokenEnc,
    input.refreshTokenEnc,
    input.apiKeyEnc,
    input.tokenExpiresAt,
    createdAt,
    now,
  );
}

export function clearIntegritasAuth(): void {
  db.prepare(`DELETE FROM integritas_auth WHERE id = 'default'`).run();
}

export function getAccountCache(): IntegritasAccountCacheRow | undefined {
  return db.prepare(`SELECT id, payload_json, fetched_at FROM integritas_account_cache WHERE id = 'default'`).get() as
    | IntegritasAccountCacheRow
    | undefined;
}

export function upsertAccountCache(payloadJson: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO integritas_account_cache (id, payload_json, fetched_at)
    VALUES ('default', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at
  `,
  ).run(payloadJson, now);
}

export function clearAccountCache(): void {
  db.prepare(`DELETE FROM integritas_account_cache WHERE id = 'default'`).run();
}

export function clearIntegritasConnectState(): void {
  const clear = db.transaction(() => {
    clearIntegritasAuth();
    clearActivation();
    clearAccountCache();
  });
  clear();
}

/** Wipe tokens/cache and leave a terminal `revoked` activation marker for status UI. */
export function markConnectRevoked(): void {
  const mark = db.transaction(() => {
    clearIntegritasAuth();
    clearAccountCache();
    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO integritas_activation (
        id, activation_id, user_code, verification_url, status, expires_at, started_at, updated_at
      ) VALUES ('current', NULL, NULL, NULL, 'revoked', NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        activation_id = NULL,
        user_code = NULL,
        verification_url = NULL,
        status = 'revoked',
        expires_at = NULL,
        updated_at = excluded.updated_at
    `,
    ).run(now, now);
  });
  mark();
}
