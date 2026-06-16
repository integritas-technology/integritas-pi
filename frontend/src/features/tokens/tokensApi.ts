import { getJson, postJson } from "../../lib/api";
import type { CreateTokenRequest, CreateTokenResult, TokenCreateRequirements, TokenListResponse } from "./tokensTypes";

export function listTokens() {
  return getJson<TokenListResponse>("/api/tokens");
}

export function getTokenCreateRequirements() {
  return getJson<TokenCreateRequirements>("/api/tokens/create-requirements");
}

export function createToken(body: CreateTokenRequest) {
  return postJson<CreateTokenResult>("/api/tokens/create", body);
}
