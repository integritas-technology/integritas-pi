import bcrypt from "bcrypt";
import { recordAuditEvent } from "./audit.service.js";
import { findUserByUsername, updateUserLastLogin } from "./auth.repository.js";
import { verifyPassword } from "./password.service.js";
import { createSession } from "./session.service.js";
import { decryptTotpSecret, verifyToken } from "./totp.service.js";

const DUMMY_HASH = bcrypt.hashSync("integritas-pi-dummy-login-path", 12);

export async function login(input: { username: string; password: string; totpToken: string }) {
  const username = input.username.trim();
  const password = input.password;
  const totpToken = input.totpToken.trim();

  const user = findUserByUsername(username);

  const passwordHash = user?.password ?? DUMMY_HASH;
  const passwordValid = await verifyPassword(password, passwordHash);

  let totpValid = false;
  if (user && passwordValid && /^\d{6}$/.test(totpToken)) {
    try {
      const secret = decryptTotpSecret(user.totp_secret);
      totpValid = verifyToken(secret, totpToken);
    } catch {
      totpValid = false;
    }
  }

  if (!user || !passwordValid || !totpValid) {
    recordAuditEvent("login.failure", { detail: username || "unknown" });
    return { ok: false as const };
  }

  updateUserLastLogin(user.id);
  const sessionToken = createSession(user.id);
  recordAuditEvent("login.success", { userId: user.id, detail: user.username });

  return {
    ok: true as const,
    sessionToken,
    user: { username: user.username, role: user.role }
  };
}
