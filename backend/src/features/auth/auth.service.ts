import bcrypt from "bcrypt";
import { LOCAL_ADMIN_DISPLAY_NAME } from "./auth.constants.js";
import { recordAuditEvent } from "./audit.service.js";
import { findTheUser, updateUserLastLogin } from "./auth.repository.js";
import { verifyPassword } from "./password.service.js";
import { createSession } from "./session.service.js";
import { decryptTotpSecret, verifyToken } from "./totp.service.js";

const DUMMY_HASH = bcrypt.hashSync("integritas-pi-dummy-login-path", 12);

export async function login(input: { password: string; totpToken: string }) {
  const password = input.password;
  const totpToken = input.totpToken.trim();

  const user = findTheUser();

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
