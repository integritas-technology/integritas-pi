import { Router } from "express";
import type { Response } from "express";
import fs from "node:fs/promises";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { validateIntegritasApiKey } from "../auth/integritas-validation.service.js";
import { sha3HashHex } from "../../shared/crypto.js";
import { deleteIntegritasApiKey, getIntegritasApiKey, saveIntegritasApiKey } from "../settings/secrets.service.js";
import { env } from "../../config/env.js";
import { createProofRecord, deleteProofRecords, getProofRecord, listProofRecords, updateProofStatus, updateVerifyResponse } from "./integritas.repository.js";
import { getIntegritasConfig, hashCanonicalBytes, parseProofPayload, pollProofStatus, requestProofUid, sha3HashFile, verifyProof, writeProofExport } from "./integritas.service.js";
import { upload } from "./upload.middleware.js";

export const integritasRouter = Router();

function requireIntegritasApiKey(res: Response) {
  const apiKey = getIntegritasApiKey();
  if (apiKey) return apiKey;
  res.status(400).json({ error: "Integritas API key is not configured" });
  return "";
}

integritasRouter.get("/config", (_req, res) => {
  res.json(getIntegritasConfig());
});

integritasRouter.post("/api-key", requireRole("admin"), async (req, res) => {
  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

  const validation = await validateIntegritasApiKey(apiKey);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  saveIntegritasApiKey(apiKey);
  recordAuditEvent("integritas_api_key.save", { userId: req.user?.id, detail: "via integritas page" });
  return res.json({ hasApiKey: true, apiKeySource: "database" });
});

integritasRouter.delete("/api-key", requireRole("admin"), (req, res) => {
  deleteIntegritasApiKey();
  recordAuditEvent("integritas_api_key.delete", { userId: req.user?.id });
  res.json({ hasApiKey: Boolean(env.integritasApiKeyFallback), apiKeySource: env.integritasApiKeyFallback ? "environment" : "none" });
});

integritasRouter.post("/hash", (req, res) => {
  const canonicalBytes = typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  if (!canonicalBytes) return res.status(400).json({ error: "canonicalBytes is required" });
  return res.json(hashCanonicalBytes(canonicalBytes));
});

integritasRouter.post("/stamp", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const canonicalBytes = typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  const providedHash = typeof req.body?.hash === "string" ? req.body.hash : "";
  const hash = providedHash || (canonicalBytes ? sha3HashHex(canonicalBytes) : "");
  if (!hash) return res.status(400).json({ error: "hash or canonicalBytes is required" });

  const result = await requestProofUid({ apiKey, hash });
  if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
  return res.json(result);
});

integritasRouter.post("/stamp-file", upload.single("file"), async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  if (!req.file) return res.status(400).json({ error: "file is required" });

  try {
    const hash = await sha3HashFile(req.file.path);
    const result = await requestProofUid({ apiKey, hash });
    if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
    const record = createProofRecord({ fileName: req.file.originalname, fileSize: req.file.size, hash, proofUid: result.proofUid, proofStatus: "pending" });
    return res.json({ record, stamp: result });
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});

integritasRouter.get("/history", (_req, res) => {
  res.json({ items: listProofRecords() });
});

integritasRouter.post("/history/delete-selected", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === "string" && id) : [];
  if (ids.length === 0) return res.status(400).json({ error: "ids must contain at least one id" });
  deleteProofRecords(ids);
  return res.json({ deleted: ids.length });
});

integritasRouter.post("/history/export-selected", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === "string" && id) : [];
  if (ids.length === 0) return res.status(400).json({ error: "ids must contain at least one id" });
  const merged = ids.flatMap((id: string) => parseProofPayload(getProofRecord(id)?.proof_payload ?? null) ?? []);
  if (merged.length === 0) return res.status(400).json({ error: "Selected rows do not contain proof payloads" });
  const filePath = await writeProofExport(merged);
  res.download(filePath);
});

integritasRouter.post("/history/:id/poll", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  const record = getProofRecord(req.params.id);
  if (!record?.proof_uid) return res.status(404).json({ error: "Proof record not found" });

  try {
    const result = await pollProofStatus({ apiKey, uids: [record.proof_uid] });
    if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
    const payload = result.proofPayloads.find((item) => item.uid === record.proof_uid)?.proofPayload ?? null;
    const statusItem = result.items.find((item) => item.uid === record.proof_uid);
    const proofStatus = payload ? "ready" : statusItem?.error || statusItem?.status === false ? "failed" : "pending";
    const updated = updateProofStatus(req.params.id, { proofStatus, proofPayload: payload ?? undefined, statusResponse: result, proofError: statusItem?.error ?? null });
    return res.json({ record: updated, status: result });
  } catch (error) {
    const updated = updateProofStatus(req.params.id, { proofStatus: "failed", proofError: error instanceof Error ? error.message : "Integritas proof status failed" });
    return res.status(502).json({ error: updated.proof_error, record: updated });
  }
});

integritasRouter.post("/history/:id/verify", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  const record = getProofRecord(req.params.id);
  if (!record) return res.status(404).json({ error: "Proof record not found" });
  const proofPayload = parseProofPayload(record.proof_payload);
  if (!proofPayload) return res.status(400).json({ error: "Proof record has no proof payload" });
  const result = await verifyProof({ apiKey, proofPayload });
  if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
  const updated = updateVerifyResponse(req.params.id, result.response);
  return res.json({ record: updated, currentHash: record.hash, response: result.response });
});

integritasRouter.post("/verify-proof-file", upload.single("file"), async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;
  if (!req.file) return res.status(400).json({ error: "file is required" });

  try {
    const text = await fs.readFile(req.file.path, "utf8");
    const proofPayload = JSON.parse(text) as unknown;
    if (!Array.isArray(proofPayload) || proofPayload.length === 0) return res.status(400).json({ error: "proof JSON must be a non-empty array" });
    const result = await verifyProof({ apiKey, proofPayload });
    if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
    return res.json({ response: result.response });
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});

integritasRouter.post("/status", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const uids = Array.isArray(req.body?.uids) ? req.body.uids.filter((uid: unknown) => typeof uid === "string" && uid) : [];
  if (uids.length === 0) return res.status(400).json({ error: "uids must contain at least one UID" });

  try {
    const result = await pollProofStatus({ apiKey, uids });
    if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Integritas proof status failed" });
  }
});

integritasRouter.post("/verify", async (req, res) => {
  const apiKey = requireIntegritasApiKey(res);
  if (!apiKey) return;

  const canonicalBytes = typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  const storedHash = typeof req.body?.storedHash === "string" ? req.body.storedHash : "";
  const proofPayload = req.body?.proofPayload;

  if (!canonicalBytes || !storedHash) return res.status(400).json({ error: "canonicalBytes and storedHash are required" });

  const currentHash = sha3HashHex(canonicalBytes);
  if (currentHash !== storedHash) return res.status(400).json({ error: "The current document bytes do not match the stamped hash", currentHash, storedHash });
  if (!Array.isArray(proofPayload) || proofPayload.length === 0) return res.status(400).json({ error: "proofPayload must be a non-empty array" });

  const result = await verifyProof({ apiKey, proofPayload });
  if (!result.ok) return res.status(result.status).json({ error: result.error, responseBody: result.responseBody });
  return res.json({ currentHash, response: result.response });
});
