import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { parseTokenCreateResponse } from "../../../src/features/tokens/tokens.parse.js";

describe("parseTokenCreateResponse", () => {
  it("returns Minima error when status is false", () => {
    const result = parseTokenCreateResponse({
      status: false,
      error: "Invalid parameter : decimal"
    });
    assert.equal(result.ok, false);
    assert.equal(result.message, "Invalid parameter : decimal");
  });

  it("extracts tokenId from tokencreate txpow body outputs", () => {
    const result = parseTokenCreateResponse({
      status: true,
      response: {
        txpowid: "0xABC",
        body: {
          txn: {
            outputs: [
              {
                tokenid: "0xFF",
                token: {
                  tokenid: "0x207325EBA710139C604961D2E3FD2C2D60E5A8ED078368AADE6001941F3E4304",
                  name: { name: "ParseTest" }
                }
              }
            ]
          }
        }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.tokenId, "0x207325EBA710139C604961D2E3FD2C2D60E5A8ED078368AADE6001941F3E4304");
    assert.equal(result.txpowId, "0xABC");
  });
});
