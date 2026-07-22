import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { SessionUser } from "../../../src/features/auth/auth.types.js";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let requireAuth: typeof import("../../../src/features/auth/auth.middleware.js").requireAuth;
let requireRole: typeof import("../../../src/features/auth/auth.middleware.js").requireRole;
let validToken: string;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;

  const { createUser } = await import("../../../src/features/auth/auth.repository.js");
  const { createSession } = await import("../../../src/features/auth/session.service.js");
  ({ requireAuth, requireRole } = await import("../../../src/features/auth/auth.middleware.js"));

  const userId = createUser({
    username: "admin",
    passwordHash: "irrelevant-hash",
    totpSecretEncrypted: "irrelevant-secret"
  });
  validToken = createSession(userId);
});

afterAll(() => {
  teardown();
});

function mockResponse() {
  const calls: { status?: number; json?: unknown } = {};
  const res = {
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(body: unknown) {
      calls.json = body;
      return res;
    }
  } as unknown as Response;
  return { res, calls };
}

function mockNext() {
  let called = false;
  const next = () => {
    called = true;
  };
  return { next, wasCalled: () => called };
}

describe("requireAuth", () => {
  it("rejects a request with no session cookie", () => {
    const req = { cookies: {} } as unknown as Request;
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    requireAuth(req, res, next);

    assert.equal(calls.status, 401);
    assert.deepEqual(calls.json, { error: "Unauthorized" });
    assert.equal(wasCalled(), false);
  });

  it("rejects a request with an invalid session token", () => {
    const req = { cookies: { session: "not-a-real-token" } } as unknown as Request;
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    requireAuth(req, res, next);

    assert.equal(calls.status, 401);
    assert.equal(wasCalled(), false);
  });

  it("attaches req.user and calls next for a valid session", () => {
    const req = { cookies: { session: validToken } } as unknown as Request;
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    requireAuth(req, res, next);

    assert.equal(calls.status, undefined);
    assert.equal(wasCalled(), true);
    assert.equal(req.user?.role, "admin");
  });
});

describe("requireRole", () => {
  it("rejects when req.user is not set", () => {
    const req = {} as unknown as Request;
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    requireRole("admin")(req, res, next);

    assert.equal(calls.status, 401);
    assert.equal(wasCalled(), false);
  });

  it("rejects when req.user.role does not match", () => {
    const req = { user: { id: "u1", displayName: "x", role: "operator", lastLogin: null } as unknown as SessionUser } as unknown as Request;
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    requireRole("admin")(req, res, next);

    assert.equal(calls.status, 403);
    assert.equal(wasCalled(), false);
  });

  it("calls next when req.user.role matches", () => {
    const req = { user: { id: "u1", displayName: "x", role: "admin", lastLogin: null } as SessionUser } as unknown as Request;
    const { res, calls } = mockResponse();
    const { next, wasCalled } = mockNext();

    requireRole("admin")(req, res, next);

    assert.equal(calls.status, undefined);
    assert.equal(wasCalled(), true);
  });
});
