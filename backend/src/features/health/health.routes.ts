import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  // TODO: Add authentication before exposing this beyond a trusted local network.
  res.json({ status: "ok", service: "integritas-pi-backend" });
});
