import { Router } from "express";
import { getMinimaStatus } from "./minima.service.js";

export const minimaRouter = Router();

minimaRouter.get("/status", async (_req, res) => {
  try {
    const status = await getMinimaStatus();
    res.status(status.ok ? 200 : 502).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, source: "minima", error: message });
  }
});
