import { recordAuditEvent } from "../auth/audit.service.js";
import { markSetupComplete } from "../auth/setup.service.js";
import {
  accountCacheHasDevices,
  getCachedProfile,
  sanitizeMeForCache,
  type AccountCachePayload,
  type CachedAccountProfile,
} from "./integritas-auth-account-cache.js";
import {
  IntegritasConnectError,
  getActivationStatus,
  getMe,
  startActivation,
} from "./integritas-auth-client.service.js";
import { encryptIntegritasToken } from "./integritas-auth-crypto.service.js";
import { getOrCreateDevice } from "./integritas-auth-device-identity.service.js";
import {
  clearActivation,
  getAccountCache,
  getActivation,
  getIntegritasAuth,
  markConnectRevoked,
  updateActivationStatus,
  upsertAccountCache,
  upsertActivation,
  upsertIntegritasAuth,
} from "./integritas-auth.repository.js";
import {
  assertStoredTokensDecryptable,
  getValidAccessToken,
  IntegritasTokenManagerError,
  TOKEN_DECRYPT_FAILED,
} from "./integritas-auth-token-manager.service.js";
import type { DeviceMeResult } from "./integritas-auth.types.js";

export type IntegritasConnectedProfile = {
  user: { name: string; email: string };
  plan: { name: string; status: string };
  usage: { remaining: number };
  fetchedAt: string;
};

export type IntegritasAuthStatus =
  | { status: "unauthenticated" }
  | {
      status: "pending";
      userCode: string;
      verificationUrl: string;
      expiresAt: string;
    }
  | ({ status: "connected" } & Partial<IntegritasConnectedProfile>)
  | { status: "denied" | "expired" | "revoked" };

export type StartConnectResult = {
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  status: "pending";
};

export type UserProfileData = AccountCachePayload & {
  fetchedAt: string;
  /** True when a refresh was requested but Connect was unreachable and cache was returned. */
  stale?: boolean;
};

export class IntegritasAuthServiceError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.name = "IntegritasAuthServiceError";
    this.status = status;
    this.code = code;
  }
}

function connectedStatusFromProfile(profile: CachedAccountProfile): IntegritasAuthStatus {
  return {
    status: "connected",
    user: profile.user,
    plan: profile.plan,
    usage: profile.usage,
    fetchedAt: profile.fetchedAt,
  };
}

/**
 * Local Connect link status from stored auth (+ account cache for profile fields).
 * @returns connected status payload, or null if not linked.
 */
function connectedFromStoredAuth(): IntegritasAuthStatus | null {
  const auth = getIntegritasAuth();
  if (!auth) return null;

  try {
    assertStoredTokensDecryptable(auth);
  } catch (error) {
    if (error instanceof IntegritasTokenManagerError && error.code === TOKEN_DECRYPT_FAILED) {
      throw new IntegritasAuthServiceError(error.message, error.status, error.code);
    }
    throw error;
  }

  markSetupComplete();
  const payload = getCachedProfile();
  if (payload) return connectedStatusFromProfile(payload);

  // Linked, but /api/me has not populated cache yet — never invent empty name/plan/usage.
  return { status: "connected" };
}

/**
 * Complete the approved activation.
 * @param input access token, refresh token, expires in, and connected device ID.
 * @returns user, plan, and usage.
 */
async function completeApprovedActivation(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  connectedDeviceId: string;
}): Promise<IntegritasAuthStatus> {
  const tokenExpiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString();
  const accessTokenEnc = encryptIntegritasToken(input.accessToken);
  const refreshTokenEnc = encryptIntegritasToken(input.refreshToken);

  upsertIntegritasAuth({
    connectedDeviceId: input.connectedDeviceId,
    integritasUserId: null,
    accessTokenEnc,
    refreshTokenEnc,
    apiKeyEnc: null,
    tokenExpiresAt,
  });
  clearActivation();

  try {
    const me = await getMe(input.accessToken);
    const apiKeyEnc = me.apiKey?.id ? encryptIntegritasToken(me.apiKey.id) : null;
    const cachePayload = sanitizeMeForCache(me);

    upsertIntegritasAuth({
      connectedDeviceId: input.connectedDeviceId,
      integritasUserId: me.user.id,
      accessTokenEnc,
      refreshTokenEnc,
      apiKeyEnc,
      tokenExpiresAt,
    });
    upsertAccountCache(JSON.stringify(cachePayload));
    markSetupComplete();

    const cached = getCachedProfile();
    if (cached) return connectedStatusFromProfile(cached);

    return {
      status: "connected",
      user: cachePayload.user,
      plan: cachePayload.plan,
      usage: cachePayload.usage,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof IntegritasConnectError && error.status === 401 && error.code === "DEVICE_REVOKED") {
      markConnectRevoked();
      recordAuditEvent("integritas.revoked", { detail: "DEVICE_REVOKED" });
      return { status: "revoked" };
    }
    // Tokens already saved; profile can retry via getUserProfile().
    markSetupComplete();
    return { status: "connected" };
  }
}

/** Start Integritas Connect activation. Never returns tokens. */
export async function startConnectActivation(deviceName?: string): Promise<StartConnectResult> {
  const device = getOrCreateDevice();
  const name = deviceName?.trim() || device.deviceName;

  let result;
  try {
    result = await startActivation({
      deviceId: device.deviceId,
      deviceName: name,
      deviceType: device.deviceType,
    });
  } catch (error) {
    if (error instanceof IntegritasConnectError) {
      throw new IntegritasAuthServiceError(error.message, error.status, error.code);
    }
    throw error;
  }

  upsertActivation({
    activationId: result.activationId,
    userCode: result.userCode,
    verificationUrl: result.verificationUrl,
    status: "pending",
    expiresAt: result.expiresAt,
  });

  return {
    userCode: result.userCode,
    verificationUrl: result.verificationUrl,
    expiresAt: result.expiresAt,
    status: "pending",
  };
}

