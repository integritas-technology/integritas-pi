import { Router } from "express";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
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
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid Minima configuration" });
  }
});

minimaRouter.get("/status", async (_req, res) => {
  try {
    res.json(await getMinimaNodeStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ error: message });
  }
});

minimaRouter.get("/peers", async (_req, res) => {
  try {
    const result = await getMinimaPeers();
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
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
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ ok: false, error: message });
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
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, error: message });
  }
});

minimaRouter.get("/balance", async (_req, res) => {
  try {
    const result = await getWalletBalance();
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, source: "minima", error: message });
  }
});

minimaRouter.post("/megammrsync/resync", async (_req, res) => {
  try {
    const result = await resyncMegammr();
    res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, source: "minima", error: message });
  }
});
