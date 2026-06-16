import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { getWalletAccountByAddress, getWalletStatus } from "../wallet/wallet.service.js";
import { addDecimalStrings, compareDecimalStrings, parseCoinsResponse } from "../wallet/wallet.parse.js";
import { parseTokenCreateResponse } from "./tokens.parse.js";
import { getCustomTokenByTokenId, insertCustomToken, listCustomTokens } from "./tokens.repository.js";
import type { CreateTokenRequest, CreateTokenResult, TokenCreateRequirements, TokenListResponse } from "./tokens.types.js";

const TOKEN_CREATE_TIMEOUT_MS = 60_000;

/** Conservative operator-facing estimate; actual colouring cost is a tiny MINIMA fraction. */
export const TOKEN_CREATE_ESTIMATED_MINIMA = "0.001";

/** Minimum native MINIMA required on the selected labeled account address. */
export const TOKEN_CREATE_MIN_ACCOUNT_MINIMA = "0.001";

function formatRpcValue(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function sumNativeOnAddress(coins: ReturnType<typeof parseCoinsResponse>, address: string): string {
  let total = "0";
  for (const coin of coins) {
    if (coin.address !== address || coin.tokenId !== "0x00" || coin.spent) continue;
    total = addDecimalStrings(total, coin.amount);
  }
  return total;
}

function validateCreateInput(input: CreateTokenRequest): void {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");

  const fromAccountAddress = input.fromAccountAddress.trim();
  if (!fromAccountAddress) throw new Error("fromAccountAddress is required");

  const amount = input.amount.trim();
  const parsedAmount = Number(amount);
  if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("amount must be a positive number");
  }

  if (!Number.isInteger(input.decimal) || input.decimal < 0) {
    throw new Error("decimal must be a non-negative integer");
  }
}

export function getTokenCreateRequirements(): TokenCreateRequirements {
  return {
    estimatedMinimaCost: TOKEN_CREATE_ESTIMATED_MINIMA,
    minimumAccountMinima: TOKEN_CREATE_MIN_ACCOUNT_MINIMA,
    note:
      "Minima colours a tiny fraction of MINIMA to mint a token. Only the selected labeled account is checked; its address must hold at least the minimum. Minima spends from that account's coins only when they exist on its address."
  };
}

export async function createCustomToken(input: CreateTokenRequest): Promise<CreateTokenResult> {
  validateCreateInput(input);

  const name = input.name.trim();
  const amount = input.amount.trim();
  const decimal = input.decimal;
  const fromAccountAddress = input.fromAccountAddress.trim();

  const account = getWalletAccountByAddress(fromAccountAddress);
  if (!account) {
    return {
      ok: false,
      tokenId: null,
      name,
      amount,
      decimal,
      txpowId: null,
      message:
        "fromAccountAddress must be a labeled wallet account. Label a funded address on the Wallet page first."
    };
  }

  const coinResult = await runMinimaPathCommand("coins relevant:true");
  const allCoins = parseCoinsResponse(coinResult.body);
  const availableMinima = sumNativeOnAddress(allCoins, fromAccountAddress);

  if (compareDecimalStrings(availableMinima, TOKEN_CREATE_MIN_ACCOUNT_MINIMA) < 0) {
    return {
      ok: false,
      tokenId: null,
      name,
      amount,
      decimal,
      txpowId: null,
      message:
        `${account.label} has insufficient MINIMA on its address (needs at least ${TOKEN_CREATE_MIN_ACCOUNT_MINIMA}). Receive MINIMA to this account or label an address that already holds MINIMA.`
    };
  }

  const command = `tokencreate name:${formatRpcValue(name)} amount:${amount} decimals:${decimal}`;
  const result = await runMinimaPathCommand(command, TOKEN_CREATE_TIMEOUT_MS);

  if (!result.ok) {
    throw new Error(`Minima RPC error: HTTP ${result.status}`);
  }

  const parsed = parseTokenCreateResponse(result.body);
  if (!parsed.ok || !parsed.tokenId) {
    const message = parsed.message ?? "Token creation failed";
    const friendly = message.includes("No Minima Coins available")
      ? `${account.label} does not have spendable MINIMA coins Minima can use. Ensure this account's address holds at least ${TOKEN_CREATE_MIN_ACCOUNT_MINIMA} MINIMA.`
      : message;
    return {
      ok: false,
      tokenId: null,
      name,
      amount,
      decimal,
      txpowId: parsed.txpowId,
      message: friendly
    };
  }

  const existing = getCustomTokenByTokenId(parsed.tokenId);
  if (!existing) {
    insertCustomToken({
      tokenId: parsed.tokenId,
      name,
      amount,
      decimal,
      txpowId: parsed.txpowId
    });
  }

  return {
    ok: true,
    tokenId: parsed.tokenId,
    name,
    amount,
    decimal,
    txpowId: parsed.txpowId,
    message: "Token created"
  };
}

export async function listWalletTokens(): Promise<TokenListResponse> {
  const walletStatus = await getWalletStatus();
  const localByTokenId = new Map(listCustomTokens().map((row) => [row.token_id, row]));

  const tokens = walletStatus.tokens
    .filter((token) => !token.isNative)
    .map((token) => {
      const local = localByTokenId.get(token.tokenId);
      return {
        tokenId: token.tokenId,
        name: local?.name ?? token.name,
        confirmed: token.confirmed,
        unconfirmed: token.unconfirmed,
        sendable: token.sendable,
        isNative: false as const,
        createdLocally: Boolean(local),
        decimal: local?.decimal
      };
    });

  return {
    checkedAt: walletStatus.checkedAt,
    tokens
  };
}
