# Auth settings

**Status:** Complete  
**Branch:** `auth-settings`  
**Goal:** Add a settings page where the user can change their password and reset their 2FA after initial setup. Replace the static "Administrator" label in the sidebar with a settings entry point.

**Why:** The setup wizard handles first-time auth config, but there is no way to change the password or rotate the TOTP secret post-setup. The sidebar user box also shows a hardcoded "Administrator" string instead of something actionable.

---

## Part 1 — Backend

Files: `auth.routes.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.types.ts`

**New protected routes in `auth.routes.ts`:**
- `POST /api/auth/settings/password` — change password; inputs: `currentPassword`, `newPassword`, `totpToken`; verify both before updating hash; log audit event
- `POST /api/auth/settings/totp/init` — begin TOTP reset; verify `currentPassword` + current `totpToken`; generate new secret, store in `setup_pending`, return QR code + manual key
- `POST /api/auth/settings/totp/verify` — confirm new TOTP code from init flow; on success write new encrypted secret to user record; log audit event

**`auth.service.ts`:** add `changePassword`, `initTotpReset`, `verifyTotpReset` functions (follow same pattern as `setup.service.ts` equivalents).

**`auth.repository.ts`:** add `updateUserPassword`, `updateUserTotpSecret`.

**`auth.types.ts`:** add `ChangePasswordRequest`, `TotpResetVerifyRequest`.

---

## Part 2 — Frontend

Files: `SidebarUserBox.tsx`, `App.tsx`, `nav.ts`, `auth/api.ts`, new `AuthSettingsPage.tsx`

**`SidebarUserBox.tsx`:**
- Replace the static "Administrator" icon + text block with a settings icon button (navigate to settings page)
- Pull `displayName` from the `user` prop instead of the hardcoded string
- Keep sign-out button unchanged

**`nav.ts`:** add a `settings` nav id (hidden from sidebar nav list — only reachable via the sidebar user box button).

**`App.tsx`:** add route for the settings nav id → `AuthSettingsPage`.

**`auth/api.ts`:** add `changePassword`, `initTotpReset`, `verifyTotpReset` API calls.

**New `AuthSettingsPage.tsx`** with two sections:
- **Change password** — form: current password, new password, TOTP code; submit calls `changePassword`; show success/error inline
- **Reset 2FA** — warning text + confirm button; on confirm calls `initTotpReset` and shows QR code + manual key inline (same layout as setup wizard step 2); TOTP verify input to complete; QR shown only once (mirrors setup wizard "see once" principle)

---

## Part 3 — Cleanup

- `auth.constants.ts`: confirm `TOTP_ACCOUNT_LABEL` value (`"Edge Workbench"`) is still correct for the product name
- `SidebarUserBox.tsx`: remove any leftover hardcoded `"Administrator"` strings after Part 2
- `CHANGELOG.md`: add `[Unreleased]` entry for auth settings page
