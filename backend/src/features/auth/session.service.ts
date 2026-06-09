import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { sha256Hex } from "../../shared/crypto.js";
import {
  createSessionRow,
  deleteSessionByTokenHash,
  deleteAllUserSessions as deleteAllUserSessionsRepo,
  findSessionByTokenHash,
  findUserById,
  updateSessionLastSeen
} from "./auth.repository.js";
import { LOCAL_ADMIN_DISPLAY_NAME } from "./auth.constants.js";
import type { SessionUser } from "./auth.types.js";

function sessionMaxAgeMs() {
  return env.sessionMaxAgeDays * 24 * 60 * 60 * 1000;
}

function sessionIdleMs() {
  return env.sessionIdleHours * 60 * 60 * 1000;
}

export function createSession(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);
  const now = Date.now();
  const expiresAt = new Date(now + sessionMaxAgeMs()).toISOString();

  createSessionRow({ userId, tokenHash, expiresAt });
  return rawToken;
}

export function validateSession(rawToken: string): SessionUser | null {
  if (!rawToken) return null;

  const tokenHash = sha256Hex(rawToken);
  const session = findSessionByTokenHash(tokenHash);
  if (!session) return null;

  const now = Date.now();
  if (new Date(session.expires_at).getTime() < now) {
    deleteSessionByTokenHash(tokenHash);
    return null;
  }

  if (new Date(session.last_seen_at).getTime() + sessionIdleMs() < now) {
    deleteSessionByTokenHash(tokenHash);
    return null;
  }

  updateSessionLastSeen(session.id);
  const user = findUserById(session.user_id);
  if (!user) return null;

  return {
    id: user.id,
    displayName: LOCAL_ADMIN_DISPLAY_NAME,
    role: user.role,
    lastLogin: user.last_login
  };
}

export function deleteSession(rawToken: string) {
  if (!rawToken) return;
  deleteSessionByTokenHash(sha256Hex(rawToken));
}

export function deleteAllUserSessions(userId: string) {
  deleteAllUserSessionsRepo(userId);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
    maxAge: sessionMaxAgeMs()
  } as const;
}
