import bcrypt from "bcrypt";
import { LOCAL_ADMIN_DISPLAY_NAME, TOTP_ACCOUNT_LABEL, TOTP_ENABLED } from "./auth.constants.js";
import { recordAuditEvent } from "./audit.service.js";
import {
  clearSetupPending,
  createSetupPending,
  findTheUser,
  findUserById,
  getLatestSetupPending,
  updateUserLastLogin,
  updateUserPassword,
  updateUserTotpSecret
} from "./auth.repository.js";
import { adminCredentialValidationError, hashPassword, isValidAdminCredential, verifyPassword } from "./password.service.js";
import { createSession } from "./session.service.js";
import { decryptTotpSecret, encryptTotpSecret, generateSecret, getOtpAuthUrl, renderQrPngBase64, verifyToken } from "./totp.service.js";

const DUMMY_HASH = bcrypt.hashSync("integritas-pi-dummy-login-path", 12);
const TOTP_RESET_PENDING_TTL_MS = 15 * 60 * 1000;

export class AuthSettingsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function login(input: { password: string; totpToken?: string }) {
  const password = input.password;
  const totpToken = (input.totpToken ?? "").trim();

  const user = findTheUser();

  const passwordHash = user?.password ?? DUMMY_HASH;
  const passwordValid = await verifyPassword(password, passwordHash);

  let totpValid = !TOTP_ENABLED;
  if (TOTP_ENABLED) {
    totpValid = false;
    if (user && passwordValid && /^\d{6}$/.test(totpToken)) {
      try {
        const secret = decryptTotpSecret(user.totp_secret);
        totpValid = verifyToken(secret, totpToken);
      } catch {
        totpValid = false;
      }
    }
  }

  if (!user || !passwordValid || !totpValid) {
    recordAuditEvent("login.failure", { detail: "failed" });
    return { ok: false as const };
  }

  updateUserLastLogin(user.id);
  const sessionToken = createSession(user.id);
  recordAuditEvent("login.success", { userId: user.id, detail: LOCAL_ADMIN_DISPLAY_NAME });

  return {
    ok: true as const,
    sessionToken,
    user: { displayName: LOCAL_ADMIN_DISPLAY_NAME, role: user.role }
  };
}

export async function changePassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
    totpToken?: string;
  }
) {
  const user = findUserById(userId);
  if (!user) throw new AuthSettingsError("User not found", 404);

  const passwordValid = await verifyPassword(input.currentPassword, user.password);
  if (!passwordValid) throw new AuthSettingsError("Invalid current credential", 401);

  if (TOTP_ENABLED) {
    const token = (input.totpToken ?? "").trim();
    if (!/^\d{6}$/.test(token)) throw new AuthSettingsError("totpToken must be a 6-digit code", 400);

    let totpValid = false;
    try {
      const secret = decryptTotpSecret(user.totp_secret);
      totpValid = verifyToken(secret, token);
    } catch {
      totpValid = false;
    }
    if (!totpValid) throw new AuthSettingsError("Invalid TOTP code", 401);
  }

  if (!isValidAdminCredential(input.newPassword)) throw new AuthSettingsError(adminCredentialValidationError(), 400);

  const newHash = await hashPassword(input.newPassword);
  updateUserPassword(userId, newHash);
  recordAuditEvent("settings.password_changed", { userId, detail: LOCAL_ADMIN_DISPLAY_NAME });
}

export async function initTotpReset(
  userId: string,
  input: {
    currentPassword: string;
    totpToken: string;
  }
) {
  const user = findUserById(userId);
  if (!user) throw new AuthSettingsError("User not found", 404);

  const passwordValid = await verifyPassword(input.currentPassword, user.password);
  if (!passwordValid) throw new AuthSettingsError("Invalid current credential", 401);

  const token = input.totpToken.trim();
  if (!/^\d{6}$/.test(token)) throw new AuthSettingsError("totpToken must be a 6-digit code", 400);

  let totpValid = false;
  try {
    const secret = decryptTotpSecret(user.totp_secret);
    totpValid = verifyToken(secret, token);
  } catch {
    totpValid = false;
  }
  if (!totpValid) throw new AuthSettingsError("Invalid TOTP code", 401);

  const newSecret = generateSecret();
  const encrypted = encryptTotpSecret(newSecret);
  const expiresAt = new Date(Date.now() + TOTP_RESET_PENDING_TTL_MS).toISOString();
  createSetupPending(encrypted, expiresAt);

  const otpAuthUrl = getOtpAuthUrl(newSecret, TOTP_ACCOUNT_LABEL);
  const qrCodePngBase64 = await renderQrPngBase64(otpAuthUrl);

  return { qrCodePngBase64, secret: newSecret, expiresAt };
}

export async function verifyTotpReset(userId: string, totpToken: string) {
  const pending = getLatestSetupPending();
  if (!pending) throw new AuthSettingsError("TOTP reset expired or not initialized", 400);

  const token = totpToken.trim();
  if (!/^\d{6}$/.test(token)) throw new AuthSettingsError("totpToken must be a 6-digit code", 400);

  const newSecret = decryptTotpSecret(pending.totp_secret);
  if (!verifyToken(newSecret, token)) throw new AuthSettingsError("Invalid TOTP code", 400);

  updateUserTotpSecret(userId, pending.totp_secret);
  clearSetupPending();
  recordAuditEvent("settings.totp_reset", { userId, detail: LOCAL_ADMIN_DISPLAY_NAME });
}
