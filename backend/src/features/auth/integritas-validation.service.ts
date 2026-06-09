import { requestProofUid } from "../integritas/integritas.service.js";

const VALIDATION_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export async function validateIntegritasApiKey(apiKey: string) {
  if (!apiKey.trim()) {
    return { ok: false as const, error: "API key is required" };
  }

  const result = await requestProofUid({ apiKey: apiKey.trim(), hash: VALIDATION_HASH });
  if (!result.ok) {
    if (result.errorCode === "unauthorized") {
      return { ok: false as const, error: "Invalid Integritas API key" };
    }
    return { ok: false as const, error: "Integritas API key validation failed" };
  }

  return { ok: true as const };
}
