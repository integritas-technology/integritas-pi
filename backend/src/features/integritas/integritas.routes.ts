import { Router } from "express";
import type { Response } from "express";
import fs from "node:fs/promises";
import { sha3HashHex } from "../../shared/crypto.js";
import { badRequest, notFound, sendApiError, unexpected, dependencyUnavailable } from "../../shared/api-error.js";
import { appError, systemError } from "../../shared/structured-error.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { createProofRecord, deleteProofRecords, getProofRecord, listProofRecords, countProofRecords, countPollablePendingProofRecords, PROOF_LIST_STATUSES, updateVerifyResponse } from "./integritas.repository.js";
import { getIntegritasConfig, hashCanonicalBytes, parseProofPayload, pollProofStatus, refreshProofRecord, requestProofUid, sha3HashFile, verifyProof, writeProofExport } from "./integritas.service.js";
import type { IntegritasApiFailure } from "./integritas.types.js";
import { parseListQuery, toPaginatedResult } from "../../shared/list-query.js";
import { upload } from "./upload.middleware.js";

export const integritasRouter = Router();

const MAX_SELECTED_IDS = 500;

function parseSelectedIds(req: { body?: unknown }): { ok: true; ids: string[] } | { ok: false; error: string } {
  const raw = (req.body as { ids?: unknown } | undefined)?.ids;
  const ids = Array.isArray(raw) ? raw.filter((id: unknown) => typeof id === "string" && id) : [];
  if (ids.length === 0) return { ok: false, error: "ids must contain at least one id" };
  if (ids.length > MAX_SELECTED_IDS)
    return {
      ok: false,
      error: `ids must contain ${MAX_SELECTED_IDS} or fewer entries`,
    };
  return { ok: true, ids };
}

function proofHistoryPage(query: { page: number; pageSize: number; status?: string; q?: string }) {
  const total = countProofRecords(query);
  const items = listProofRecords(query);
  return {
    ...toPaginatedResult(items, total, query),
    pendingTotal: countPollablePendingProofRecords(),
  };
}

function sendIntegritasError(res: Response, result: IntegritasApiFailure) {
  // Reserve HTTP 401 for browser session auth; upstream key rejection is an app error.
  const status = result.errorCode === "unauthorized" ? 403 : result.status;
  return sendApiError(res, status, status >= 500
    ? systemError({ type: "dependency_unavailable", message: result.error, context: { upstreamStatus: result.status } })
    : appError({ type: result.errorCode === "unauthorized" ? "forbidden" : "bad_request", message: result.error, context: { upstreamStatus: result.status } }), {
    errorCode: result.errorCode,
    responseBody: result.responseBody,
    ...(result.retryAfter ? { retryAfter: result.retryAfter } : {}),
  });
}

function requireIntegritasApiKey(res: Response) {
  const apiKey = getIntegritasApiKey();
  if (apiKey) return apiKey;
  badRequest(res, "Integritas Connect is not linked");
  return "";
}

integritasRouter.get("/config", (_req, res) => {
  res.json(getIntegritasConfig());
});

// integritasRouter.post("/api-key/check", requireRole("admin"), async (_req, res) => {
//   const checkedAt = new Date().toISOString();
//   const apiKeySource = integritasApiKeySource();
//   const apiKey = getIntegritasApiKey();

//   if (!apiKey) {
//     return res.json({ configured: false, valid: false, checkedAt, apiKeySource });
//   }

//   const validation = await validateIntegritasApiKey(apiKey);
//   if (!validation.ok) {
//     return res.json({
//       configured: true,
//       valid: false,
//       checkedAt,
//       apiKeySource,
//       error: validation.error,
//       ...("errorCode" in validation && validation.errorCode ? { errorCode: validation.errorCode } : {}),
//     });
//   }

//   return res.json({ configured: true, valid: true, checkedAt, apiKeySource });
// });

// integritasRouter.post("/api-key", requireRole("admin"), async (req, res) => {
//   const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
//   if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

//   const validation = await validateIntegritasApiKey(apiKey);
//   if (!validation.ok) return res.status(400).json({ error: validation.error });

//   saveIntegritasApiKey(apiKey);
//   recordAuditEvent("integritas_api_key.save", { userId: req.user?.id, detail: "via integritas page" });
//   return res.json({ hasApiKey: true, apiKeySource: integritasApiKeySource() });
// });

// integritasRouter.delete("/api-key", requireRole("admin"), (req, res) => {
//   deleteIntegritasApiKey();
//   recordAuditEvent("integritas_api_key.delete", { userId: req.user?.id });
//   res.json({ hasApiKey: Boolean(getIntegritasApiKey()), apiKeySource: integritasApiKeySource() });
// });

integritasRouter.post("/hash", (req, res) => {
  const canonicalBytes = typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  if (!canonicalBytes) return badRequest(res, "canonicalBytes is required", { field: "canonicalBytes" });
  return res.json(hashCanonicalBytes(canonicalBytes));
});

