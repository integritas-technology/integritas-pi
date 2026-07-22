import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

let monitoring: typeof import("../../../src/features/minima/minima-monitoring.js");

beforeEach(async () => {
  vi.resetModules();
  monitoring = await import("../../../src/features/minima/minima-monitoring.js");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("detectStall", () => {
  it("is false while the node is not running", () => {
    assert.equal(monitoring.detectStall({ state: "stopped", sync: { blockAgeSeconds: 9999 } as never }), false);
  });

  it("is false when block age is unknown", () => {
    assert.equal(monitoring.detectStall({ state: "running", sync: { blockAgeSeconds: null } as never }), false);
  });

  it("is false when block age is within the threshold", () => {
    assert.equal(monitoring.detectStall({ state: "running", sync: { blockAgeSeconds: 100 } as never }), false);
  });

  it("is true when running with block age past the threshold", () => {
    assert.equal(monitoring.detectStall({ state: "running", sync: { blockAgeSeconds: 301 } as never }), true);
  });
});

describe("snapshot recording", () => {
  it("starts with an unknown/null snapshot", () => {
    const snapshot = monitoring.getMinimaMonitoringSnapshot();
    assert.deepEqual(snapshot, {
      lastPollerCheckAt: null,
      lastStallDetectedAt: null,
      lastAutoResyncAt: null,
      lastAutoResyncResult: null,
      lastNodeState: "unknown"
    });
  });

  it("recordPollerCheck updates the poller check time and state", () => {
    monitoring.recordPollerCheck("2026-01-01T00:00:00.000Z", "running");
    assert.deepEqual(monitoring.getLastMinimaPollerState(), {
      state: "running",
      lastCheckedAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("recordStallDetected sets lastStallDetectedAt", () => {
    monitoring.recordStallDetected();
    assert.ok(monitoring.getMinimaMonitoringSnapshot().lastStallDetectedAt);
  });

  it("recordAutoResync sets lastAutoResyncAt and lastAutoResyncResult", () => {
    monitoring.recordAutoResync("resync completed");
    const snapshot = monitoring.getMinimaMonitoringSnapshot();
    assert.ok(snapshot.lastAutoResyncAt);
    assert.equal(snapshot.lastAutoResyncResult, "resync completed");
  });
});

describe("canAutoResync", () => {
  it("is true before any resync has run", () => {
    assert.equal(monitoring.canAutoResync(), true);
  });

  it("is false immediately after a resync, and true again after the cooldown elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    monitoring.recordAutoResync("resync completed");
    assert.equal(monitoring.canAutoResync(), false);

    vi.setSystemTime(new Date("2026-01-01T00:29:59.000Z"));
    assert.equal(monitoring.canAutoResync(), false);

    vi.setSystemTime(new Date("2026-01-01T00:30:00.001Z"));
    assert.equal(monitoring.canAutoResync(), true);
  });
});

describe("buildMinimaMonitoring", () => {
  it("combines stall detection, env thresholds, and the current snapshot", () => {
    const result = monitoring.buildMinimaMonitoring({ state: "running", sync: { blockAgeSeconds: 301 } as never });

    assert.equal(result.stallDetected, true);
    assert.equal(result.stallThresholdSeconds, 300);
    assert.equal(result.autoResyncEnabled, false);
    assert.equal(result.lastNodeState, "unknown");
  });
});
