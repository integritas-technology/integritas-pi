import { Router } from "express";
import { getUpdateStatus } from "./status.service.js";

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
