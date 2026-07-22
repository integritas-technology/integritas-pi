import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

const {
  fetchMinimaStatusMock,
  runMinimaPathCommandMock,
  getMinimaContainerStatsMock,
  getMinimaStorageInfoMock,
  restartComposeServiceMock
} = vi.hoisted(() => ({
  fetchMinimaStatusMock: vi.fn(),
  runMinimaPathCommandMock: vi.fn(),
  getMinimaContainerStatsMock: vi.fn(),
  getMinimaStorageInfoMock: vi.fn(),
  restartComposeServiceMock: vi.fn()
}));

vi.mock("../../../src/features/minima/minima.rpc.js", () => ({
  fetchMinimaStatus: fetchMinimaStatusMock,
  runMinimaPathCommand: runMinimaPathCommandMock
}));

vi.mock("../../../src/features/minima/minima.docker.js", () => ({
  getMinimaContainerStats: getMinimaContainerStatsMock,
  getMinimaStorageInfo: getMinimaStorageInfoMock
}));

vi.mock("../../../src/features/status/docker.control.js", () => ({
  restartComposeService: restartComposeServiceMock
}));

let teardown: () => void;
let minimaService: typeof import("../../../src/features/minima/minima.service.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  minimaService = await import("../../../src/features/minima/minima.service.js");
});

afterAll(() => {
  teardown();
});

beforeEach(() => {
  fetchMinimaStatusMock.mockReset();
  runMinimaPathCommandMock.mockReset();
  getMinimaContainerStatsMock.mockReset().mockResolvedValue(null);
  getMinimaStorageInfoMock.mockReset().mockReturnValue({
    dataPath: "/home/minima/data",
    containerDisk: null,
    chainDataDisk: null
  });
  restartComposeServiceMock.mockReset();
});

function rpcOk(body: unknown) {
  return { ok: true, status: 200, source: "http://127.0.0.1:9005/status", command: "status", body };
}

describe("getMinimaConfig / saveMinimaConfig", () => {
  it("defaults to the built-in megammr host when nothing is saved", () => {
    assert.deepEqual(minimaService.getMinimaConfig(), {
      megammrHost: "megammr.minima.global:9001",
      megammrHostSource: "default"
    });
  });

  it("saves a trimmed host and reflects it as the source", () => {
    const saved = minimaService.saveMinimaConfig({ megammrHost: " custom.host:9001 " });
    assert.deepEqual(saved, { megammrHost: "custom.host:9001", megammrHostSource: "database" });
    assert.deepEqual(minimaService.getMinimaConfig(), { megammrHost: "custom.host:9001", megammrHostSource: "database" });
  });

  it("rejects an empty host", () => {
    assert.throws(() => minimaService.saveMinimaConfig({ megammrHost: "   " }), /megammrHost is required/);
  });
});

describe("getMinimaNodeStatus", () => {
  it("reports state error when RPC fails and no container is found", async () => {
    fetchMinimaStatusMock.mockRejectedValue(new Error("fetch failed"));

    const status = await minimaService.getMinimaNodeStatus();

    assert.equal(status.state, "error");
    assert.equal(status.rpc.ok, false);
    assert.equal(status.rpc.error, "Minima RPC is temporarily unreachable");
    assert.equal(status.sync.status, "unavailable");
  });

  it("reports state stopped when RPC fails but the container isn't running", async () => {
    fetchMinimaStatusMock.mockRejectedValue(new Error("fetch failed"));
    getMinimaContainerStatsMock.mockResolvedValue({
      state: "exited",
      status: "Exited (0)",
      cpuPercent: null,
      memory: null,
      containerDisk: null
    });

    const status = await minimaService.getMinimaNodeStatus();
    assert.equal(status.state, "stopped");
  });

  it("parses a full, healthy status response with no fallback RPC calls", async () => {
    const recentMs = Date.now() - 45_000;
    fetchMinimaStatusMock.mockResolvedValue(
      rpcOk({
        status: true,
        response: {
          chain: { block: "932067", time: "Fri Jul 05 16:24:46 BST 2024", timemilli: String(recentMs) },
          network: { connected: 12, connecting: 0 },
          memory: { ram: "256 MB", disk: "575.2 MB" },
          data: "/home/minima/data/.minima/"
        }
      })
    );

    const status = await minimaService.getMinimaNodeStatus();

    assert.equal(status.state, "running");
    assert.equal(status.rpc.ok, true);
    assert.equal(status.sync.status, "active");
    assert.equal(status.sync.block, 932067);
    assert.equal(status.health.peerCount, 12);
    assert.equal(runMinimaPathCommandMock.mock.calls.length, 0);
  });

  it("falls back to block/peers commands when the status response omits them", async () => {
    fetchMinimaStatusMock.mockResolvedValue(
      rpcOk({
        status: true,
        response: { chain: { block: "932067" } }
      })
    );
    runMinimaPathCommandMock.mockImplementation(async (command: string) => {
      if (command === "block") {
        return {
          ok: true,
          status: 200,
          source: "http://127.0.0.1:9005/block",
          command: "block",
          body: { status: true, response: { block: "932067", timemilli: String(Date.now() - 9_000) } }
        };
      }
      if (command === "peers") {
        return {
          ok: true,
          status: 200,
          source: "http://127.0.0.1:9005/peers",
          command: "peers",
          body: { status: true, response: { connected: 7 } }
        };
      }
      throw new Error(`unexpected command ${command}`);
    });

    const status = await minimaService.getMinimaNodeStatus();

    assert.ok(status.sync.blockAgeSeconds !== null && status.sync.blockAgeSeconds < 15);
    assert.equal(status.health.peerCount, 7);
    assert.equal(status.health.peersKnown, 7);
  });

  it("keeps status-derived values when the block/peers fallback commands fail", async () => {
    fetchMinimaStatusMock.mockResolvedValue(
      rpcOk({
        status: true,
        response: { chain: { block: "932067" } }
      })
    );
    runMinimaPathCommandMock.mockRejectedValue(new Error("timeout"));

    const status = await minimaService.getMinimaNodeStatus();

    assert.equal(status.sync.block, 932067);
    assert.equal(status.sync.blockAgeSeconds, null);
    assert.equal(status.health.peerCount, null);
    assert.equal(status.health.peersKnown, null);
  });
});

