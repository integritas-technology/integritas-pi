import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { db } from "../../db/database.js";
import { buildAccountTokenBalances, parseAddressResponse, parseBalanceResponse, parseCoinsResponse, parseImportResponse, parsePaymentStatusResponse, parseSendResponse } from "./wallet.parse.js";
import type {
  ImportWalletResult,
  PaymentStatus,
  ReceiveAddress,
  SendPaymentRequest,
  SendPaymentResult,
  WalletAccount,
  WalletAccountBalance,
  WalletAccountCreateRequest,
  WalletAccountWithBalance,
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
  return parseAddressResponse(result.body);
}

export async function sendPayment({ address, amount, tokenId = "0x00", fromAccountAddress }: SendPaymentRequest): Promise<SendPaymentResult> {
  if (!address.trim()) throw new Error("Address is required");
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Amount must be a positive number");
  const from = typeof fromAccountAddress === "string" ? fromAccountAddress.trim() : "";
  const command = from
    ? `send amount:${amount} address:${address} tokenid:${tokenId} fromaddress:${from}`
    : `send amount:${amount} address:${address} tokenid:${tokenId}`;
  const result = await runMinimaPathCommand(command, 10_000);
  const parsedResult = parseSendResponse(result.body);
  if (!parsedResult.ok && from) {
    return {
      ...parsedResult,
      message: `${parsedResult.message ?? "Send failed"}. Address-scoped sending may not be supported by this Minima node.`
    };
  }
  return parsedResult;
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

function mapWalletAccount(row: {
  id: string;
  label: string;
  address: string;
  mini_address: string;
  public_key: string | null;
  created_at: string;
  updated_at: string;
}): WalletAccount {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    miniAddress: row.mini_address,
    publicKey: row.public_key ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listWalletAccounts(): WalletAccount[] {
  const rows = db.prepare(`
    SELECT id, label, address, mini_address, public_key, created_at, updated_at
    FROM wallet_accounts
    ORDER BY datetime(created_at) DESC
  `).all() as {
    id: string;
    label: string;
    address: string;
    mini_address: string;
    public_key: string | null;
    created_at: string;
    updated_at: string;
  }[];
  return rows.map(mapWalletAccount);
}

export async function createWalletAccount({ label }: WalletAccountCreateRequest): Promise<WalletAccount> {
  const cleanLabel = label.trim();
  if (!cleanLabel) throw new Error("label is required");
  const receive = await getReceiveAddress();
  const now = new Date().toISOString();
  const created: WalletAccount = {
    id: crypto.randomUUID(),
    label: cleanLabel,
    address: receive.address,
    miniAddress: receive.miniAddress,
    publicKey: receive.publicKey,
    createdAt: now,
    updatedAt: now
  };
  db.prepare(`
    INSERT INTO wallet_accounts (id, label, address, mini_address, public_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(created.id, created.label, created.address, created.miniAddress, created.publicKey ?? null, created.createdAt, created.updatedAt);
  return created;
}

export async function listWalletAccountsWithBalances(): Promise<WalletAccountWithBalance[]> {
  const accounts = listWalletAccounts();
  if (accounts.length === 0) return [];
  const coinResult = await runMinimaPathCommand("coins relevant:true");
  const allCoins = parseCoinsResponse(coinResult.body);
  return accounts.map((account) => {
    const accountCoins = allCoins.filter((coin) => coin.address === account.address);
    const tokens = buildAccountTokenBalances(accountCoins);
    const native = tokens.find((token) => token.isNative);
    const balance: WalletAccountBalance = {
      accountId: account.id,
      totalMinima: native?.amount ?? "0",
      tokenCount: tokens.filter((token) => !token.isNative && Number(token.amount) > 0).length,
      tokens
    };
    return { ...account, balance };
  });
}
