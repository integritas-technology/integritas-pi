import { Router } from "express";
import type { Response } from "express";
import { recordAuditEvent } from "../auth/audit.service.js";
import {
  IntegritasAuthServiceError,
  getIntegritasAuthStatus,
  getUserProfile,
  startConnectActivation,
} from "./integritas-auth.service.js";

export const integritasAuthRouter = Router();
export const integritasUserRouter = Router();

function sendServiceError(res: Response, error: unknown) {
  if (error instanceof IntegritasAuthServiceError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code ? { errorCode: error.code } : {}),
    });
  }
  return res.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : "Integritas auth request failed",
  });
}

integritasAuthRouter.post("/connect/start", async (req, res) => {
  try {
    const deviceName = typeof req.body?.deviceName === "string" ? req.body.deviceName : undefined;
    const data = await startConnectActivation(deviceName);
    recordAuditEvent("integritas.activation.started", {
      userId: req.user?.id,
      detail: data.userCode,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

integritasAuthRouter.get("/connect/status", async (req, res) => {
  try {
    const data = await getIntegritasAuthStatus();
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, error);
  }
});

integritasUserRouter.get("/profile", async (req, res) => {
  try {
    const refreshRaw = req.query.refresh;
    const refresh =
      refreshRaw === "1" ||
      refreshRaw === "true" ||
      (Array.isArray(refreshRaw) && (refreshRaw[0] === "1" || refreshRaw[0] === "true"));
    const data = await getUserProfile({ refresh });
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, error);
  }
});
