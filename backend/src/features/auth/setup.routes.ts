import { Router } from "express";
import { env } from "../../config/env.js";
import { authRateLimiter } from "./rate-limit.middleware.js";
import {
  completeSetup,
  initSetupTotp,
  isSetupComplete,
  SetupError,
  verifySetupIntegritasKey,
  verifySetupTotp
} from "./setup.service.js";
import { sessionCookieOptions } from "./session.service.js";

export const setupRouter = Router();

setupRouter.get("/status", (_req, res) => {
  res.json({ setupComplete: isSetupComplete() });
});

setupRouter.post("/totp/init", authRateLimiter, async (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const result = await initSetupTotp(username);
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

setupRouter.post("/integritas/verify", authRateLimiter, async (req, res) => {
  try {
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : "";
    const result = await verifySetupIntegritasKey(apiKey);
    return res.json(result);
  } catch (error) {
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to verify Integritas API key" });
  }
});

setupRouter.post("/complete", authRateLimiter, async (req, res) => {
  try {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const integritasApiKey =
      typeof req.body?.integritasApiKey === "string" ? req.body.integritasApiKey : undefined;

    const result = await completeSetup({ username, password, integritasApiKey });
    res.cookie(env.sessionCookieName, result.sessionToken, sessionCookieOptions());
    return res.json({ success: true, user: result.user });
  } catch (error) {
    if (error instanceof SetupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to complete setup" });
  }
});
