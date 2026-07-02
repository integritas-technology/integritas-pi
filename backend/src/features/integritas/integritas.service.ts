import { env } from "../../config/env.js";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sha3HashHex } from "../../shared/crypto.js";
import { parseResponseBody } from "../../shared/http.js";
import { getIntegritasApiKey, integritasApiKeySource } from "../settings/secrets.service.js";
import { getProofRecord, updateProofStatus, type IntegritasProofRecord } from "./integritas.repository.js";
import type { IntegritasApiFailure, IntegritasErrorCode, IntegritasOperation, IntegritasStatusItem } from "./integritas.types.js";

export type IntegritasPollSuccess = {
  ok: true;
  items: IntegritasStatusItem[];
  proofPayloads: { uid?: string; proofPayload: unknown[] | null }[];
};

const TRANSIENT_RETRY_DELAYS_MS = [1000, 3000];
const MAX_INTEGRITAS_ATTEMPTS = 3;

const OPERATION_ERRORS: Record<IntegritasOperation, string> = {
  stamp: "Integritas stamp failed",
  status: "Integritas status check failed",
  verify: "Integritas verification failed"
};

const DEFAULT_INTEGRITAS_PORTAL_URL = "https://integritas.technology/profile?tab=apilogs";

export function getIntegritasConfig() {
  return {
    baseUrl: env.integritasBaseUrl,
    requestId: env.integritasRequestId,
    hasApiKey: Boolean(getIntegritasApiKey()),
    apiKeySource: integritasApiKeySource(),
    portalUrl: env.integritasPortalUrl.trim() || DEFAULT_INTEGRITAS_PORTAL_URL
  };
}

export function hashCanonicalBytes(canonicalBytes: string) {
  return { hash: sha3HashHex(canonicalBytes), canonicalization: "integritas-pi-text-utf8-v1" };
}

export function sha3HashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha3-256");
    const stream = fsSync.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function normalizeProofUid(uid?: string) {
  return uid?.trim().toLowerCase() ?? "";
}

function isOnchain(value: unknown) {
  return value === true || value === "true" || value === 1;
}

export function proofPayloadFromStatusItem(item: IntegritasStatusItem) {
  if (!item?.uid) return null;
  if (item.proof === "[ERROR]" || item.status === false || item.error) return null;
  if (!isOnchain(item.onchain)) return null;

  return [{ address: item.address || "", data: item.data || "", proof: item.proof || "", root: item.root || "" }];
}

export function applyPollResultToRecord(recordId: string, proofUid: string, result: IntegritasPollSuccess) {
  const normalizedUid = normalizeProofUid(proofUid);
  const statusItem = result.items.find((item) => normalizeProofUid(item.uid) === normalizedUid);
  const payload = result.proofPayloads.find((item) => normalizeProofUid(item.uid) === normalizedUid)?.proofPayload ?? null;
  const proofStatus = payload ? "ready" : statusItem?.error || statusItem?.status === false ? "failed" : "pending";

  return updateProofStatus(recordId, {
    proofStatus,
    proofPayload: payload ?? undefined,
    statusResponse: result,
    proofError: statusItem?.error ?? null
  });
}

export async function refreshProofRecord(apiKey: string, recordId: string) {
  const existing = getProofRecord(recordId);
  if (!existing?.proof_uid) {
    return { ok: false as const, notFound: true as const, error: "Proof record not found" };
  }

  const record = expirePendingProofIfTimedOut(existing);
  const proofUid = record.proof_uid;
  if (!proofUid) {
    return { ok: false as const, notFound: true as const, error: "Proof record not found" };
  }

  if (record.proof_status === "failed" && record.proof_error === "On-chain confirmation timed out") {
    return { ok: true as const, record, status: null, timedOut: true as const };
  }

  const result = await pollProofStatus({ apiKey, uids: [proofUid] });
  if (!result.ok) return { ok: false as const, notFound: false as const, upstream: result };

  const updated = applyPollResultToRecord(recordId, proofUid, result);
  return { ok: true as const, record: updated, status: result };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyErrorCode(status: number, operation: IntegritasOperation): IntegritasErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503) return "upstream_unavailable";
  if (operation === "stamp") return "stamp_failed";
  if (operation === "status") return "status_failed";
  return "verify_failed";
}

export function isTransientIntegritasErrorCode(errorCode: IntegritasErrorCode) {
  return errorCode === "upstream_unavailable" || errorCode === "rate_limited";
}

export function isIntegritasUnauthorizedErrorCode(errorCode: IntegritasErrorCode) {
  return errorCode === "unauthorized";
}

export function isProofPollExpired(createdAt: string) {
  const timeoutMs = env.integritasProofPollTimeoutMinutes * 60 * 1000;
  return Date.now() - new Date(createdAt).getTime() > timeoutMs;
}

