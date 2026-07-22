import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { forbidden, unauthorized } from "../../shared/api-error.js";
import type { UserRole } from "./auth.types.js";
import { validateSession } from "./session.service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[env.sessionCookieName] as string | undefined;
  const user = rawToken ? validateSession(rawToken) : null;

  if (!user) {
    return unauthorized(res);
  }

  req.user = user;
  return next();
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return unauthorized(res);
    }
    if (req.user.role !== role) {
      return forbidden(res);
    }
    return next();
  };
}
