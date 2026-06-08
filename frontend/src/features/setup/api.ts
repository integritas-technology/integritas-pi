import { postJson } from "../../lib/api";

export async function initTotp(username: string) {
  return postJson<{ qrCodePngBase64: string; expiresAt: string }>("/api/setup/totp/init", { username });
}

export async function verifyIntegritasKey(apiKey: string) {
  return postJson<{ valid: boolean }>("/api/setup/integritas/verify", { apiKey });
}

export async function completeSetup(input: {
  username: string;
  password: string;
  totpToken: string;
  integritasApiKey?: string;
}) {
  return postJson<{ success: boolean; user: { username: string; role: "admin" } }>("/api/setup/complete", input);
}
