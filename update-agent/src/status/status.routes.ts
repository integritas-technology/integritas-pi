import { Router } from "express";
import { getUpdateStatus } from "./status.service.js";
import { getCachedStatus } from "./status-poller.js";

export const statusRouter = Router();

statusRouter.get("/", async (_req, res) => {
  try {
    const status = await getUpdateStatus();
    res.json(status);
  } catch (error) {
    console.error("[update-agent] status check failed:", error);
    res.status(502).json({ error: "Failed to fetch update status" });
  }
});

// Cheap read of the background poller's last result — for callers (e.g. the
// product frontend's nav badge) that just need to know if an update is
// available, without triggering a live manifest fetch + signature verify.
statusRouter.get("/summary", (_req, res) => {
  res.json(getCachedStatus());
});
