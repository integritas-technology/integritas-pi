import { db } from "../../db/database.js";
import { getIntegritasAuth } from "../integritas-auth/integritas-auth.repository.js";
import { saveIntegritasApiKey } from "../settings/secrets.service.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { LOCAL_ADMIN_DISPLAY_NAME, LOCAL_ADMIN_USERNAME, TOTP_ACCOUNT_LABEL, TOTP_ENABLED } from "./auth.constants.js";
import { recordAuditEvent } from "./audit.service.js";
import {
  countUsers,
  createSetupPending,
  createUser,
  getLatestSetupPending,
  clearSetupPending,
  markSetupPendingVerified,
} from "./auth.repository.js";
import { validateIntegritasApiKey } from "./integritas-validation.service.js";
import { adminPinValidationError, hashPassword, isValidAdminPin } from "./password.service.js";
import { createSession } from "./session.service.js";
import { decryptTotpSecret, encryptTotpSecret, generateSecret, getOtpAuthUrl, renderQrPngBase64, verifyToken } from "./totp.service.js";

const SETUP_PENDING_TTL_MS = 15 * 60 * 1000;
const SETUP_PENDING_VERIFIED_TTL_MS = 30 * 60 * 1000;
const SETUP_COMPLETED_SETTING_KEY = "setup.completed_at";

export function isLocalAdminCreated() {
  return countUsers() > 0;
}

export function isSetupComplete() {
  return isLocalAdminCreated() && Boolean(getSetting(SETUP_COMPLETED_SETTING_KEY));
}

export function markSetupComplete() {
  if (!isLocalAdminCreated() || !getIntegritasAuth()) return;
  if (!getSetting(SETUP_COMPLETED_SETTING_KEY)) {
    saveSetting(SETUP_COMPLETED_SETTING_KEY, new Date().toISOString());
  }
}

export function assertLocalAdminNotCreated() {
  if (isLocalAdminCreated()) {
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

export async function initSetupTotp() {
  assertLocalAdminNotCreated();

  const secret = generateSecret();
  const encrypted = encryptTotpSecret(secret);
  const expiresAt = new Date(Date.now() + SETUP_PENDING_TTL_MS).toISOString();
  createSetupPending(encrypted, expiresAt);

  const otpAuthUrl = getOtpAuthUrl(secret, TOTP_ACCOUNT_LABEL);
  const qrCodePngBase64 = await renderQrPngBase64(otpAuthUrl);

  return { qrCodePngBase64, expiresAt, secret };
}

export async function verifySetupTotp(totpToken: string) {
  assertLocalAdminNotCreated();

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
  assertLocalAdminNotCreated();
  const result = await validateIntegritasApiKey(apiKey);
  if (!result.ok) {
    throw new SetupError(result.error, 400);
  }
  return { valid: true };
}

export async function completeSetup(input: { password: string; integritasApiKey?: string }) {
  assertLocalAdminNotCreated();

  const password = input.password;

  if (!isValidAdminPin(password)) throw new SetupError(adminPinValidationError(), 400);

  let totpSecretEncrypted: string;
  if (TOTP_ENABLED) {
    const pending = getLatestSetupPending();
    if (!pending) throw new SetupError("TOTP setup expired or not initialized", 400);
    if (!pending.verified_at) {
      throw new SetupError("TOTP must be verified before completing setup", 400);
    }
    totpSecretEncrypted = encryptTotpSecret(decryptTotpSecret(pending.totp_secret));
  } else {
    // Placeholder so users.totp_secret stays NOT NULL while TOTP is disabled.
    totpSecretEncrypted = encryptTotpSecret(generateSecret());
  }

  const integritasApiKey = input.integritasApiKey?.trim() ?? "";
  if (integritasApiKey) {
    const validation = await validateIntegritasApiKey(integritasApiKey);
    if (!validation.ok) throw new SetupError(validation.error, 400);
  }

  const passwordHash = await hashPassword(password);

  const complete = db.transaction(() => {
    if (countUsers() > 0) throw new SetupError("Setup is already complete", 403);

    const userId = createUser({
      username: LOCAL_ADMIN_USERNAME,
      passwordHash,
      totpSecretEncrypted,
    });

    if (integritasApiKey) {
      saveIntegritasApiKey(integritasApiKey);
      recordAuditEvent("integritas_api_key.save", { userId, detail: "during setup" });
    }

    clearSetupPending();
    recordAuditEvent("setup.complete", { userId, detail: LOCAL_ADMIN_DISPLAY_NAME });

    return userId;
  });

  const userId = complete();
  const sessionToken = createSession(userId);

  return {
    sessionToken,
    user: { displayName: LOCAL_ADMIN_DISPLAY_NAME, role: "admin" as const },
  };
}
