import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const {
  getMinimaNodeStatusMock,
  resyncMegammrMock,
  canAutoResyncMock,
  detectStallMock,
  recordAutoResyncMock,
  recordPollerCheckMock,
  recordStallDetectedMock
} = vi.hoisted(() => ({
  getMinimaNodeStatusMock: vi.fn(),
  resyncMegammrMock: vi.fn(),
  canAutoResyncMock: vi.fn(),
  detectStallMock: vi.fn(),
  recordAutoResyncMock: vi.fn(),
  recordPollerCheckMock: vi.fn(),
  recordStallDetectedMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.service.js", () => ({
  getMinimaNodeStatus: getMinimaNodeStatusMock,
  resyncMegammr: resyncMegammrMock
}));

vi.mock("../../../src/features/minima/minima-monitoring.js", () => ({
  canAutoResync: canAutoResyncMock,
  detectStall: detectStallMock,
  recordAutoResync: recordAutoResyncMock,
  recordPollerCheck: recordPollerCheckMock,
  recordStallDetected: recordStallDetectedMock
}));

let pollMinimaHealth: typeof import("../../../src/features/minima/minima-poll.service.js").pollMinimaHealth;

async function loadModule() {
  vi.resetModules();
  ({ pollMinimaHealth } = await import("../../../src/features/minima/minima-poll.service.js"));
}

beforeEach(async () => {
  delete process.env.MINIMA_AUTO_RESYNC;
  getMinimaNodeStatusMock.mockReset();
  resyncMegammrMock.mockReset();
  canAutoResyncMock.mockReset();
  detectStallMock.mockReset();
  recordAutoResyncMock.mockReset();
  recordPollerCheckMock.mockReset();
  recordStallDetectedMock.mockReset();
  await loadModule();
});

afterEach(() => {
  delete process.env.MINIMA_AUTO_RESYNC;
});

const baseStatus = {
  checkedAt: "2026-01-01T00:00:00.000Z",
  state: "running" as const,
  sync: { blockAgeSeconds: 400 }
};

describe("pollMinimaHealth", () => {
  it("records the poller check and does nothing else when no stall is detected", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(false);

    await pollMinimaHealth();

    assert.equal(recordPollerCheckMock.mock.calls[0][0], baseStatus.checkedAt);
    assert.equal(recordPollerCheckMock.mock.calls[0][1], baseStatus.state);
    assert.equal(recordStallDetectedMock.mock.calls.length, 0);
    assert.equal(resyncMegammrMock.mock.calls.length, 0);
  });

  it("records a stall but does not auto-resync while MINIMA_AUTO_RESYNC is unset", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);

    await pollMinimaHealth();

    assert.equal(recordStallDetectedMock.mock.calls.length, 1);
    assert.equal(resyncMegammrMock.mock.calls.length, 0);
  });

  it("does not run two polls concurrently", async () => {
    let resolveStatus: (value: typeof baseStatus) => void = () => {};
    getMinimaNodeStatusMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
    );
    detectStallMock.mockReturnValue(false);

    const first = pollMinimaHealth();
    const second = pollMinimaHealth();
    resolveStatus(baseStatus);
    await Promise.all([first, second]);

    assert.equal(getMinimaNodeStatusMock.mock.calls.length, 1);
  });

  it("does not throw when getMinimaNodeStatus rejects, and allows a later poll to run", async () => {
    getMinimaNodeStatusMock.mockRejectedValueOnce(new Error("boom"));
    await assert.doesNotReject(() => pollMinimaHealth());

    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(false);
    await pollMinimaHealth();
    assert.equal(getMinimaNodeStatusMock.mock.calls.length, 2);
  });
});

describe("pollMinimaHealth with auto-resync enabled", () => {
  beforeEach(async () => {
    process.env.MINIMA_AUTO_RESYNC = "true";
    await loadModule();
  });

  it("skips resync while the cooldown is active", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(false);

    await pollMinimaHealth();

    assert.equal(resyncMegammrMock.mock.calls.length, 0);
  });

  it("resyncs and records the result when the cooldown has elapsed", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(true);
    resyncMegammrMock.mockResolvedValue({
      ok: true,
      body: { status: true, response: { message: "MegaMMR sync fininshed.. please restart" } }
    });

    await pollMinimaHealth();

    assert.equal(resyncMegammrMock.mock.calls.length, 1);
    assert.equal(recordAutoResyncMock.mock.calls[0][0], "MegaMMR sync fininshed.. please restart");
  });

  it("records the failure when resync throws", async () => {
    getMinimaNodeStatusMock.mockResolvedValue(baseStatus);
    detectStallMock.mockReturnValue(true);
    canAutoResyncMock.mockReturnValue(true);
    resyncMegammrMock.mockRejectedValue(new Error("resync failed: timeout"));

    await pollMinimaHealth();

    assert.equal(recordAutoResyncMock.mock.calls[0][0], "resync failed: timeout");
  });
});
