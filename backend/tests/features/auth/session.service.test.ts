import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let createUser: typeof import("../../../src/features/auth/auth.repository.js").createUser;
let createSessionRow: typeof import("../../../src/features/auth/auth.repository.js").createSessionRow;
let findSessionByTokenHash: typeof import("../../../src/features/auth/auth.repository.js").findSessionByTokenHash;
let sha256Hex: typeof import("../../../src/shared/crypto.js").sha256Hex;
let sessionService: typeof import("../../../src/features/auth/session.service.js");
let db: import("better-sqlite3").Database;

let userId: string;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  ({ createUser, createSessionRow, findSessionByTokenHash } = await import(
    "../../../src/features/auth/auth.repository.js"
  ));
  ({ sha256Hex } = await import("../../../src/shared/crypto.js"));
  sessionService = await import("../../../src/features/auth/session.service.js");

  userId = createUser({
    username: "admin",
    passwordHash: "irrelevant-hash",
    totpSecretEncrypted: "irrelevant-secret"
  });
});

afterAll(() => {
  teardown();
});

describe("createSession / validateSession", () => {
  it("validates a freshly created session and returns the session user", () => {
    const rawToken = sessionService.createSession(userId);
    const sessionUser = sessionService.validateSession(rawToken);

    assert.ok(sessionUser);
    assert.equal(sessionUser?.id, userId);
    assert.equal(sessionUser?.role, "admin");
  });

  it("returns null for an unknown token", () => {
    assert.equal(sessionService.validateSession("not-a-real-token"), null);
  });

  it("returns null for an empty token", () => {
    assert.equal(sessionService.validateSession(""), null);
  });

  it("rejects and deletes an expired session", () => {
    const rawToken = "expired-session-token";
    const tokenHash = sha256Hex(rawToken);
    const expiredAt = new Date(Date.now() - 1000).toISOString();
    createSessionRow({ userId, tokenHash, expiresAt: expiredAt });

    assert.equal(sessionService.validateSession(rawToken), null);
    assert.equal(findSessionByTokenHash(tokenHash), undefined);
  });

  it("rejects and deletes a session idle past the idle timeout", () => {
    const rawToken = sessionService.createSession(userId);
    const tokenHash = sha256Hex(rawToken);
    const staleLastSeen = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(staleLastSeen, tokenHash);

    assert.equal(sessionService.validateSession(rawToken), null);
    assert.equal(findSessionByTokenHash(tokenHash), undefined);
  });
});

describe("deleteSession", () => {
  it("removes the session so it no longer validates", () => {
    const rawToken = sessionService.createSession(userId);
    sessionService.deleteSession(rawToken);
    assert.equal(sessionService.validateSession(rawToken), null);
  });

  it("is a no-op for an empty token", () => {
    assert.doesNotThrow(() => sessionService.deleteSession(""));
  });
});

describe("deleteAllUserSessions", () => {
  it("removes every session for the user", () => {
    const tokenA = sessionService.createSession(userId);
    const tokenB = sessionService.createSession(userId);

    sessionService.deleteAllUserSessions(userId);

    assert.equal(sessionService.validateSession(tokenA), null);
    assert.equal(sessionService.validateSession(tokenB), null);
  });
});

describe("sessionCookieOptions", () => {
  it("returns httpOnly, path, and sameSite options matching env config", () => {
    const options = sessionService.sessionCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, "/");
    assert.equal(options.sameSite, "strict");
    assert.equal(options.maxAge, 7 * 24 * 60 * 60 * 1000);
  });
});
