import type { DeviceMeResult, IntegritasConnectDeviceType } from "./integritas-auth.types.js";
import { getAccountCache } from "./integritas-auth.repository.js";

/** Frontend-safe subset of Connect `/api/me` stored in `integritas_account_cache`. */
export type AccountCachePayload = {
  user: { name: string; email: string };
  plan: { name: string; status: string };
  usage: { remaining: number };
  devices: Array<{
    id: string;
    deviceId: string;
    name: string;
    deviceType: IntegritasConnectDeviceType;
    status: string;
    lastSeenAt: string | null;
    isCurrentDevice: boolean;
  }>;
};

export type CachedAccountProfile = AccountCachePayload & {
  fetchedAt: string;
};

/** Redact /api/me for SQLite cache — never include apiKey or tokens. */
export function sanitizeMeForCache(me: DeviceMeResult): AccountCachePayload {
  return {
    user: { name: me.user.name, email: me.user.email },
    plan: { name: me.plan.name, status: me.plan.status },
    usage: { remaining: me.usage.remaining },
    devices: (me.devices ?? []).map((device) => ({
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      deviceType: device.deviceType,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      isCurrentDevice: device.isCurrentDevice,
    })),
  };
}

export function parseAccountCache(payloadJson: string): AccountCachePayload | null {
  try {
    const payload = JSON.parse(payloadJson) as {
      user?: { name?: string; email?: string };
      plan?: { name?: string; status?: string };
      usage?: { remaining?: number };
      devices?: AccountCachePayload["devices"];
    };
    if (
      !payload?.user?.name ||
      !payload?.user?.email ||
      !payload?.plan?.name ||
      !payload?.plan?.status ||
      typeof payload?.usage?.remaining !== "number"
    ) {
      return null;
    }
    return {
      user: { name: payload.user.name, email: payload.user.email },
      plan: { name: payload.plan.name, status: payload.plan.status },
      usage: { remaining: payload.usage.remaining },
      devices: Array.isArray(payload.devices) ? payload.devices : [],
    };
  } catch {
    return null;
  }
}

/** True when cache JSON includes a devices array. */
export function accountCacheHasDevices(payloadJson: string): boolean {
  try {
    const payload = JSON.parse(payloadJson) as { devices?: unknown };
    return Array.isArray(payload.devices);
  } catch {
    return false;
  }
}

/** Read frontend-safe profile from cache, or null if missing/invalid. */
export function getCachedProfile(): CachedAccountProfile | null {
  const cache = getAccountCache();
  if (!cache) return null;
  const payload = parseAccountCache(cache.payload_json);
  if (!payload) return null;
  return { ...payload, fetchedAt: cache.fetched_at };
}
