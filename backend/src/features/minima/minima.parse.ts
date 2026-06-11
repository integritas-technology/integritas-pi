function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseBlockNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBlockTiming(timemilli: unknown) {
  if (timemilli === null || timemilli === undefined || timemilli === "") {
    return { blockTime: null, blockAgeSeconds: null };
  }

  const ms = Number(timemilli);
  if (!Number.isFinite(ms)) {
    return { blockTime: null, blockAgeSeconds: null };
  }

  const blockTime = new Date(ms).toISOString();
  const blockAgeSeconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return { blockTime, blockAgeSeconds };
}

function readPeerCount(response: Record<string, unknown>) {
  const network = asRecord(response.network);
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

export function parseStatusResponse(body: unknown) {
  const envelope = asRecord(body);
  const rpcOk = envelope?.status === true;
  const response = asRecord(envelope?.response);
  const chain = asRecord(response?.chain);

  const block = parseBlockNumber(chain?.block ?? response?.block);
  const { blockTime, blockAgeSeconds } = parseBlockTiming(chain?.timemilli ?? response?.timemilli);

  return {
    rpcOk,
    block,
    blockTime,
    blockAgeSeconds,
    synced: response ? readSynced(response) : null,
    peerCount: response ? readPeerCount(response) : null
  };
}

export function parsePeersResponse(body: unknown): number | null {
  const envelope = asRecord(body);
  if (envelope?.status !== true) return null;

  if (Array.isArray(envelope.response)) return envelope.response.length;

  const response = asRecord(envelope.response);
  if (!response) return null;
  if (Array.isArray(response.peers)) return response.peers.length;
  if (typeof response.count === "number") return response.count;
  return null;
}
