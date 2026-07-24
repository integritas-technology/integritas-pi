import QRCode from "qrcode";
import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { db } from "../../db/database.js";
import { parseAddressResponse, parseBalanceResponse, parseImportResponse, parsePaymentStatusResponse, parseSendResponse } from "./wallet.parse.js";
import type {
  ImportWalletResult,
  PaymentStatus,
  ReceiveAddress,
  SendPaymentRequest,
  SendPaymentResult,
  WalletSendHistoryItem,
  WalletStatus
} from "./wallet.types.js";

export async function getWalletStatus(): Promise<WalletStatus> {
  const result = await runMinimaPathCommand("balance");
  return parseBalanceResponse(result.body);
}

// Returns one of the 64 pre-created default wallet addresses at random.
// Uses getaddress — does NOT create new key material (that would be newaddress).
export async function getReceiveAddress(): Promise<ReceiveAddress> {
  const result = await runMinimaPathCommand("getaddress");
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  const address = parseAddressResponse(result.body);
  const qrDataUrl = await QRCode.toDataURL(address.miniAddress, { type: "image/png", margin: 1 });
  return { ...address, qrDataUrl };
}

export async function sendPayment({ address, amount, tokenId = "0x00" }: SendPaymentRequest): Promise<SendPaymentResult> {
  if (!address.trim()) throw new Error("Address is required");
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Amount must be a positive number");
  const result = await runMinimaPathCommand(`send amount:${amount} address:${address} tokenid:${tokenId}`, 10_000);
  return parseSendResponse(result.body);
}

export async function getPaymentStatus(txpowId: string): Promise<PaymentStatus> {
  const result = await runMinimaPathCommand(`txpow txpowid:${txpowId}`);
  return parsePaymentStatusResponse(result.body, txpowId);
}

// Restores wallet from a 24-word seed phrase via Minima restore RPC.
// The phrase must never be logged — do not pass it to recordAuditEvent detail.
export async function importWallet(phrase: string): Promise<ImportWalletResult> {
  const result = await runMinimaPathCommand(`restore phrase:"${phrase}"`, 30_000);
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  return parseImportResponse(result.body);
}

export function clearWalletSendHistoryForDebug(): number {
  const result = db.prepare("DELETE FROM wallet_send_history").run();
  return result.changes;
}

export function recordWalletSendHistory(input: {
  toAddress: string;
  tokenId: string;
  tokenName: string;
  amount: string;
  txpowId: string | null;
  status: "submitted" | "failed";
}) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO wallet_send_history (
      id, created_at, from_account_label, from_account_address, to_address, token_id, token_name, amount, txpow_id, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    createdAt,
    null,
    null,
    input.toAddress,
    input.tokenId,
    input.tokenName,
    input.amount,
    input.txpowId,
    input.status
  );
}

export function listWalletSendHistory(limit = 30): WalletSendHistoryItem[] {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = db.prepare(`
    SELECT id, created_at, to_address, token_id, token_name, amount, txpow_id, status
    FROM wallet_send_history
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).all(safeLimit) as {
    id: string;
    created_at: string;
    to_address: string;
    token_id: string;
    token_name: string;
    amount: string;
    txpow_id: string | null;
    status: "submitted" | "failed";
  }[];
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    toAddress: row.to_address,
    tokenId: row.token_id,
    tokenName: row.token_name,
    amount: row.amount,
    txpowId: row.txpow_id,
    status: row.status
  }));
}
