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
