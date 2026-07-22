import { Router } from "express";
import { env } from "../../config/env.js";
import { apiErrorFromStatus, unauthorized, unexpected } from "../../shared/api-error.js";
import { login, changePassword, initTotpReset, verifyTotpReset, AuthSettingsError } from "./auth.service.js";
import { recordAuditEvent } from "./audit.service.js";
import { authRateLimiter } from "./rate-limit.middleware.js";
import { deleteSession, sessionCookieOptions } from "./session.service.js";

export const authPublicRouter = Router();
export const authProtectedRouter = Router();

authPublicRouter.post("/login", authRateLimiter, async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const totpToken = typeof req.body?.totpToken === "string" ? req.body.totpToken : "";

  const result = await login({ password, totpToken });
  if (!result.ok) {
    return unauthorized(res, "Invalid credentials");
  }

  res.cookie(env.sessionCookieName, result.sessionToken, sessionCookieOptions());
  return res.json({ success: true, user: result.user });
});

authProtectedRouter.post("/logout", (req, res) => {
  const rawToken = req.cookies?.[env.sessionCookieName] as string | undefined;
  if (rawToken) {
    deleteSession(rawToken);
    if (req.user) {
      recordAuditEvent("logout", { userId: req.user.id, detail: req.user.displayName });
    }
  }

  res.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
  });
  return res.json({ success: true });
});

authProtectedRouter.get("/me", (req, res) => {
  if (!req.user) {
    return unauthorized(res);
  }

  return res.json({
    displayName: req.user.displayName,
    role: req.user.role,
    lastLogin: req.user.lastLogin,
  });
});

authProtectedRouter.post("/settings/password", authRateLimiter, async (req, res) => {
  if (!req.user) return unauthorized(res);
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const totpToken = typeof req.body?.totpToken === "string" ? req.body.totpToken : "";
    await changePassword(req.user.id, { currentPassword, newPassword, totpToken });
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof AuthSettingsError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "Failed to change credential", error);
  }
});

authProtectedRouter.post("/settings/totp/init", authRateLimiter, async (req, res) => {
  if (!req.user) return unauthorized(res);
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const totpToken = typeof req.body?.totpToken === "string" ? req.body.totpToken : "";
    const result = await initTotpReset(req.user.id, { currentPassword, totpToken });
    return res.json(result);
  } catch (error) {
    if (error instanceof AuthSettingsError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "Failed to initialize TOTP reset", error);
  }
});

authProtectedRouter.post("/settings/totp/verify", authRateLimiter, async (req, res) => {
  if (!req.user) return unauthorized(res);
  try {
    const totpToken = typeof req.body?.totpToken === "string" ? req.body.totpToken : "";
    await verifyTotpReset(req.user.id, totpToken);
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof AuthSettingsError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "Failed to verify TOTP reset", error);
  }
});
