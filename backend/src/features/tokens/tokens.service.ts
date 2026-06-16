import { runMinimaPathCommand } from "../minima/minima.rpc.js";
import { getWalletStatus } from "../wallet/wallet.service.js";
import { parseTokenCreateResponse } from "./tokens.parse.js";
import { getCustomTokenByTokenId, insertCustomToken, listCustomTokens } from "./tokens.repository.js";
import type { CreateTokenRequest, CreateTokenResult, TokenListResponse } from "./tokens.types.js";

const TOKEN_CREATE_TIMEOUT_MS = 60_000;

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

export async function createCustomToken(input: CreateTokenRequest): Promise<CreateTokenResult> {
  validateCreateInput(input);

  const name = input.name.trim();
  const amount = input.amount.trim();
  const decimal = input.decimal;
  const command = `tokencreate name:${formatRpcValue(name)} amount:${amount} decimal:${decimal}`;
  const result = await runMinimaPathCommand(command, TOKEN_CREATE_TIMEOUT_MS);

  if (!result.ok) {
    throw new Error(`Minima RPC error: HTTP ${result.status}`);
  }

  const parsed = parseTokenCreateResponse(result.body);
  if (!parsed.ok || !parsed.tokenId) {
    return {
      ok: false,
      tokenId: null,
      name,
      amount,
      decimal,
      txpowId: parsed.txpowId,
      message: parsed.message ?? "Token creation failed"
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
