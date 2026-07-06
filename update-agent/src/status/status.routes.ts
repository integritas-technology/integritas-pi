import { Router } from "express";
import { getUpdateStatus } from "./status.service.js";

export const statusRouter = Router();

statusRouter.get("/", async (_req, res) => {
  try {
    const status = await getUpdateStatus();
    res.json(status);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Failed to fetch update status" });
  }
});
