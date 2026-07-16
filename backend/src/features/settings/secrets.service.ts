import { env } from "../../config/env.js";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "../../shared/crypto.js";
import { decryptIntegritasToken } from "../integritas-auth/integritas-auth-crypto.service.js";
import { getIntegritasAuth } from "../integritas-auth/integritas-auth.repository.js";
import { deleteSetting, getSetting, saveSetting } from "./settings.repository.js";

const integritasApiKeySetting = "integritas_api_key";

export function saveIntegritasApiKey(apiKey: string) {
  saveSetting(integritasApiKeySetting, JSON.stringify(encryptSecret(apiKey)));
}

export function deleteIntegritasApiKey() {
  deleteSetting(integritasApiKeySetting);
}

export function getStoredIntegritasApiKey() {
  const encryptedValue = getSetting(integritasApiKeySetting);
  if (!encryptedValue) return "";

  try {
    return decryptSecret(JSON.parse(encryptedValue) as EncryptedSecret);
  } catch (error) {
    console.error("Failed to decrypt stored Integritas API key", error);
    return "";
  }
}

export function getConnectedIntegritasApiKey() {
  const encryptedValue = getIntegritasAuth()?.api_key_enc;
  if (!encryptedValue) return "";

  try {
    return decryptIntegritasToken(encryptedValue);
  } catch {
    console.error("Failed to decrypt Integritas Connect API key");
    return "";
  }
}

export function getIntegritasApiKey() {
  return getConnectedIntegritasApiKey() || getStoredIntegritasApiKey() || env.integritasApiKeyFallback;
}

export function integritasApiKeySource() {
  if (getConnectedIntegritasApiKey()) return "connect";
  if (getStoredIntegritasApiKey()) return "database";
  if (env.integritasApiKeyFallback) return "environment";
  return "none";
}
