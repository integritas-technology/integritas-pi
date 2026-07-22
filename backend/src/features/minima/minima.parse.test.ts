import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveSyncStatus,
  normalizePeerslist,
  parseBlockCommandResponse,
  parseMegammrResyncMessage,
  parsePeersListResponse,
  parseStatusResponse
} from "./minima.parse.js";

describe("parseStatusResponse", () => {
  it("reads chain block, network peers, and memory from live status shape", () => {
    const recentMs = Date.now() - 45_000;
    const parsed = parseStatusResponse({
      command: "status",
      status: true,
      pending: false,
      response: {
        chain: { block: "932067", time: "Fri Jul 05 16:24:46 BST 2024", timemilli: String(recentMs) },
        network: { connected: 12, connecting: 0 },
        memory: { ram: "256 MB", disk: "575.2 MB" },
        data: "/home/minima/data/.minima/"
      }
    });

    assert.equal(parsed.rpcOk, true);
    assert.equal(parsed.block, 932067);
    assert.equal(parsed.peerCount, 12);
    assert.equal(parsed.nodeMemory.ram, "256 MB");
    assert.equal(parsed.nodeMemory.disk, "575.2 MB");
    assert.equal(parsed.syncStatus, "active");
  });

  it("returns unavailable sync when RPC status is false", () => {
    const parsed = parseStatusResponse({ command: "status", status: false, response: {} });
    assert.equal(parsed.rpcOk, false);
    assert.equal(parsed.syncStatus, "unavailable");
  });
});

describe("parseBlockCommandResponse", () => {
  it("derives block age from timemilli", () => {
    const recentMs = Date.now() - 45_000;
    const parsed = parseBlockCommandResponse({
      command: "block",
      status: true,
      response: { block: "932067", timemilli: String(recentMs) }
    });

    assert.equal(parsed.block, 932067);
    assert.ok(parsed.blockAgeSeconds !== null);
    assert.ok(parsed.blockAgeSeconds >= 40 && parsed.blockAgeSeconds <= 50);
  });
});

describe("parsePeersListResponse", () => {
  it("parses peerslist string and size", () => {
    const parsed = parsePeersListResponse({
      command: "peers",
      status: true,
      response: {
        size: 2,
        peerslist: "megammr.minima.global:9001,127.0.0.1:9001"
      }
    });

    assert.equal(parsed.count, 2);
    assert.deepEqual(parsed.peers, ["megammr.minima.global:9001", "127.0.0.1:9001"]);
  });
});

describe("parseMegammrResyncMessage", () => {
  it("detects finished resync that needs restart", () => {
    const parsed = parseMegammrResyncMessage({
      command: "megammrsync",
      status: true,
      response: { message: "MegaMMR sync fininshed.. please restart" }
    });

    assert.equal(parsed.needsRestart, true);
    assert.equal(parsed.ok, true);
  });
});

describe("deriveSyncStatus", () => {
  it("marks stale blocks when age exceeds threshold", () => {
    const sync = deriveSyncStatus({ rpcOk: true, blockAgeSeconds: 400 });

    assert.equal(sync.status, "stale");
    assert.equal(sync.synced, false);
  });
});

describe("normalizePeerslist", () => {
  it("accepts comma-separated host:port values", () => {
    assert.equal(
      normalizePeerslist(" megammr.minima.global:9001 , 127.0.0.1:9001 "),
      "megammr.minima.global:9001,127.0.0.1:9001"
    );
  });

  it("rejects invalid peer addresses", () => {
    assert.throws(() => normalizePeerslist("not-a-peer"), /Invalid peer address/);
  });
});
