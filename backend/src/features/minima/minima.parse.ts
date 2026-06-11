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

function readSynced(response: Record<string, unknown>) {
  if (typeof response.synced === "boolean") return response.synced;
  const chain = asRecord(response.chain);
  if (typeof chain?.synced === "boolean") return chain.synced;
  const cascade = asRecord(response.cascade);
  if (typeof cascade?.synced === "boolean") return cascade.synced;
  return null;
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

  return {
    rpcOk,
    block,
    blockTime,
    blockAgeSeconds,
    synced: response ? readSynced(response) : null,
    peerCount: response ? readPeerCount(response) : null,
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
