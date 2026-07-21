import { env } from "../../config/env.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import type {
  ActivationStatusInput,
  ActivationStatusResult,
  DeviceMeResult,
  RefreshTokenInput,
  RefreshTokenResult,
  StartActivationInput,
  StartActivationResult,
} from "./integritas-auth.types.js";

type ConnectSuccessBody<T> = {
  success: true;
  data: T;
};

type ConnectErrorBody = {
  success: false;
  message?: string;
  code?: string;
};

export class IntegritasConnectError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "IntegritasConnectError";
    this.status = status;
    this.code = code;
  }
}

function connectBaseUrl() {
  return env.integritasConnectBaseUrl.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function connectRequest<T>(input: {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  accessToken?: string;
}): Promise<T> {
  const url = new URL(`${connectBaseUrl()}${input.path}`);
  if (input.query) {
    for (const [key, value] of Object.entries(input.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (input.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (input.accessToken) {
    headers.Authorization = `Bearer ${input.accessToken}`;
  }

  let response: Response;
  let body: unknown;
  try {
    const result = await fetchJsonWithTimeout(
      url.toString(),
      {
        method: input.method,
        headers,
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      },
      env.integritasRequestTimeoutMs,
    );
    response = result.response;
    body = result.body;
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Integritas Connect request timed out"
        : error instanceof Error
          ? error.message
          : "Integritas Connect request failed";
    throw new IntegritasConnectError(message, 502);
  }

  if (isRecord(body) && body.success === false) {
    const err = body as ConnectErrorBody;
    throw new IntegritasConnectError(
      err.message?.trim() || "Integritas Connect request failed",
      response.status || 502,
      err.code,
    );
  }

  if (!response.ok) {
    throw new IntegritasConnectError(`Integritas Connect returned HTTP ${response.status}`, response.status);
  }

  if (!isRecord(body) || body.success !== true || !("data" in body)) {
    throw new IntegritasConnectError("Integritas Connect returned an unexpected response", response.status || 502);
  }

  return (body as ConnectSuccessBody<T>).data;
}

/** POST /api/device/start — no Connect auth. */
export async function startActivation(input: StartActivationInput): Promise<StartActivationResult> {
  const data = await connectRequest<StartActivationResult>({
    method: "POST",
    path: "/api/device/start",
    body: {
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      deviceType: input.deviceType,
    },
  });

  if (
    !readString(data?.activationId) ||
    !readString(data?.userCode) ||
    !readString(data?.verificationUrl) ||
    !readString(data?.expiresAt)
  ) {
    throw new IntegritasConnectError("Integritas Connect start response missing required fields", 502);
  }

  return {
    activationId: data.activationId,
    userCode: data.userCode,
    verificationUrl: data.verificationUrl,
    expiresAt: data.expiresAt,
    pollIntervalSeconds: readNumber(data.pollIntervalSeconds) ?? env.integritasDevicePollIntervalSeconds,
  };
}

/**
 * Poll the activation status for a given device.
 * @param input activation ID and device ID.
 * @returns activation status result with one-time tokens when approved.
 */
export async function getActivationStatus(input: ActivationStatusInput): Promise<ActivationStatusResult> {
  const data = await connectRequest<Record<string, unknown>>({
    method: "GET",
    path: "/api/device/status",
    query: {
      activationId: input.activationId,
      deviceId: input.deviceId,
    },
  });

  const status = readString(data.status);
  if (!status) {
    throw new IntegritasConnectError("Integritas Connect status response missing status", 502);
  }

  if (status === "pending") {
    const expiresAt = readString(data.expiresAt);
    if (!expiresAt) {
      throw new IntegritasConnectError("Integritas Connect pending status missing expiresAt", 502);
    }
    return { status: "pending", expiresAt };
  }

  if (status === "approved") {
    if (!isRecord(data.tokens) || !isRecord(data.device)) {
      throw new IntegritasConnectError("Integritas Connect approved status missing tokens or device", 502);
    }
    const accessToken = readString(data.tokens.accessToken);
    const refreshToken = readString(data.tokens.refreshToken);
    const expiresIn = readNumber(data.tokens.expiresIn);
    const tokenType = readString(data.tokens.tokenType) ?? "Bearer";
    const id = readString(data.device.id);
    const deviceId = readString(data.device.deviceId);
    const name = readString(data.device.name);
    if (!accessToken || !refreshToken || expiresIn === undefined || !id || !deviceId || !name) {
      throw new IntegritasConnectError("Integritas Connect approved status has incomplete token handoff", 502);
    }
    return {
      status: "approved",
      tokens: { accessToken, refreshToken, expiresIn, tokenType },
      device: { id, deviceId, name },
    };
  }

  if (status === "denied" || status === "expired" || status === "connected") {
    return { status };
  }

  throw new IntegritasConnectError(`Integritas Connect returned unknown activation status: ${status}`, 502);
}

/**
 * Get the me result for a given access token.
 * @param accessToken access token for the request.
 * @returns user, plan, usage, devices, apiKey, and edge.
 */
export async function getMe(accessToken: string): Promise<DeviceMeResult> {
  return connectRequest<DeviceMeResult>({
    method: "GET",
    path: "/api/me",
    accessToken,
  });
}

/**
 * Rotate the refresh token for a given device.
 * @param input refresh token and device ID.
 * @returns new access token, refresh token, and expires in.
 */
export async function refreshToken(input: RefreshTokenInput): Promise<RefreshTokenResult> {
  const data = await connectRequest<RefreshTokenResult>({
    method: "POST",
    path: "/api/token/refresh",
    body: {
      refreshToken: input.refreshToken,
      deviceId: input.deviceId,
    },
  });

  const accessToken = readString(data?.accessToken);
  const newRefreshToken = readString(data?.refreshToken);
  const expiresIn = readNumber(data?.expiresIn);
  const tokenType = readString(data?.tokenType) ?? "Bearer";
  if (!accessToken || !newRefreshToken || expiresIn === undefined) {
    throw new IntegritasConnectError("Integritas Connect refresh response missing tokens", 502);
  }

  return { accessToken, refreshToken: newRefreshToken, expiresIn, tokenType };
}

export const integritasConnectClient = {
  startActivation,
  getActivationStatus,
  getMe,
  refreshToken,
};
