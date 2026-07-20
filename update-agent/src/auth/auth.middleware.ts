import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

type MeResponse = {
  role?: string;
};

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const fetchResponse = await fetch(`${env.backendInternalUrl}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      signal: AbortSignal.timeout(5000)
    });

    if (!fetchResponse.ok) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = (await fetchResponse.json()) as MeResponse;
    if (body.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  } catch {
    return res.status(502).json({ error: "Auth check failed" });
  }
}
