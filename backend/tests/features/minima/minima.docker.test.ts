import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

const { dockerServiceResourcesMock } = vi.hoisted(() => ({ dockerServiceResourcesMock: vi.fn() }));

vi.mock("../../../src/features/status/docker.service.js", () => ({
  dockerServiceResources: dockerServiceResourcesMock
}));

import { getMinimaContainerStats, getMinimaStorageInfo } from "../../../src/features/minima/minima.docker.js";

beforeEach(() => {
  dockerServiceResourcesMock.mockReset();
});

describe("getMinimaContainerStats", () => {
  it("returns null when no minima container is found", async () => {
    dockerServiceResourcesMock.mockResolvedValue([
      { service: "backend", state: "running", status: "Up", cpuPercent: 1, memory: null, disk: { rootFs: null } }
    ]);

    assert.equal(await getMinimaContainerStats(), null);
  });

  it("maps the minima container's stats", async () => {
    dockerServiceResourcesMock.mockResolvedValue([
      {
        service: "minima",
        state: "running",
        status: "Up 2 hours",
        cpuPercent: 12.5,
        memory: { usage: "128 MB", limit: "512 MB" },
        disk: { rootFs: "1.2 GB" }
      }
    ]);

    const result = await getMinimaContainerStats();
    assert.deepEqual(result, {
      state: "running",
      status: "Up 2 hours",
      cpuPercent: 12.5,
      memory: { usage: "128 MB", limit: "512 MB" },
      containerDisk: "1.2 GB"
    });
  });

  it("defaults missing memory usage/limit fields to null", async () => {
    dockerServiceResourcesMock.mockResolvedValue([
      {
        service: "minima",
        state: "stopped",
        status: "Exited",
        cpuPercent: null,
        memory: { usage: null, limit: undefined },
        disk: { rootFs: null }
      }
    ]);

    const result = await getMinimaContainerStats();
    assert.deepEqual(result?.memory, { usage: null, limit: null });
    assert.equal(result?.containerDisk, null);
  });
});

describe("getMinimaStorageInfo", () => {
  it("uses the default Minima data path when none is provided", () => {
    assert.deepEqual(getMinimaStorageInfo("1.2 GB"), {
      dataPath: "/home/minima/data",
      containerDisk: "1.2 GB",
      chainDataDisk: null
    });
  });

  it("uses a provided (trimmed) dataPath and chainDataDisk", () => {
    assert.deepEqual(getMinimaStorageInfo(null, { dataPath: " /custom/path ", chainDataDisk: "500 MB" }), {
      dataPath: "/custom/path",
      containerDisk: null,
      chainDataDisk: "500 MB"
    });
  });
});
