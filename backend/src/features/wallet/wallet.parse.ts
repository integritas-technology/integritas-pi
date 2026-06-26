import type {
  ImportWalletResult,
  PaymentStatus,
  ReceiveAddress,
  SendPaymentResult,
  TokenBalance,
  WalletStatus
} from "./wallet.types.js";

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

export function parseAddressResponse(body: unknown): ReceiveAddress {
  const record = asRecord(body);
  const response = asRecord(record?.response);
  const miniAddress = asString(response?.miniaddress, "");
  const address = asString(response?.address, "");
  if (!miniAddress && !address) throw new Error("Minima did not return an address");
  const publicKey = typeof response?.publickey === "string" ? response.publickey : undefined;
  return { miniAddress: miniAddress || address, address: address || miniAddress, publicKey };
}

export function parseSendResponse(body: unknown): SendPaymentResult {
  const record = asRecord(body);
  if (record?.status === false) {
    return {
      ok: false,
      txpowId: null,
      status: "failed",
      message: asString(record.error ?? record.message, "Send failed")
    };
  }
  const response = asRecord(record?.response);
  const inner = asRecord(response?.txpow);
  const txpowId = asString(response?.txpowid ?? inner?.txpowid, "") || null;
  return { ok: true, txpowId, status: "pending" };
}

export function parsePaymentStatusResponse(body: unknown, txpowId: string): PaymentStatus {
  const checkedAt = new Date().toISOString();
  const record = asRecord(body);
  if (!record || record.status === false) return { txpowId, status: "unknown", checkedAt };
  const response = asRecord(record.response);
  if (!response) return { txpowId, status: "unknown", checkedAt };
  const txpow = asRecord(response.txpow);
  if (!txpow) return { txpowId, status: "unknown", checkedAt };
  const confirmed = response.confirmed === true || txpow.isblock === true;
  return { txpowId, status: confirmed ? "confirmed" : "pending", checkedAt };
}

export function parseImportResponse(body: unknown): ImportWalletResult {
  const record = asRecord(body);
  if (record?.status === false) {
    return { ok: false, message: asString(record.error ?? record.message, "Import failed") };
  }
  return { ok: true, message: "Wallet restored. The node may restart to apply the new seed." };
}
