import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  adminCredentialValidationError,
  hashPassword,
  isValidAdminCredential,
  isValidAdminPassword,
  isValidAdminPin,
  verifyPassword
} from "../../../src/features/auth/password.service.js";

describe("isValidAdminPin", () => {
  it("accepts exactly 6 digits", () => {
    assert.equal(isValidAdminPin("123456"), true);
  });

  it("rejects wrong length", () => {
    assert.equal(isValidAdminPin("12345"), false);
    assert.equal(isValidAdminPin("1234567"), false);
  });

  it("rejects non-digit characters", () => {
    assert.equal(isValidAdminPin("12345a"), false);
  });
});

describe("isValidAdminPassword", () => {
  it("accepts a password with upper, lower, number, and symbol at min length", () => {
    assert.equal(isValidAdminPassword("Abcdef1!"), true);
  });

  it("rejects passwords shorter than the minimum length", () => {
    assert.equal(isValidAdminPassword("Ab1!abc"), false);
  });

  it("rejects passwords missing an uppercase letter", () => {
    assert.equal(isValidAdminPassword("abcdefg1!"), false);
  });

  it("rejects passwords missing a lowercase letter", () => {
    assert.equal(isValidAdminPassword("ABCDEFG1!"), false);
  });

  it("rejects passwords missing a number", () => {
    assert.equal(isValidAdminPassword("Abcdefgh!"), false);
  });

  it("rejects passwords missing a symbol", () => {
    assert.equal(isValidAdminPassword("Abcdefg1"), false);
  });
});

describe("isValidAdminCredential", () => {
  it("accepts a valid pin", () => {
    assert.equal(isValidAdminCredential("123456"), true);
  });

  it("accepts a valid password", () => {
    assert.equal(isValidAdminCredential("Abcdef1!"), true);
  });

  it("rejects a value that is neither a valid pin nor a valid password", () => {
    assert.equal(isValidAdminCredential("short"), false);
  });
});

describe("adminCredentialValidationError", () => {
  it("mentions both the pin and password requirements", () => {
    const message = adminCredentialValidationError();
    assert.match(message, /6 digits/);
    assert.match(message, /8 characters/);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies the original plaintext against its hash", async () => {
    const hash = await hashPassword("Abcdef1!");
    assert.notEqual(hash, "Abcdef1!");
    assert.equal(await verifyPassword("Abcdef1!", hash), true);
  });

  it("rejects an incorrect plaintext", async () => {
    const hash = await hashPassword("Abcdef1!");
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });
});
