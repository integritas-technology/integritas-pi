import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let recordAuditEvent: typeof import("../../../src/features/auth/audit.service.js").recordAuditEvent;
let db: import("better-sqlite3").Database;

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  db = testDb.db;
  teardown = testDb.teardown;
  ({ recordAuditEvent } = await import("../../../src/features/auth/audit.service.js"));
});

afterAll(() => {
  teardown();
});

describe("recordAuditEvent", () => {
  it("inserts a row with the action, userId, and detail", () => {
    recordAuditEvent("login.success", { userId: "user-1", detail: "Administrator" });

    const row = db.prepare("SELECT * FROM audit_events WHERE action = 'login.success'").get() as {
      user_id: string | null;
      detail: string | null;
    };
    assert.equal(row.user_id, "user-1");
    assert.equal(row.detail, "Administrator");
  });

  it("defaults userId and detail to null when omitted", () => {
    recordAuditEvent("login.failure");

    const row = db.prepare("SELECT * FROM audit_events WHERE action = 'login.failure'").get() as {
      user_id: string | null;
      detail: string | null;
    };
    assert.equal(row.user_id, null);
    assert.equal(row.detail, null);
  });
});
