import { decryptSecret, encryptSecret, type EncryptedSecret } from "../../shared/crypto.js";

/** AES-256-GCM encrypt for Integritas tokens at rest (keyed by APP_SECRET). Never log the plaintext. */
export function encryptIntegritasToken(plaintext: string): string {
  return JSON.stringify(encryptSecret(plaintext));
}

/** Decrypt Integritas token ciphertext from SQLite. Never log the result. */
export function decryptIntegritasToken(ciphertext: string): string {
  return decryptSecret(JSON.parse(ciphertext) as EncryptedSecret);
}
