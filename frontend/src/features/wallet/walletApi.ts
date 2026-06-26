import { getJson, postJson } from "../../lib/api";
import type { ImportWalletResult, PaymentStatus, ReceiveAddress, SendPaymentRequest, SendPaymentResult, WalletSendHistoryItem, WalletStatus } from "./walletTypes";

export function getWalletStatus() {
  return getJson<WalletStatus>("/api/wallet");
}

export function getReceiveAddress() {
  return postJson<ReceiveAddress>("/api/wallet/receive-address");
}

export function sendPayment(body: SendPaymentRequest) {
  return postJson<SendPaymentResult>("/api/wallet/send-payment", body);
}

export function getPaymentStatus(txpowId: string) {
  return getJson<PaymentStatus>(`/api/wallet/payment-status/${encodeURIComponent(txpowId)}`);
}

export function importWallet(phrase: string) {
  return postJson<ImportWalletResult>("/api/wallet/import", { phrase });
}

export function clearWalletHistoryForDebug() {
  return postJson<{ ok: boolean; deleted: number }>("/api/wallet/debug/clear-wallet-history");
}

export function listWalletSendHistory(limit = 30) {
  return getJson<{ sends: WalletSendHistoryItem[] }>(`/api/wallet/history?limit=${encodeURIComponent(String(limit))}`);
}
