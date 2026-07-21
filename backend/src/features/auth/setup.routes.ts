import { Router } from "express";
import { env } from "../../config/env.js";
import { authRateLimiter } from "./rate-limit.middleware.js";
import {
  completeSetup,
  initSetupTotp,
  isLocalAdminCreated,
  isSetupComplete,
  SetupError,
  verifySetupTotp,
} from "./setup.service.js";
import { sessionCookieOptions } from "./session.service.js";

export const setupRouter = Router();

setupRouter.get("/status", (_req, res) => {
  res.json({
    localAdminCreated: isLocalAdminCreated(),
    setupComplete: isSetupComplete(),
  });
});

setupRouter.post("/totp/init", authRateLimiter, async (_req, res) => {
  try {
    const result = await initSetupTotp();
    return res.json(result);
  } catch (error) {
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to initialize TOTP setup" });
  }
});

setupRouter.post("/totp/verify", authRateLimiter, async (req, res) => {
  try {
    const totpToken = typeof req.body?.totpToken === "string" ? req.body.totpToken : "";
    const result = await verifySetupTotp(totpToken);
    return res.json(result);
  } catch (error) {
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to verify TOTP code" });
  }
});

setupRouter.post("/complete", authRateLimiter, async (req, res) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const result = await completeSetup({ password });
    res.cookie(env.sessionCookieName, result.sessionToken, sessionCookieOptions());
    return res.json({ success: true, user: result.user });
  } catch (error) {
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to complete setup" });
  }
});
