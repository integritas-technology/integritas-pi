import { Router } from "express";
import { getMinimaConfig, getMinimaStatus, resyncMegammr, saveMinimaConfig } from "./minima.service.js";

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
    const status = await getMinimaStatus();
    res.status(status.ok ? 200 : 502).json(status);
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
