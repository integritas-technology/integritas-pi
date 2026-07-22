function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseBlockNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function blockTimingFromMillis(ms: number) {
  const blockTime = new Date(ms).toISOString();
  const blockAgeSeconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return { blockTime, blockAgeSeconds };
}

function parseBlockTiming(timemilli: unknown, timeString?: unknown) {
  if (timemilli !== null && timemilli !== undefined && timemilli !== "") {
    const ms = Number(timemilli);
    if (Number.isFinite(ms)) return blockTimingFromMillis(ms);
  }

  if (typeof timeString === "string" && timeString.trim()) {
    const ms = Date.parse(timeString);
    if (!Number.isNaN(ms)) return blockTimingFromMillis(ms);
  }

  return { blockTime: null, blockAgeSeconds: null };
}

function readPeerCount(response: Record<string, unknown>) {
  const network = asRecord(response.network);
  if (typeof network?.connected === "number") return network.connected;
  if (typeof network?.connecting === "number" && network.connecting > 0) return network.connecting;
  if (Array.isArray(response.peers)) return response.peers.length;
  if (typeof network?.peers === "number") return network.peers;
  if (Array.isArray(network?.peers)) return network.peers.length;
  if (typeof response.peercount === "number") return response.peercount;
  if (typeof response.peerconnections === "number") return response.peerconnections;
  if (typeof response.connections === "number") return response.connections;
  return null;
}

export type MinimaSyncStatus = "active" | "stale" | "syncing" | "unavailable";

const staleBlockAgeSeconds = 300;

export function deriveSyncStatus(input: { rpcOk: boolean; blockAgeSeconds: number | null }) {
  if (!input.rpcOk) {
    return { status: "unavailable" as const, synced: null };
  }

  if (input.blockAgeSeconds === null) {
    return { status: "unavailable" as const, synced: null };
  }

  if (input.blockAgeSeconds > staleBlockAgeSeconds) {
    return { status: "stale" as const, synced: false };
  }

  return { status: "active" as const, synced: true };
}

function readNodeMemory(response: Record<string, unknown>) {
  const memory = asRecord(response.memory);
  return {
    ram: typeof memory?.ram === "string" ? memory.ram : null,
    disk: typeof memory?.disk === "string" ? memory.disk : null
  };
}

export function parseBlockCommandResponse(body: unknown) {
  const envelope = asRecord(body);
  if (envelope?.status !== true) {
    return { block: null, blockTime: null, blockAgeSeconds: null };
  }

  const response = asRecord(envelope.response);
  const block = parseBlockNumber(response?.block);
  const { blockTime, blockAgeSeconds } = parseBlockTiming(response?.timemilli, response?.date);
  return { block, blockTime, blockAgeSeconds };
}

export function parseStatusResponse(body: unknown) {
  const envelope = asRecord(body);
  const rpcOk = envelope?.status === true;
  const response = asRecord(envelope?.response);
  const chain = asRecord(response?.chain);

  const block = parseBlockNumber(chain?.block ?? response?.block);
  const { blockTime, blockAgeSeconds } = parseBlockTiming(chain?.timemilli, chain?.time);
  const nodeMemory = response ? readNodeMemory(response) : { ram: null, disk: null };
  const dataPath = typeof response?.data === "string" ? response.data : null;
  const peerCount = response ? readPeerCount(response) : null;
  const sync = deriveSyncStatus({ rpcOk, blockAgeSeconds });

  return {
    rpcOk,
    block,
    blockTime,
    blockAgeSeconds,
    synced: sync.synced,
    syncStatus: sync.status,
    peerCount,
    nodeMemory,
    dataPath
  };
}

export type MinimaPeersInfo = {
  count: number | null;
  peers: string[];
};

function readPeersList(response: Record<string, unknown>) {
  if (typeof response.peerslist === "string" && response.peerslist.trim()) {
    return response.peerslist
      .split(",")
      .map((peer) => peer.trim())
      .filter(Boolean);
  }
  if (Array.isArray(response.peers)) {
    return response.peers.map((peer) => String(peer).trim()).filter(Boolean);
  }
  return [];
}

export function parsePeersListResponse(body: unknown): MinimaPeersInfo {
  const envelope = asRecord(body);
  if (envelope?.status !== true) return { count: null, peers: [] };

  const response = asRecord(envelope.response);
  if (response) {
    const peers = readPeersList(response);
    // `size` / peerslist length is configured/known peers, not live P2P connections (use status.network.connected for that).
    if (typeof response.connected === "number") return { count: response.connected, peers };
    if (peers.length > 0) return { count: peers.length, peers };
    if (typeof response.size === "number") return { count: response.size, peers };
  }

  if (Array.isArray(envelope.response)) {
    const peers = envelope.response.map((peer) => String(peer).trim()).filter(Boolean);
    return { count: peers.length, peers };
  }

  return { count: null, peers: [] };
}

export function parsePeersResponse(body: unknown): number | null {
  const parsed = parsePeersListResponse(body);
  return parsed.count ?? (parsed.peers.length > 0 ? parsed.peers.length : null);
}

const peerAddressPattern = /^[^\s,:]+:\d+$/;

export function normalizePeerslist(peerslist: string) {
  const trimmed = peerslist.trim();
  if (!trimmed) throw new Error("peerslist is required");

  const peers = trimmed
    .split(",")
    .map((peer) => peer.trim())
    .filter(Boolean);

  for (const peer of peers) {
    if (!peerAddressPattern.test(peer)) {
      throw new Error(`Invalid peer address: ${peer}`);
    }
  }

  return peers.join(",");
}

export function parseMegammrResyncMessage(body: unknown) {
  const envelope = asRecord(body);
  const response = asRecord(envelope?.response);
  const message = typeof response?.message === "string" ? response.message.trim() : "";
  const ok = envelope?.status === true;
  const needsRestart = /restart/i.test(message);
  const finished = /finish|fininshed/i.test(message);
  return { ok, message, needsRestart, finished };
}
