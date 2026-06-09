import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import type { UserRole } from "./auth.types.js";
import { validateSession } from "./session.service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[env.sessionCookieName] as string | undefined;
  const user = rawToken ? validateSession(rawToken) : null;

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = user;
  return next();
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
