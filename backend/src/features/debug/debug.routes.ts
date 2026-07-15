import { Router } from "express";

export const debugRouter = Router();

debugRouter.get("/ping", (_req, res) => {
  res.json({ message: "debug v1" });
});
