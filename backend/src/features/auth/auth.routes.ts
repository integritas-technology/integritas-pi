import { Router } from "express";
import { env } from "../../config/env.js";
import { login } from "./auth.service.js";
import { recordAuditEvent } from "./audit.service.js";
import { authRateLimiter } from "./rate-limit.middleware.js";
import { deleteSession, sessionCookieOptions } from "./session.service.js";

export const authPublicRouter = Router();
export const authProtectedRouter = Router();

authPublicRouter.post("/login", authRateLimiter, async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const totpToken = typeof req.body?.totpToken === "string" ? req.body.totpToken : "";

  const result = await login({ username, password, totpToken });
  if (!result.ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.cookie(env.sessionCookieName, result.sessionToken, sessionCookieOptions());
  return res.json({ success: true, user: result.user });
});

authProtectedRouter.post("/logout", (req, res) => {
  const rawToken = req.cookies?.[env.sessionCookieName] as string | undefined;
  if (rawToken) {
    deleteSession(rawToken);
    if (req.user) {
      recordAuditEvent("logout", { userId: req.user.id, detail: req.user.username });
    }
  }

  res.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/"
  });
  return res.json({ success: true });
});

authProtectedRouter.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    username: req.user.username,
    role: req.user.role,
    lastLogin: req.user.lastLogin
  });
});
