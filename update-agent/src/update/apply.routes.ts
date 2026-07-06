import { Router } from "express";
import { applyUpdates } from "./apply.service.js";

export const applyRouter = Router();

// Single-process in-memory lock — valid because update-agent always runs as exactly one container.
let applyInProgress = false;

applyRouter.post("/", async (_req, res) => {
  if (applyInProgress) {
    return res.status(409).json({ error: "An update is already in progress" });
  }

  applyInProgress = true;
  try {
    const results = await applyUpdates();
    res.json({ results });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Update failed" });
  } finally {
    applyInProgress = false;
  }
});
