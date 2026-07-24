import { Router } from "express";
import { apiErrorFromStatus, badRequest, dependencyUnavailable, unauthorized, unexpected } from "../../shared/api-error.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { authRateLimiter } from "../auth/rate-limit.middleware.js";
import { getConsoleWhitelist, MinimaConsoleError, runConsoleCommand, updateConsoleWhitelist } from "./minima-console.service.js";
import { normalizeMinimaRpcError } from "./minima.errors.js";
import {
  addMinimaPeers,
  getMinimaConfig,
  getMinimaNodeStatus,
  getMinimaPeers,
  getWalletBalance,
  resyncMegammr,
  restartMinimaContainer,
  saveMinimaConfig
} from "./minima.service.js";

export const minimaRouter = Router();

minimaRouter.get("/config", (_req, res) => {
  res.json(getMinimaConfig());
});

minimaRouter.post("/config", (req, res) => {
  try {
    const megammrHost = typeof req.body?.megammrHost === "string" ? req.body.megammrHost : "";
    res.json(saveMinimaConfig({ megammrHost }));
  } catch (error) {
    badRequest(res, error instanceof Error ? error.message : "Invalid Minima configuration");
  }
});

minimaRouter.get("/status", async (_req, res) => {
  try {
    res.json(await getMinimaNodeStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    dependencyUnavailable(res, message, message);
  }
});

minimaRouter.get("/peers", async (_req, res) => {
  try {
    const result = await getMinimaPeers();
    if (!result.ok) return dependencyUnavailable(res, "Failed to get Minima peers", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false });
  }
});

minimaRouter.post("/peers/add", requireRole("admin"), async (req, res) => {
  try {
    const peerslist = typeof req.body?.peerslist === "string" ? req.body.peerslist : "";
    const result = await addMinimaPeers(peerslist);
    recordAuditEvent("minima.peers.add", {
      userId: req.user?.id,
      detail: peerslist.trim()
    });
    if (!result.ok) return dependencyUnavailable(res, "Failed to add Minima peers", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const message = normalizeMinimaRpcError(error instanceof Error ? error.message : "Unknown error");
    badRequest(res, message, undefined, { ok: false });
  }
});

minimaRouter.post("/restart", requireRole("admin"), async (req, res) => {
  try {
    const result = await restartMinimaContainer();
    recordAuditEvent("minima.container.restart", {
      userId: req.user?.id,
      detail: result.containerId
    });
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false });
  }
});

minimaRouter.get("/balance", async (_req, res) => {
  try {
    const result = await getWalletBalance();
    if (!result.ok) return dependencyUnavailable(res, "Failed to get wallet balance", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
  }
});

minimaRouter.post("/megammrsync/resync", async (_req, res) => {
  try {
    const result = await resyncMegammr();
    if (!result.ok) return dependencyUnavailable(res, "Megammr resync failed", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
  }
});

minimaRouter.get("/console/whitelist", requireRole("admin"), (_req, res) => {
  res.json(getConsoleWhitelist());
});

minimaRouter.post("/console/whitelist", requireRole("admin"), authRateLimiter, async (req, res) => {
  if (!req.user) return unauthorized(res);
  try {
    const enabledKeys = Array.isArray(req.body?.enabledKeys) ? req.body.enabledKeys : [];
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const result = await updateConsoleWhitelist(req.user.id, { enabledKeys, currentPassword });
    res.json(result);
  } catch (error) {
    if (error instanceof MinimaConsoleError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    unexpected(res, "Failed to update console whitelist", error);
  }
});

minimaRouter.post("/console/run", requireRole("admin"), async (req, res) => {
  try {
    const command = typeof req.body?.command === "string" ? req.body.command : "";
    const result = await runConsoleCommand(req.user?.id, command);
    res.json(result);
  } catch (error) {
    if (error instanceof MinimaConsoleError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
  }
});
