import { Router } from "express";

export const debugRouter = Router();

debugRouter.get("/ping", (_req, res) => {
  res.json({ message: "Hello from the backend — build v2 (progress bar + status cache fix)" });
});
