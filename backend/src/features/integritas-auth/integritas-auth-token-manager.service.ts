import { recordAuditEvent } from "../auth/audit.service.js";
import { sanitizeMeForCache } from "./integritas-auth-account-cache.js";
import { IntegritasConnectError, getMe, refreshToken } from "./integritas-auth-client.service.js";
import { decryptIntegritasToken, encryptIntegritasToken } from "./integritas-auth-crypto.service.js";
import { getOrCreateDevice } from "./integritas-auth-device-identity.service.js";
import {
  clearIntegritasConnectState,
  getIntegritasAuth,
  markConnectRevoked,
  upsertAccountCache,
  upsertIntegritasAuth,
  type IntegritasAuthRow,
} from "./integritas-auth.repository.js";

/** Refresh access token when within this window of expiry. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export const TOKEN_DECRYPT_FAILED = "TOKEN_DECRYPT_FAILED";

const TOKEN_DECRYPT_FAILED_MESSAGE = "Local secrets were reset or changed. Connect your Integritas account again.";

export type GetValidAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; status: "unauthenticated" | "revoked" };

/** In-flight refresh so concurrent callers share one Connect `/api/token/refresh` (rotation + reuse detection). */
let refreshInFlight: Promise<GetValidAccessTokenResult> | null = null;

export class IntegritasTokenManagerError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.name = "IntegritasTokenManagerError";
    this.status = status;
    this.code = code;
  }
}

function isDeviceRevoked(error: unknown): boolean {
  return error instanceof IntegritasConnectError && error.status === 401 && error.code === "DEVICE_REVOKED";
}

function onDeviceRevoked(): GetValidAccessTokenResult {
  markConnectRevoked();
  recordAuditEvent("integritas.revoked", { detail: "DEVICE_REVOKED" });
  return { ok: false, status: "revoked" };
}

/**
 * APP_SECRET changed (or ciphertext corrupt): clears local Integritas Cloud Connect link only.
 */
export function onTokenDecryptFailed(): never {
  clearIntegritasConnectState();
  recordAuditEvent("integritas.local_secret_mismatch", { detail: TOKEN_DECRYPT_FAILED });
  throw new IntegritasTokenManagerError(TOKEN_DECRYPT_FAILED_MESSAGE, 403, TOKEN_DECRYPT_FAILED);
}

export function assertStoredTokensDecryptable(auth: IntegritasAuthRow): void {
  try {
    decryptIntegritasToken(auth.access_token_enc);
    decryptIntegritasToken(auth.refresh_token_enc);
  } catch {
    onTokenDecryptFailed();
  }
}

async function storeRotatedTokens(
  auth: IntegritasAuthRow,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  },
): Promise<string> {
  const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

  upsertIntegritasAuth({
    connectedDeviceId: auth.connected_device_id,
    integritasUserId: auth.integritas_user_id,
    accessTokenEnc: encryptIntegritasToken(tokens.accessToken),
    refreshTokenEnc: encryptIntegritasToken(tokens.refreshToken),
    apiKeyEnc: auth.api_key_enc,
    tokenExpiresAt,
  });

  try {
    const me = await getMe(tokens.accessToken);
    const apiKeyEnc = me.apiKey?.id ? encryptIntegritasToken(me.apiKey.id) : auth.api_key_enc;
    upsertIntegritasAuth({
      connectedDeviceId: auth.connected_device_id,
      integritasUserId: me.user.id ?? auth.integritas_user_id,
      accessTokenEnc: encryptIntegritasToken(tokens.accessToken),
      refreshTokenEnc: encryptIntegritasToken(tokens.refreshToken),
      apiKeyEnc,
      tokenExpiresAt,
    });
    upsertAccountCache(JSON.stringify(sanitizeMeForCache(me)));
  } catch (error) {
    if (isDeviceRevoked(error)) {
      throw error;
    }
  }

  return tokens.accessToken;
}

async function refreshStoredTokens(auth: IntegritasAuthRow): Promise<GetValidAccessTokenResult> {
  const device = getOrCreateDevice();
  let refreshTokenPlain: string;
  try {
    refreshTokenPlain = decryptIntegritasToken(auth.refresh_token_enc);
  } catch {
    onTokenDecryptFailed();
  }

  let tokens;
  try {
    tokens = await refreshToken({
      refreshToken: refreshTokenPlain,
      deviceId: device.deviceId,
    });
  } catch (error) {
    if (isDeviceRevoked(error)) {
      return onDeviceRevoked();
    }
    if (error instanceof IntegritasConnectError) {
      throw new IntegritasTokenManagerError(error.message, error.status, error.code);
    }
    throw error;
  }

  try {
    const accessToken = await storeRotatedTokens(auth, tokens);
    recordAuditEvent("integritas.token.refreshed");
    return { ok: true, accessToken };
  } catch (error) {
    if (isDeviceRevoked(error)) {
      return onDeviceRevoked();
    }
    throw error;
  }
}

/** Usable Integritas Cloud Connect access token; refreshes within 5 min of expiry. Handles revoke + decrypt failure. */
export async function getValidAccessToken(): Promise<GetValidAccessTokenResult> {
  const auth = getIntegritasAuth();
  if (!auth?.access_token_enc || !auth.refresh_token_enc) {
    return { ok: false, status: "unauthenticated" };
  }

  const expiresAtMs = Date.parse(auth.token_expires_at);
  const needsRefresh = !Number.isFinite(expiresAtMs) || expiresAtMs - Date.now() <= REFRESH_SKEW_MS;

  if (!needsRefresh) {
    try {
      return { ok: true, accessToken: decryptIntegritasToken(auth.access_token_enc) };
    } catch {
      onTokenDecryptFailed();
    }
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = refreshStoredTokens(auth).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
