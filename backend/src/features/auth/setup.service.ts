import { db } from "../../db/database.js";
import { saveIntegritasApiKey } from "../settings/secrets.service.js";
import { recordAuditEvent } from "./audit.service.js";
import {
  countUsers,
  createSetupPending,
  createUser,
  getLatestSetupPending,
  clearSetupPending,
  markSetupPendingVerified
} from "./auth.repository.js";
import { validateIntegritasApiKey } from "./integritas-validation.service.js";
import { hashPassword } from "./password.service.js";
import { createSession } from "./session.service.js";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateSecret,
  getOtpAuthUrl,
  renderQrPngBase64,
  verifyToken
} from "./totp.service.js";

const SETUP_PENDING_TTL_MS = 15 * 60 * 1000;
const SETUP_PENDING_VERIFIED_TTL_MS = 30 * 60 * 1000;

export function isSetupComplete() {
  return countUsers() > 0;
}

export function assertSetupNotComplete() {
  if (isSetupComplete()) {
    throw new SetupError("Setup is already complete", 403);
  }
}

export class SetupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function initSetupTotp(username: string) {
  assertSetupNotComplete();

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 2) {
    throw new SetupError("username must be at least 2 characters", 400);
  }

  const secret = generateSecret();
  const encrypted = encryptTotpSecret(secret);
  const expiresAt = new Date(Date.now() + SETUP_PENDING_TTL_MS).toISOString();
  createSetupPending(encrypted, expiresAt);

  const otpAuthUrl = getOtpAuthUrl(secret, trimmedUsername);
  const qrCodePngBase64 = await renderQrPngBase64(otpAuthUrl);

  return { qrCodePngBase64, expiresAt };
}

export async function verifySetupTotp(totpToken: string) {
  assertSetupNotComplete();

  const token = totpToken.trim();
  if (!/^\d{6}$/.test(token)) {
    throw new SetupError("totpToken must be a 6-digit code", 400);
  }

  const pending = getLatestSetupPending();
  if (!pending) {
    throw new SetupError("TOTP setup expired or not initialized", 400);
  }

  const totpSecret = decryptTotpSecret(pending.totp_secret);
  if (!verifyToken(totpSecret, token)) {
    throw new SetupError("Invalid TOTP code", 400);
  }

  const verifiedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SETUP_PENDING_VERIFIED_TTL_MS).toISOString();
  markSetupPendingVerified(pending.id, verifiedAt, expiresAt);

  return { valid: true };
}

export async function verifySetupIntegritasKey(apiKey: string) {
  assertSetupNotComplete();
  const result = await validateIntegritasApiKey(apiKey);
  if (!result.ok) {
    throw new SetupError(result.error, 400);
  }
  return { valid: true };
}

export async function completeSetup(input: {
  username: string;
  password: string;
  integritasApiKey?: string;
}) {
  assertSetupNotComplete();

  const username = input.username.trim();
  const password = input.password;

  if (username.length < 2) throw new SetupError("username must be at least 2 characters", 400);
  if (password.length < 8) throw new SetupError("password must be at least 8 characters", 400);

  const pending = getLatestSetupPending();
  if (!pending) throw new SetupError("TOTP setup expired or not initialized", 400);
  if (!pending.verified_at) {
    throw new SetupError("TOTP must be verified before completing setup", 400);
  }

  const totpSecret = decryptTotpSecret(pending.totp_secret);

  const integritasApiKey = input.integritasApiKey?.trim() ?? "";
  if (integritasApiKey) {
    const validation = await validateIntegritasApiKey(integritasApiKey);
    if (!validation.ok) throw new SetupError(validation.error, 400);
  }

  const passwordHash = await hashPassword(password);
  const totpSecretEncrypted = encryptTotpSecret(totpSecret);

  const complete = db.transaction(() => {
    if (countUsers() > 0) throw new SetupError("Setup is already complete", 403);

    const userId = createUser({
      username,
      passwordHash,
      totpSecretEncrypted
    });

    if (integritasApiKey) {
      saveIntegritasApiKey(integritasApiKey);
      recordAuditEvent("integritas_api_key.save", { userId, detail: "during setup" });
    }

    clearSetupPending();
    recordAuditEvent("setup.complete", { userId, detail: username });

    return userId;
  });

  const userId = complete();
  const sessionToken = createSession(userId);

  return {
    sessionToken,
    user: { username, role: "admin" as const }
  };
}