export function expirePendingProofIfTimedOut(record: IntegritasProofRecord) {
  if (record.proof_status !== "pending" || !record.proof_uid) return record;
  if (!isProofPollExpired(record.created_at)) return record;

  return updateProofStatus(record.id, {
    proofStatus: "failed",
    proofError: "On-chain confirmation timed out"
  });
}

function isTransientIntegritasFailure(status: number | null, error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return true;
  if (status === 429 || status === 502 || status === 503) return true;
  return false;
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null) {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  }
  return TRANSIENT_RETRY_DELAYS_MS[attempt] ?? 3000;
}

function buildIntegritasFailure(input: {
  status: number;
  operation: IntegritasOperation;
  responseBody: unknown;
  retryAfter?: string | null;
}): IntegritasApiFailure {
  const errorCode = classifyErrorCode(input.status, input.operation);
  return {
    ok: false,
    status: input.status,
    error: OPERATION_ERRORS[input.operation],
    errorCode,
    responseBody: input.responseBody,
    ...(input.retryAfter ? { retryAfter: input.retryAfter } : {})
  };
}

async function integritasFetch(
  path: string,
  input: { apiKey: string; method?: string; headers?: Record<string, string>; body?: string },
  operation: IntegritasOperation
) {
  const url = `${env.integritasBaseUrl}${path}`;

  for (let attempt = 0; attempt < MAX_INTEGRITAS_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.integritasRequestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: input.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": env.integritasRequestId,
          "x-api-key": input.apiKey,
          ...input.headers
        },
        body: input.body,
        signal: controller.signal
      });

      const responseText = await response.text();
      const parsed = parseResponseBody(responseText);
      const retryAfter = response.headers.get("Retry-After");

      if (response.ok) {
        return { ok: true as const, status: response.status, parsed, response };
      }

      const failure = buildIntegritasFailure({
        status: response.status,
        operation,
        responseBody: parsed,
        retryAfter
      });

      if (!isTransientIntegritasFailure(response.status, null) || attempt === MAX_INTEGRITAS_ATTEMPTS - 1) {
        return failure;
      }

      await sleep(retryDelayMs(attempt, retryAfter));
    } catch (error) {
      if (!isTransientIntegritasFailure(null, error) || attempt === MAX_INTEGRITAS_ATTEMPTS - 1) {
        return buildIntegritasFailure({
          status: 502,
          operation,
          responseBody: error instanceof Error ? error.message : "Integritas request failed"
        });
      }

      await sleep(retryDelayMs(attempt, null));
    } finally {
      clearTimeout(timeout);
    }
  }

  return buildIntegritasFailure({ status: 502, operation, responseBody: "Integritas request failed" });
}

export async function requestProofUid({ apiKey, hash }: { apiKey: string; hash: string }) {
  const result = await integritasFetch(
    "/v1/timestamp/post",
    { apiKey, body: JSON.stringify({ hash }) },
    "stamp"
  );

  if (!result.ok) return result;

  const uid = typeof result.parsed === "object" && result.parsed && "data" in result.parsed
    ? (result.parsed as { data?: { uid?: string } }).data?.uid
    : "";

  return { ok: true as const, hash, proofUid: uid || "", proofStatus: "pending", response: result.parsed };
}

export async function pollProofStatus({ apiKey, uids }: { apiKey: string; uids: string[] }) {
  const result = await integritasFetch(
    "/v1/timestamp/status",
    { apiKey, body: JSON.stringify({ uids }) },
    "status"
  );

  if (!result.ok) return result;

  const data = typeof result.parsed === "object" && result.parsed && "data" in result.parsed && Array.isArray((result.parsed as { data?: unknown }).data)
    ? (result.parsed as { data: IntegritasStatusItem[] }).data
    : [];

  return {
    ok: true as const,
    items: data,
    proofPayloads: data.map((item) => ({ uid: item.uid, proofPayload: proofPayloadFromStatusItem(item) }))
  };
}

export async function verifyProof({ apiKey, proofPayload }: { apiKey: string; proofPayload: unknown[] }) {
  const result = await integritasFetch(
    "/v1/verify/post-lite-pdf",
    {
      apiKey,
      headers: { "x-report-required": "true" },
      body: JSON.stringify(proofPayload)
    },
    "verify"
  );

  if (!result.ok) return result;
  return { ok: true as const, response: result.parsed };
}

export function parseProofPayload(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeProofExport(proofPayloads: unknown[]) {
  const exportsDir = path.join(env.dataDir, "exports");
  await fs.mkdir(exportsDir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(exportsDir, `integritas-proofs-${safeTimestamp}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(proofPayloads, null, 2)}\n`, "utf8");
  return filePath;
}
