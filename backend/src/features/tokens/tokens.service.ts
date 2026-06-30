import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { getWalletStatus } from "../wallet/wallet.service.js";
import { parseTokenCreateResponse } from "./tokens.parse.js";
import { getCustomTokenByTokenId, insertCustomToken, listCustomTokens } from "./tokens.repository.js";
import { lookupKnownToken } from "./tokens.known.js";
import type { CreateTokenRequest, CreateTokenResult, TokenCreateRequirements, TokenListResponse } from "./tokens.types.js";

const TOKEN_CREATE_TIMEOUT_MS = 60_000;

/** Conservative operator-facing estimate; actual colouring cost is a tiny MINIMA fraction. */
export const TOKEN_CREATE_ESTIMATED_MINIMA = "0.001";

/** Minimum total wallet sendable MINIMA required to create a token. */
export const TOKEN_CREATE_MIN_ACCOUNT_MINIMA = "0.001";

function formatRpcValue(value: string): string {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function validateCreateInput(input: CreateTokenRequest): void {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");

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
    note: "Minima colours a tiny fraction of MINIMA to mint a token. The wallet must hold at least the minimum sendable MINIMA."
  };
}

export async function createCustomToken(input: CreateTokenRequest): Promise<CreateTokenResult> {
  validateCreateInput(input);

  const name = input.name.trim();
  const amount = input.amount.trim();
  const decimal = input.decimal;

  const walletStatus = await getWalletStatus();
  const nativeToken = walletStatus.tokens.find((t) => t.isNative);
  const availableMinima = nativeToken?.sendable ?? "0";

  if (Number(availableMinima) < Number(TOKEN_CREATE_MIN_ACCOUNT_MINIMA)) {
    return {
      ok: false,
      tokenId: null,
      name,
      amount,
      decimal,
      txpowId: null,
      message: `Insufficient MINIMA. Wallet needs at least ${TOKEN_CREATE_MIN_ACCOUNT_MINIMA} sendable MINIMA to create a token.`
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
      ? `No spendable MINIMA coins available. Ensure the wallet holds at least ${TOKEN_CREATE_MIN_ACCOUNT_MINIMA} MINIMA.`
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
      const known = lookupKnownToken(token.tokenId);
      return {
        tokenId: token.tokenId,
        name: known?.name ?? local?.name ?? token.name,
        confirmed: token.confirmed,
        unconfirmed: token.unconfirmed,
        sendable: token.sendable,
        isNative: false,
        createdLocally: Boolean(local),
        decimal: local?.decimal,
        ...(known && { knownSymbol: known.symbol, knownName: known.name }),
      };
    });

  return {
    checkedAt: walletStatus.checkedAt,
    tokens
  };
}
