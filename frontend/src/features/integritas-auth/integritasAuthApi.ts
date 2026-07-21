import { getJson, postJson } from "../../lib/api";

export type IntegritasAuthStatusKind = "unauthenticated" | "pending" | "connected" | "denied" | "expired" | "revoked";

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

export type IntegritasStartConnectResult = {
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  status: "pending";
};

export type IntegritasUserProfile = {
  user: { name: string; email: string };
  plan: { name: string; status: string };
  usage: { remaining: number };
  devices: Array<{
    id: string;
    deviceId: string;
    name: string;
    deviceType: string;
    status: string;
    lastSeenAt: string | null;
    isCurrentDevice: boolean;
  }>;
  fetchedAt: string;
  stale?: boolean;
};

type ApiEnvelope<T> = { success: boolean; data: T };

export function hasConnectedProfile(
  status: Extract<IntegritasAuthStatus, { status: "connected" }>,
): status is { status: "connected" } & IntegritasConnectedProfile {
  return Boolean(status.user && status.plan && status.usage && status.fetchedAt);
}

export async function getIntegritasAuthStatus() {
  const res = await getJson<ApiEnvelope<IntegritasAuthStatus>>("/api/auth/connect/status");
  return res.data;
}

export async function startIntegritasConnect(deviceName?: string) {
  const res = await postJson<ApiEnvelope<IntegritasStartConnectResult>>("/api/auth/connect/start", {
    ...(deviceName ? { deviceName } : {}),
  });
  return res.data;
}

export async function getIntegritasUserProfile(options?: { refresh?: boolean }) {
  const qs = options?.refresh ? "?refresh=1" : "";
  const res = await getJson<ApiEnvelope<IntegritasUserProfile>>(`/api/user/profile${qs}`);
  return res.data;
}
