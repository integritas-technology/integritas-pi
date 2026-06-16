export type ParsedTokenCreateResponse = {
  ok: boolean;
  tokenId: string | null;
  txpowId: string | null;
  message?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function pickTokenId(record: Record<string, unknown>): string {
  const direct = asString(record.tokenid ?? record.tokenId, "");
  if (direct) return direct;
  const token = asRecord(record.token);
  return asString(token?.tokenid ?? token?.tokenId, "");
}

function pickTxpowId(record: Record<string, unknown>): string {
  const direct = asString(record.txpowid ?? record.txpowId, "");
  if (direct) return direct;
  const txpow = asRecord(record.txpow);
  return asString(txpow?.txpowid ?? txpow?.txpowId, "");
}

export function parseTokenCreateResponse(body: unknown): ParsedTokenCreateResponse {
  const record = asRecord(body);
  if (!record || record.status === false) {
    return {
      ok: false,
      tokenId: null,
      txpowId: null,
      message: asString(record?.error ?? record?.message, "Token creation failed")
    };
  }

  const response = asRecord(record.response) ?? record;
  const tokenId = pickTokenId(response);
  const txpowId = pickTxpowId(response);

  if (!tokenId) {
    return {
      ok: false,
      tokenId: null,
      txpowId: txpowId || null,
      message: "Minima did not return a token ID"
    };
  }

  return {
    ok: true,
    tokenId,
    txpowId: txpowId || null
  };
}