describe("getWalletBalance", () => {
  it("delegates to the balance RPC command", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "s", command: "balance", body: {} });
    const result = await minimaService.getWalletBalance();
    assert.equal(runMinimaPathCommandMock.mock.calls[0][0], "balance");
    assert.equal(result.command, "balance");
  });
});

describe("resyncMegammr", () => {
  it("builds the megammrsync command from the configured host with a 30s timeout", async () => {
    minimaService.saveMinimaConfig({ megammrHost: "resync.host:9001" });
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "s", command: "megammrsync", body: {} });
    await minimaService.resyncMegammr();

    const [command, timeoutMs] = runMinimaPathCommandMock.mock.calls.at(-1)!;
    assert.equal(command, "megammrsync action:resync host:resync.host:9001");
    assert.equal(timeoutMs, 30000);
  });
});

describe("getMinimaPeers", () => {
  it("returns the parsed peer list on success", async () => {
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      source: "http://127.0.0.1:9005/peers",
      command: "peers",
      body: { status: true, response: { size: 2, peerslist: "megammr.minima.global:9001,127.0.0.1:9001" } }
    });

    const result = await minimaService.getMinimaPeers();
    assert.equal(result.ok, true);
    assert.equal(result.count, 2);
    assert.deepEqual(result.peers, ["megammr.minima.global:9001", "127.0.0.1:9001"]);
  });

  it("reports ok:false when the peer count can't be parsed", async () => {
    runMinimaPathCommandMock.mockResolvedValue({
      ok: true,
      status: 200,
      source: "s",
      command: "peers",
      body: { status: false }
    });

    const result = await minimaService.getMinimaPeers();
    assert.equal(result.ok, false);
    assert.equal(result.count, null);
  });
});

describe("addMinimaPeers", () => {
  it("normalizes the peer list and calls the addpeers command", async () => {
    runMinimaPathCommandMock.mockResolvedValue({ ok: true, status: 200, source: "s", command: "peers", body: {} });
    await minimaService.addMinimaPeers(" 127.0.0.1:9001 , megammr.minima.global:9001 ");

    const [command] = runMinimaPathCommandMock.mock.calls.at(-1)!;
    assert.equal(command, "peers action:addpeers peerslist:127.0.0.1:9001,megammr.minima.global:9001");
  });

  it("rejects an invalid peer address", async () => {
    await assert.rejects(() => minimaService.addMinimaPeers("not-a-peer"), /Invalid peer address/);
  });
});

describe("restartMinimaContainer", () => {
  it("restarts the minima compose service", async () => {
    restartComposeServiceMock.mockResolvedValue({ ok: true, state: "restarting", service: "minima", containerId: "abc123" });
    const result = await minimaService.restartMinimaContainer();

    assert.equal(restartComposeServiceMock.mock.calls[0][0], "minima");
    assert.equal(result.service, "minima");
  });
});
