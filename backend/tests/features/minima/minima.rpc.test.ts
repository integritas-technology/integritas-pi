import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { fetchMinimaStatus, runMinimaPathCommand } from "../../../src/features/minima/minima.rpc.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(status: number, bodyText: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText
  };
}

describe("fetchMinimaStatus", () => {
  it("fetches the configured status URL and returns the parsed body", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true, response: { chain: {} } })));

    const result = await fetchMinimaStatus();

    assert.equal(fetchMock.mock.calls[0][0], "http://127.0.0.1:9005/status");
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.command, "status");
    assert.equal(result.source, "http://127.0.0.1:9005/status");
    assert.deepEqual(result.body, { status: true, response: { chain: {} } });
  });

  it("reports ok:false for a non-2xx response", async () => {
    fetchMock.mockResolvedValue(mockResponse(503, "Service Unavailable"));

    const result = await fetchMinimaStatus();

    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.body, "Service Unavailable");
  });
});

describe("runMinimaPathCommand", () => {
  it("builds the request path from a simple command", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true })));

    const result = await runMinimaPathCommand("peers");

    assert.equal(fetchMock.mock.calls[0][0], "http://127.0.0.1:9005/peers");
    assert.equal(result.command, "peers");
    assert.equal(result.source, "http://127.0.0.1:9005/peers");
  });

  it("percent-encodes a command with spaces and colons into a single path segment", async () => {
    fetchMock.mockResolvedValue(mockResponse(200, JSON.stringify({ status: true })));

    const command = "megammrsync action:resync host:megammr.minima.global:9001";
    await runMinimaPathCommand(command);

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    assert.equal(requestedUrl, `http://127.0.0.1:9005/${encodeURIComponent(command)}`);
    assert.ok(!requestedUrl.includes(" "));
  });
});