integritasRouter.post("/stamp", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const canonicalBytes = typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  const providedHash = typeof req.body?.hash === "string" ? req.body.hash : "";
  const hash = providedHash || (canonicalBytes ? sha3HashHex(canonicalBytes) : "");
  if (!hash) return badRequest(res, "hash or canonicalBytes is required", { fields: ["hash", "canonicalBytes"] });

  const result = await requestProofUid({ apiKey, hash });
  if (!result.ok) return sendIntegritasError(res, result);
  return res.json(result);
});

integritasRouter.post("/stamp-file", upload.single("file"), async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  if (!req.file) return badRequest(res, "file is required", { field: "file" });

  try {
    const hash = await sha3HashFile(req.file.path);
    const result = await requestProofUid({ apiKey, hash });
    if (!result.ok) return sendIntegritasError(res, result);
    const record = createProofRecord({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      hash,
      proofUid: result.proofUid,
      proofStatus: "pending",
    });
    return res.json({ record, stamp: result });
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});

integritasRouter.get("/history", (req, res) => {
  const parsed = parseListQuery(req.query, {
    allowedStatuses: PROOF_LIST_STATUSES,
  });
  if (!parsed.ok) return badRequest(res, parsed.error);

  return res.json(proofHistoryPage(parsed.value));
});

integritasRouter.get("/history/:id", (req, res) => {
  const record = getProofRecord(req.params.id);
  if (!record) return notFound(res, "Proof record not found");
  return res.json({ record });
});

integritasRouter.post("/history/delete-selected", (req, res) => {
  const parsed = parseSelectedIds(req);
  if (!parsed.ok) return badRequest(res, parsed.error, { field: "ids" });
  deleteProofRecords(parsed.ids);
  return res.json({ deleted: parsed.ids.length });
});

integritasRouter.post("/history/export-selected", async (req, res) => {
  const parsed = parseSelectedIds(req);
  if (!parsed.ok) return badRequest(res, parsed.error, { field: "ids" });
  const ids = parsed.ids;

  try {
    const merged = ids.flatMap((id: string) => parseProofPayload(getProofRecord(id)?.proof_payload ?? null) ?? []);
    if (merged.length === 0) return badRequest(res, "Selected rows do not contain proof payloads", { field: "ids" });
    const filePath = await writeProofExport(merged);
    return res.download(filePath);
  } catch (error) {
    return unexpected(res, error instanceof Error ? error.message : "Proof export failed", error);
  }
});

integritasRouter.post("/history/:id/poll", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const result = await refreshProofRecord(apiKey, req.params.id);
  if (result.notFound) return notFound(res, result.error);
  if (!result.ok) return sendIntegritasError(res, result.upstream);
  return res.json({ record: result.record, status: result.status });
});

integritasRouter.post("/history/:id/verify", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  const record = getProofRecord(req.params.id);
  if (!record) return notFound(res, "Proof record not found");
  const proofPayload = parseProofPayload(record.proof_payload);
  if (!proofPayload) return badRequest(res, "Proof record has no proof payload");
  const result = await verifyProof({ apiKey, proofPayload });
  if (!result.ok) return sendIntegritasError(res, result);
  const updated = updateVerifyResponse(req.params.id, result.response);
  return res.json({
    record: updated,
    currentHash: record.hash,
    response: result.response,
  });
});

integritasRouter.post("/verify-proof-file", upload.single("file"), async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  if (!req.file) return badRequest(res, "file is required", { field: "file" });

  try {
    const text = await fs.readFile(req.file.path, "utf8");
    const proofPayload = JSON.parse(text) as unknown;
    if (!Array.isArray(proofPayload) || proofPayload.length === 0) return badRequest(res, "proof JSON must be a non-empty array", { field: "file" });
    const result = await verifyProof({ apiKey, proofPayload });
    if (!result.ok) return sendIntegritasError(res, result);
    return res.json({ response: result.response });
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});

integritasRouter.post("/status", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const uids = Array.isArray(req.body?.uids) ? req.body.uids.filter((uid: unknown) => typeof uid === "string" && uid) : [];
  if (uids.length === 0) return badRequest(res, "uids must contain at least one UID", { field: "uids" });

  try {
    const result = await pollProofStatus({ apiKey, uids });
    if (!result.ok) return sendIntegritasError(res, result);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Integritas proof status failed", error instanceof Error ? error.message : undefined);
  }
});

integritasRouter.post("/verify", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const canonicalBytes = typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  const storedHash = typeof req.body?.storedHash === "string" ? req.body.storedHash : "";
  const proofPayload = req.body?.proofPayload;

  if (!canonicalBytes || !storedHash) return badRequest(res, "canonicalBytes and storedHash are required", { fields: ["canonicalBytes", "storedHash"] });

  const currentHash = sha3HashHex(canonicalBytes);
  if (currentHash !== storedHash)
    return badRequest(res, "The current document bytes do not match the stamped hash", undefined, {
      currentHash,
      storedHash,
    });
  if (!Array.isArray(proofPayload) || proofPayload.length === 0) return badRequest(res, "proofPayload must be a non-empty array", { field: "proofPayload" });

  const result = await verifyProof({ apiKey, proofPayload });
  if (!result.ok) return sendIntegritasError(res, result);
  return res.json({ currentHash, response: result.response });
});
