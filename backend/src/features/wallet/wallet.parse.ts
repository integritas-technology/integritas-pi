import type { TokenBalance, WalletStatus } from "./wallet.types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseToken(raw: unknown): TokenBalance | null {
  const item = asRecord(raw);
  if (!item) return null;

  const tokenId = asString(item.tokenid, "");
  if (!tokenId) return null;

  const isNative = tokenId === "0x00";
  const rawName = item.token;
  let name: string;
  if (isNative) {
    name = "Minima";
  } else if (typeof rawName === "string" && rawName.trim()) {
    name = rawName.trim();
  } else {
    name = tokenId;
  }

  return {
    tokenId,
    name,
    confirmed: asString(item.confirmed, "0"),
    unconfirmed: asString(item.unconfirmed, "0"),
    sendable: asString(item.sendable, "0"),
    isNative
  };
}

export function parseBalanceResponse(body: unknown): WalletStatus {
  const checkedAt = new Date().toISOString();
  const record = asRecord(body);
  const response = record?.response;

  if (!Array.isArray(response)) {
    return { checkedAt, tokens: [] };
  }

  const tokens: TokenBalance[] = [];
  for (const item of response) {
    const token = parseToken(item);
    if (token) tokens.push(token);
  }

  return { checkedAt, tokens };
}
