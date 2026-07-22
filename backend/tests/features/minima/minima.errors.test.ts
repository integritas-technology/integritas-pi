import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { normalizeMinimaRpcError } from "../../../src/features/minima/minima.errors.js";

describe("normalizeMinimaRpcError", () => {
  it("maps common connectivity failures to a friendly message", () => {
    assert.equal(normalizeMinimaRpcError("fetch failed"), "Minima RPC is temporarily unreachable");
    assert.equal(normalizeMinimaRpcError("connect ECONNREFUSED 127.0.0.1:9005"), "Minima RPC is temporarily unreachable");
    assert.equal(normalizeMinimaRpcError("getaddrinfo ENOTFOUND minima"), "Minima RPC is temporarily unreachable");
    assert.equal(normalizeMinimaRpcError("ETIMEDOUT"), "Minima RPC is temporarily unreachable");
    assert.equal(normalizeMinimaRpcError("socket hang up"), "Minima RPC is temporarily unreachable");
    assert.equal(normalizeMinimaRpcError("network error"), "Minima RPC is temporarily unreachable");
    assert.equal(normalizeMinimaRpcError("The operation was aborted"), "Minima RPC is temporarily unreachable");
  });

  it("passes through other messages unchanged", () => {
    assert.equal(normalizeMinimaRpcError("Invalid parameter: decimal"), "Invalid parameter: decimal");
  });
});
