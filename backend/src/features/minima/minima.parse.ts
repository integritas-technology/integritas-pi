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

function readConnectingCount(response: Record<string, unknown>) {
  const network = asRecord(response.network);
  return typeof network?.connecting === "number" ? network.connecting : 0;
}

function readExplicitSynced(response: Record<string, unknown>) {
  if (typeof response.synced === "boolean") return response.synced;
  const chain = asRecord(response.chain);
  if (typeof chain?.synced === "boolean") return chain.synced;
  const cascade = asRecord(chain?.cascade);
  if (typeof cascade?.synced === "boolean") return cascade.synced;
  return null;
}

export type MinimaSyncStatus = "active" | "stale" | "syncing" | "unavailable";

const staleBlockAgeSeconds = 300;

export function deriveSyncStatus(input: {
  rpcOk: boolean;
  blockAgeSeconds: number | null;
  peerCount: number | null;
  connectingCount: number;
  explicitSynced: boolean | null;
}) {
  if (!input.rpcOk) {
    return { status: "unavailable" as const, synced: null };
  }

  if (input.explicitSynced !== null) {
    return {
      status: input.explicitSynced ? ("active" as const) : ("syncing" as const),
      synced: input.explicitSynced
    };
  }

  if (input.connectingCount > 0) {
    return { status: "syncing" as const, synced: false };
  }

  if (input.blockAgeSeconds !== null && input.blockAgeSeconds > staleBlockAgeSeconds) {
    return { status: "stale" as const, synced: false };
  }

  if (input.blockAgeSeconds !== null && (input.peerCount ?? 0) > 0) {
    return { status: "active" as const, synced: true };
  }

  if (input.blockAgeSeconds !== null) {
    return { status: "active" as const, synced: true };
  }

  return { status: "unavailable" as const, synced: null };
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
  const connectingCount = response ? readConnectingCount(response) : 0;
  const explicitSynced = response ? readExplicitSynced(response) : null;
  const sync = deriveSyncStatus({ rpcOk, blockAgeSeconds, peerCount, connectingCount, explicitSynced });

  return {
    rpcOk,
    block,
    blockTime,
    blockAgeSeconds,
    synced: sync.synced,
    syncStatus: sync.status,
    explicitSynced,
    peerCount,
    connectingCount,
    nodeMemory,
    dataPath
  };
}

export function parsePeersResponse(body: unknown): number | null {
  const envelope = asRecord(body);
  if (envelope?.status !== true) return null;

  const response = asRecord(envelope.response);
  if (response) {
    if (typeof response.size === "number") return response.size;
    if (typeof response.connected === "number") return response.connected;
    if (typeof response.peerslist === "string" && response.peerslist.trim()) {
      return response.peerslist.split(",").filter(Boolean).length;
    }
    if (Array.isArray(response.peers)) return response.peers.length;
  }

  if (Array.isArray(envelope.response)) return envelope.response.length;
  return null;
}

export function parseMegammrResyncMessage(body: unknown) {
  const envelope = asRecord(body);
  const response = asRecord(envelope?.response);
  const message = typeof response?.message === "string" ? response.message.trim() : "";
  const ok = envelope?.status === true;
  const needsRestart = /restart/i.test(message);
  const finished = /finish/i.test(message);
  return { ok, message, needsRestart, finished };
}