/** Poll Integritas Connect link status. Never returns tokens. */
export async function getIntegritasAuthStatus(): Promise<IntegritasAuthStatus> {
  const connected = connectedFromStoredAuth();
  if (connected) return connected;

  const activation = getActivation();
  if (!activation) {
    return { status: "unauthenticated" };
  }

  if (activation.status === "denied" || activation.status === "expired" || activation.status === "revoked") {
    return { status: activation.status };
  }

  if (!activation.activation_id || activation.status !== "pending") {
    return { status: "unauthenticated" };
  }

  const device = getOrCreateDevice();

  let remote;
  try {
    remote = await getActivationStatus({
      activationId: activation.activation_id,
      deviceId: device.deviceId,
    });
  } catch (error) {
    if (error instanceof IntegritasConnectError) {
      throw new IntegritasAuthServiceError(error.message, error.status, error.code);
    }
    throw error;
  }

  if (remote.status === "pending") {
    return {
      status: "pending",
      userCode: activation.user_code ?? "",
      verificationUrl: activation.verification_url ?? "",
      expiresAt: remote.expiresAt || activation.expires_at || "",
    };
  }

  if (remote.status === "approved") {
    return completeApprovedActivation({
      accessToken: remote.tokens.accessToken,
      refreshToken: remote.tokens.refreshToken,
      expiresIn: remote.tokens.expiresIn,
      connectedDeviceId: remote.device.id,
    });
  }

  if (remote.status === "denied" || remote.status === "expired") {
    updateActivationStatus(remote.status);
    return { status: remote.status };
  }

  // Tokens already consumed on Integritas Cloud Connect — another poll may have persisted them already.
  if (remote.status === "connected") {
    const localConnected = connectedFromStoredAuth();
    clearActivation();
    return localConnected ?? { status: "unauthenticated" };
  }

  return { status: "unauthenticated" };
}

function profileFromCacheRow(): UserProfileData | null {
  const cacheRow = getAccountCache();
  if (!cacheRow || !accountCacheHasDevices(cacheRow.payload_json)) return null;
  const cached = getCachedProfile();
  if (!cached) return null;
  return cached;
}

/**
 * Fetch and cache the Integritas Cloud profile.
 * @param accessToken access token for the request.
 * @returns user, plan, and usage.
 */
async function fetchAndCacheProfile(accessToken: string): Promise<UserProfileData> {
  let me: DeviceMeResult;
  try {
    me = await getMe(accessToken);
  } catch (error) {
    if (error instanceof IntegritasConnectError && error.status === 401 && error.code === "DEVICE_REVOKED") {
      markConnectRevoked();
      recordAuditEvent("integritas.revoked", { detail: "DEVICE_REVOKED" });
      throw new IntegritasAuthServiceError("Integritas device was revoked", 403, "DEVICE_REVOKED");
    }
    if (error instanceof IntegritasConnectError) {
      throw new IntegritasAuthServiceError(error.message, error.status, error.code);
    }
    throw error;
  }

  const auth = getIntegritasAuth();
  const cachePayload = sanitizeMeForCache(me);
  const apiKeyEnc = me.apiKey?.id ? encryptIntegritasToken(me.apiKey.id) : (auth?.api_key_enc ?? null);

  if (auth) {
    upsertIntegritasAuth({
      connectedDeviceId: auth.connected_device_id,
      integritasUserId: me.user.id ?? auth.integritas_user_id,
      accessTokenEnc: auth.access_token_enc,
      refreshTokenEnc: auth.refresh_token_enc,
      apiKeyEnc,
      tokenExpiresAt: auth.token_expires_at,
    });
  }
  upsertAccountCache(JSON.stringify(cachePayload));
  const cached = getCachedProfile();
  if (!cached) {
    throw new IntegritasAuthServiceError("Failed to read account cache after profile refresh", 500);
  }
  return cached;
}

function isFatalProfileError(error: unknown): boolean {
  return (
    error instanceof IntegritasAuthServiceError &&
    (error.code === "DEVICE_REVOKED" || error.code === TOKEN_DECRYPT_FAILED)
  );
}

/**
 * Get the frontend-safe Integritas Cloud profile from the cache.
 * @param options refresh option pass `true` to always re-fetch Integritas Cloud `/api/me` and rewrite the cache
 * @returns user, plan, and usage.
 */
export async function getUserProfile(options?: { refresh?: boolean }): Promise<UserProfileData> {
  let tokenResult;
  try {
    tokenResult = await getValidAccessToken();
  } catch (error) {
    if (error instanceof IntegritasTokenManagerError) {
      throw new IntegritasAuthServiceError(error.message, error.status, error.code);
    }
    throw error;
  }

  if (!tokenResult.ok) {
    if (tokenResult.status === "revoked") {
      throw new IntegritasAuthServiceError("Integritas device was revoked", 403, "DEVICE_REVOKED");
    }
    throw new IntegritasAuthServiceError("Integritas account not linked", 404, "NOT_CONNECTED");
  }

  if (!options?.refresh) {
    const cached = profileFromCacheRow();
    if (cached) return cached;
    return fetchAndCacheProfile(tokenResult.accessToken);
  }

  try {
    return await fetchAndCacheProfile(tokenResult.accessToken);
  } catch (error) {
    if (isFatalProfileError(error)) throw error;
    const cached = profileFromCacheRow();
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}
