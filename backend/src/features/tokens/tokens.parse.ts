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

function isRealTokenId(tokenId: string): boolean {
  const normalized = tokenId.trim().toLowerCase();
  return Boolean(normalized) && normalized !== "0x00" && normalized !== "0xff";
}

function pickTokenId(record: Record<string, unknown>): string {
  const direct = asString(record.tokenid ?? record.tokenId, "");
  if (isRealTokenId(direct)) return direct;
  const token = asRecord(record.token);
  const nested = asString(token?.tokenid ?? token?.tokenId, "");
  return isRealTokenId(nested) ? nested : "";
}

function findTokenIdInTxpow(response: Record<string, unknown>): string {
  const body = asRecord(response.body);
  const txn = asRecord(body?.txn);
  const outputs = txn?.outputs;
  if (!Array.isArray(outputs)) return "";
  for (const item of outputs) {
    const output = asRecord(item);
    if (!output) continue;
    const token = asRecord(output.token);
    const tokenId = asString(token?.tokenid ?? token?.tokenId, "");
    if (isRealTokenId(tokenId)) return tokenId;
  }
  return "";
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
  const tokenId = pickTokenId(response) || findTokenIdInTxpow(response);
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
