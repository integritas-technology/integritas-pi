import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { parseAddressResponse, parseBalanceResponse, parsePaymentStatusResponse, parseSendResponse } from "./wallet.parse.js";
import type { PaymentStatus, ReceiveAddress, SendPaymentRequest, SendPaymentResult, WalletStatus } from "./wallet.types.js";

export async function getWalletStatus(): Promise<WalletStatus> {
  const result = await runMinimaPathCommand("balance");
  return parseBalanceResponse(result.body);
}

// Returns one of the 64 pre-created default wallet addresses at random.
// Uses getaddress — does NOT create new key material (that would be newaddress).
export async function getReceiveAddress(): Promise<ReceiveAddress> {
  const result = await runMinimaPathCommand("getaddress");
  if (!result.ok) throw new Error(`Minima RPC error: HTTP ${result.status}`);
  return parseAddressResponse(result.body);
}

export async function sendPayment({ address, amount, tokenId = "0x00" }: SendPaymentRequest): Promise<SendPaymentResult> {
  if (!address.trim()) throw new Error("Address is required");
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Amount must be a positive number");
  const command = `send amount:${amount} address:${address} tokenid:${tokenId}`;
  const result = await runMinimaPathCommand(command, 10_000);
  return parseSendResponse(result.body);
}

export async function getPaymentStatus(txpowId: string): Promise<PaymentStatus> {
  const result = await runMinimaPathCommand(`txpow txpowid:${txpowId}`);
  return parsePaymentStatusResponse(result.body, txpowId);
}
