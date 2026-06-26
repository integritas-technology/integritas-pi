import { getJson, postJson } from "../../lib/api";
import type { AuthUser, SetupStatus } from "./types";

export async function getSetupStatus() {
  return getJson<SetupStatus>("/api/setup/status");
}

export async function getMe() {
  return getJson<AuthUser>("/api/auth/me");
}

export async function login(input: { password: string; totpToken: string }) {
  return postJson<{ success: boolean; user: AuthUser }>("/api/auth/login", input);
}

export async function logout() {
  return postJson<{ success: boolean }>("/api/auth/logout");
}

export async function changePassword(input: { currentPassword: string; newPassword: string; totpToken: string }) {
  return postJson<{ success: boolean }>("/api/auth/settings/password", input);
}

export async function initTotpReset(input: { currentPassword: string; totpToken: string }) {
  return postJson<{ qrCodePngBase64: string; secret: string; expiresAt: string }>("/api/auth/settings/totp/init", input);
}

export async function verifyTotpReset(input: { totpToken: string }) {
  return postJson<{ success: boolean }>("/api/auth/settings/totp/verify", input);
}
