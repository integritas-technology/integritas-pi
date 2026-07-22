import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { hashPassword, verifyPassword } from "../../../src/features/auth/password.service.js";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let createUser: typeof import("../../../src/features/auth/auth.repository.js").createUser;
let findUserById: typeof import("../../../src/features/auth/auth.repository.js").findUserById;
let db: import("better-sqlite3").Database;
let authService: typeof import("../../../src/features/auth/auth.service.js");

let userId: string;
const PASSWORD = "Abcdef1!";

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;

  ({ createUser, findUserById } = await import("../../../src/features/auth/auth.repository.js"));
  authService = await import("../../../src/features/auth/auth.service.js");

  const passwordHash = await hashPassword(PASSWORD);
  userId = createUser({ username: "admin", passwordHash, totpSecretEncrypted: "irrelevant-secret" });
});

afterAll(() => {
  teardown();
});

describe("login", () => {
  it("succeeds with the correct password and returns a session token", async () => {
    const result = await authService.login({ password: PASSWORD });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.sessionToken);
      assert.equal(result.user.role, "admin");
    }
  });

  it("updates last_login on success", async () => {
    await authService.login({ password: PASSWORD });
    const user = findUserById(userId);
    assert.ok(user?.last_login);
  });

  it("records an audit event on success", async () => {
    await authService.login({ password: PASSWORD });
    const events = db.prepare("SELECT action FROM audit_events WHERE action = 'login.success'").all();
    assert.ok(events.length > 0);
  });

  it("fails with an incorrect password", async () => {
    const result = await authService.login({ password: "wrong-password" });
    assert.equal(result.ok, false);
  });

  it("records an audit event on failure", async () => {
    await authService.login({ password: "wrong-password" });
    const events = db.prepare("SELECT action FROM audit_events WHERE action = 'login.failure'").all();
    assert.ok(events.length > 0);
  });
});

describe("changePassword", () => {
  it("throws a 404 error for an unknown user", async () => {
    await assert.rejects(
      () =>
        authService.changePassword("not-a-real-user-id", {
          currentPassword: PASSWORD,
          newPassword: "Newpass1!"
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 404
    );
  });

  it("throws a 401 error for an incorrect current password", async () => {
    await assert.rejects(
      () =>
        authService.changePassword(userId, {
          currentPassword: "wrong-password",
          newPassword: "Newpass1!"
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 401
    );
  });

  it("throws a 400 error for an invalid new password", async () => {
    await assert.rejects(
      () =>
        authService.changePassword(userId, {
          currentPassword: PASSWORD,
          newPassword: "short"
        }),
      (error: unknown) => error instanceof authService.AuthSettingsError && error.status === 400
    );
  });

  it("updates the password hash on success", async () => {
    const newPassword = "Newpass1!";
    await authService.changePassword(userId, { currentPassword: PASSWORD, newPassword });

    const user = findUserById(userId);
    assert.ok(user);
    assert.equal(await verifyPassword(newPassword, user!.password), true);
    assert.equal(await verifyPassword(PASSWORD, user!.password), false);
  });
});
