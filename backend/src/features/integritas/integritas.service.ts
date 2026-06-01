import { env } from "../../config/env.js";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sha3HashHex } from "../../shared/crypto.js";
import { parseResponseBody } from "../../shared/http.js";
import { getIntegritasApiKey, integritasApiKeySource } from "../settings/secrets.service.js";
import type { IntegritasStatusItem } from "./integritas.types.js";

export function getIntegritasConfig() {
  return {
    baseUrl: env.integritasBaseUrl,
    requestId: env.integritasRequestId,
    hasApiKey: Boolean(getIntegritasApiKey()),
    apiKeySource: integritasApiKeySource()
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

export function proofPayloadFromStatusItem(item: IntegritasStatusItem) {
  if (!item?.uid) return null;

  if (item.proof === "[ERROR]" || item.status === false || item.error) {
    throw new Error(item.error || `Integritas proof failed for uid ${item.uid}`);
  }

  if (!item.onchain) return null;

  return [{ address: item.address || "", data: item.data || "", proof: item.proof || "", root: item.root || "" }];
}

export async function requestProofUid({ apiKey, hash }: { apiKey: string; hash: string }) {
  const response = await fetch(`${env.integritasBaseUrl}/v1/timestamp/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": env.integritasRequestId, "x-api-key": apiKey },
    body: JSON.stringify({ hash })
  });

  const responseText = await response.text();
  const parsed = parseResponseBody(responseText);

  if (!response.ok) {
    return { ok: false as const, status: response.status, error: "Integritas stamp failed", responseBody: parsed };
  }

  const uid = typeof parsed === "object" && parsed && "data" in parsed ? (parsed as { data?: { uid?: string } }).data?.uid : "";
  return { ok: true as const, hash, proofUid: uid || "", proofStatus: "pending", response: parsed };
}

export async function pollProofStatus({ apiKey, uids }: { apiKey: string; uids: string[] }) {
  const response = await fetch(`${env.integritasBaseUrl}/v1/timestamp/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": env.integritasRequestId, "x-api-key": apiKey },
    body: JSON.stringify({ uids })
  });

  const responseText = await response.text();
  const parsed = parseResponseBody(responseText);

  if (!response.ok) {
    return { ok: false as const, status: response.status, error: "Integritas status check failed", responseBody: parsed };
  }

  const data = typeof parsed === "object" && parsed && "data" in parsed && Array.isArray((parsed as { data?: unknown }).data)
    ? (parsed as { data: IntegritasStatusItem[] }).data
    : [];

  return { ok: true as const, items: data, proofPayloads: data.map((item) => ({ uid: item.uid, proofPayload: proofPayloadFromStatusItem(item) })) };
}

export async function verifyProof({ apiKey, proofPayload }: { apiKey: string; proofPayload: unknown[] }) {
  const response = await fetch(`${env.integritasBaseUrl}/v1/verify/post-lite-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": env.integritasRequestId, "x-report-required": "true", "x-api-key": apiKey },
    body: JSON.stringify(proofPayload)
  });

  const responseText = await response.text();
  const parsed = parseResponseBody(responseText);

  if (!response.ok) {
    return { ok: false as const, status: response.status, error: "Integritas verification failed", responseBody: parsed };
  }

  return { ok: true as const, response: parsed };
}

export function parseProofPayload(value: string | null) {
  if (!value) return null;
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed : null;
}

export async function writeProofExport(proofPayloads: unknown[]) {
  const exportsDir = path.join(env.dataDir, "exports");
  await fs.mkdir(exportsDir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(exportsDir, `integritas-proofs-${safeTimestamp}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(proofPayloads, null, 2)}\n`, "utf8");
  return filePath;
}
