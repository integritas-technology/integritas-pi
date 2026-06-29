import type { Request } from "express";

export type UserRole = "admin";

export type UserRecord = {
  id: string;
  username: string;
  password: string;
  totp_secret: string;
  role: UserRole;
  created_at: string;
  last_login: string | null;
};

export type SessionUser = {
  id: string;
  displayName: string;
  role: UserRole;
  lastLogin: string | null;
};

export type AuthenticatedRequest = Request & {
  user: SessionUser;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
  totpToken: string;
};

export type TotpResetVerifyRequest = {
  totpToken: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
