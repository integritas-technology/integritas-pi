# Auth & Setup Wizard — Implementation Audit Report

**Generated:** 2026-06-09  
**Scope:** Phase 1 authentication, session management, first-run setup wizard, and route protection  
**References:** [auth-implementation.md](../plans/auth-implementation.md), [auth-security.md](../plans/auth-security.md), [auth-gaps.md](../qa/auth-gaps.md), [SECURITY.md](../../SECURITY.md)

This report summarizes what was implemented (from git history and current code), lists every file to audit, breaks down frontend/backend changes, and records security findings for review.

---

## Executive summary

Phase 1 auth is **implemented and wired end-to-end**:

- SQLite tables: `users`, `sessions`, `setup_pending`, `audit_events`
- Password (bcrypt) + mandatory TOTP at setup and login
- Stateful HttpOnly session cookies with SHA-256 hashed tokens in DB
- `requireAuth` on all `/api/*` except health, setup, and login
- `requireRole('admin')` on high-risk mutations (API key, files, automation/data-source writes)
- Rate limiting on login and setup endpoints
- Frontend bootstrap: setup status → wizard **or** session check → app shell **or** login
- Mock `localStorage` guest/onboarding gates **removed**

**Overall posture:** Appropriate for a trusted LAN prototype. Residual risks are documented (HTTP cookies, no CLI auth, no automated security tests, TOTP secret exposed during setup for manual-entry UX). See [Security findings](#security-findings-for-review) below.

---

## Git history (auth-related)

| Date | Commit | Summary |
|------|--------|---------|
| (earlier) | `f73a8de` | Added `docs/plans/auth-implementation.md`, `docs/plans/auth-security.md`; updated `SECURITY.md` |
| (earlier) | `640de47` | Refined auth/onboarding plan docs |
| 2026-06-08 | `704e575` | **Main implementation:** backend auth feature, DB migrations, `requireAuth`, frontend `AuthProvider`, wizard/login migration from mocks, docs/README/SECURITY updates |
| 2026-06-08 | `715921c` | Added `POST /api/setup/totp/verify`, `verified_at` on `setup_pending`, setup must verify TOTP before complete |
| 2026-06-09 | `2b38829` | Wizard UX: manual TOTP key display/copy; `secret` returned from `totp/init` for frontend |

Earlier UI-only work (pre-backend auth):

| Commit | Summary |
|--------|---------|
| `01f2e82` | Tailwind + mock onboarding wizard in `frontend/src/mock/onboarding/` |
| `8df79db`, `920cd37`, `b989e2d` | Mock login and 2FA onboarding UI |
| `60bcbbe`, `095e0ca`, `e2f4556` | Onboarding component/style refactors |

---

## What was implemented vs plan

| Area | Planned | Implemented | Notes |
|------|---------|-------------|-------|
| DB in `integritas-pi.db` | Yes | Yes | WAL mode enabled |
| Feature folder `backend/src/features/auth/` | Yes | Yes | 13 files |
| Session cookie env (`COOKIE_SECURE`, TTLs) | Yes | Yes | `.env.example` updated |
| `requireAuth` global gate | Yes | Yes | `app.ts` |
| Public routes list | Yes | Yes | health, setup/*, auth/login |
| Rate limit login/setup | Yes | Yes | 5 req / 15 min / IP |
| Generic login errors | Yes | Yes | Always `"Invalid credentials"` |
| Constant-time password path | Yes | Yes | Dummy bcrypt when user missing |
| Audit events | Yes | Partial | login success/failure, logout, setup.complete, api-key save/delete |
| TOTP verify on setup complete only | Yes | **Changed** | Separate `POST /api/setup/totp/verify` + `verified_at` (stricter) |
| Never return raw TOTP secret in JSON | Yes | **No** | `secret` returned for manual key UX (see finding F-01) |
| Frontend `credentials: "include"` | Yes | Yes | `lib/api.ts` |
| Remove mock guest/localStorage | Yes | Yes | `mock/` deleted |
| `requireRole('admin')` on high-risk routes | Yes | Yes | integritas api-key, files, automation/data-source mutations |
| Automated security tests | Planned | **No** | No test files found |
| Session expiry cleanup job | Implied | **No** | `deleteExpiredSessions()` exists but is never scheduled |

---

## Architecture (current)

```txt
Browser
  → Nginx :8080 (frontend)
  → /api/* proxied to backend :3000
  → cookie-parser reads `session` cookie
  → public: /api/health, /api/setup/*, POST /api/auth/login
  → requireAuth → all other /api/*
  → requireRole('admin') on selected mutations
  → SQLite /data/integritas-pi.db
```

### Bootstrap flow (frontend)

```txt
App load
  → GET /api/setup/status
      setupComplete: false  → OnboardingWizard
      setupComplete: true   → GET /api/auth/me (cookie)
          200 → AppShell (AuthContext)
          401 → LoginPage
Wizard finish → POST /api/setup/complete → Set-Cookie → refreshSession → AppShell
Login        → POST /api/auth/login      → Set-Cookie → refreshSession → AppShell
Logout       → POST /api/auth/logout     → clear cookie
```

---

## Complete file audit list

Use this checklist to review files one by one. **Priority** indicates suggested audit order.

### Backend — auth feature (priority: critical)

| # | File | Role |
|---|------|------|
| 1 | `backend/src/features/auth/auth.routes.ts` | Login, logout, `/me` |
| 2 | `backend/src/features/auth/setup.routes.ts` | Setup status, TOTP init/verify, Integritas verify, complete |
| 3 | `backend/src/features/auth/auth.service.ts` | Login orchestration, timing-safe path |
| 4 | `backend/src/features/auth/setup.service.ts` | Setup orchestration, transactions |
| 5 | `backend/src/features/auth/session.service.ts` | Token create/validate/delete, cookie options |
| 6 | `backend/src/features/auth/auth.middleware.ts` | `requireAuth`, `requireRole` |
| 7 | `backend/src/features/auth/auth.repository.ts` | Users, sessions, setup_pending, audit SQL |
| 8 | `backend/src/features/auth/password.service.ts` | bcrypt hash/verify |
| 9 | `backend/src/features/auth/totp.service.ts` | TOTP generate/verify, encrypt at rest |
| 10 | `backend/src/features/auth/rate-limit.middleware.ts` | Login/setup rate limits |
| 11 | `backend/src/features/auth/audit.service.ts` | Audit event writer |
| 12 | `backend/src/features/auth/integritas-validation.service.ts` | Upstream API key check |
| 13 | `backend/src/features/auth/auth.types.ts` | Types + Express `req.user` augmentation |

### Backend — integration & infrastructure (priority: high)

| # | File | Role |
|---|------|------|
| 14 | `backend/src/app.ts` | Route order, `requireAuth` placement, `trust proxy` |
| 15 | `backend/src/db/database.ts` | Auth table migrations |
| 16 | `backend/src/config/env.ts` | Cookie/session/`APP_SECRET` config |
| 17 | `backend/src/index.ts` | Startup, `APP_SECRET` warning |
| 18 | `backend/src/shared/crypto.ts` | `sha256Hex`, `encryptSecret`/`decryptSecret` |
| 19 | `backend/src/middleware/requestLogger.ts` | Request logging (no body logging) |

### Backend — route protection changes (priority: high)

| # | File | Role |
|---|------|------|
| 20 | `backend/src/features/integritas/integritas.routes.ts` | `requireRole('admin')` on api-key; audit on save/delete |
| 21 | `backend/src/features/files/files.routes.ts` | Entire router behind `requireRole('admin')` |
| 22 | `backend/src/features/automation/automation.routes.ts` | `requireRole('admin')` on mutations |
| 23 | `backend/src/features/data-sources/dataSources.routes.ts` | `requireRole('admin')` on mutations |
| 24 | `backend/src/features/health/health.routes.ts` | Stays public |

### Frontend — auth (priority: critical)

| # | File | Role |
|---|------|------|
| 25 | `frontend/src/features/auth/AuthProvider.tsx` | Bootstrap: wizard vs login vs app |
| 26 | `frontend/src/features/auth/LoginPage.tsx` | Two-phase login UI |
| 27 | `frontend/src/features/auth/api.ts` | Auth API client |
| 28 | `frontend/src/features/auth/types.ts` | `AuthUser`, `SetupStatus` |
| 29 | `frontend/src/features/auth/hooks.ts` | `useAuth` context |
| 30 | `frontend/src/features/auth/index.ts` | Public exports |
| 31 | `frontend/src/features/auth/SidebarUserBox.tsx` | User display + sign out |
| 32 | `frontend/src/features/auth/login.css` | Login styles |

### Frontend — setup wizard (priority: critical)

| # | File | Role |
|---|------|------|
| 33 | `frontend/src/features/setup/OnboardingWizard.tsx` | Full wizard UI + API wiring |
| 34 | `frontend/src/features/setup/api.ts` | Setup API client |
| 35 | `frontend/src/features/setup/config.ts` | `INTEGRITAS_STEP_REQUIRED` toggle |
| 36 | `frontend/src/features/setup/steps.ts` | Step definitions |
| 37 | `frontend/src/features/setup/types.ts` | Form/step types |
| 38 | `frontend/src/features/setup/onboarding.css` | Wizard styles |

### Frontend — shell & API layer (priority: high)

| # | File | Role |
|---|------|------|
| 39 | `frontend/src/lib/api.ts` | `credentials: "include"`, 401 handler |
| 40 | `frontend/src/App.tsx` | `AuthProvider` wrapper |
| 41 | `frontend/src/components/AppShell.tsx` | Passes user to sidebar |
| 42 | `frontend/src/pages/SetupPage.tsx` | Post-setup checklist + sign out |

### Config & documentation (priority: medium)

| # | File | Role |
|---|------|------|
| 43 | `.env.example` | `COOKIE_SECURE`, session TTLs |
| 44 | `backend/package.json` | bcrypt, otpauth, qrcode, cookie-parser, express-rate-limit |
| 45 | `docs/plans/auth-implementation.md` | Implementation plan |
| 46 | `docs/plans/auth-security.md` | Threat model |
| 47 | `SECURITY.md` | Updated risk register |
| 48 | `README.md` | Auth/setup/CLI 401 docs |
| 49 | `AGENTS.md` | Agent guidance for auth |

### Deleted (verify gone — priority: low)

| Path | Was |
|------|-----|
| `frontend/src/mock/login/*` | Mock login + localStorage |
| `frontend/src/mock/onboarding/*` | Mock wizard + localStorage |

---

## Backend file breakdown (added in `704e575` + follow-ups)

### `auth.types.ts`
Express `Request.user` typing; `UserRecord`, `SessionUser`, `UserRole` (`"admin"` only).

### `password.service.ts`
- bcrypt, 12 rounds
- `hashPassword`, `verifyPassword`

### `totp.service.ts`
- `otpauth` TOTP (SHA1, 6 digits, 30s, ±1 window)
- QR via `qrcode` → data URL
- `encryptTotpSecret` / `decryptTotpSecret` using shared AES-256-GCM

### `session.service.ts`
- Raw token: `crypto.randomBytes(32)` hex
- DB stores `sha256Hex(token)`
- Max age: `SESSION_MAX_AGE_DAYS` (default 7)
- Idle timeout: `SESSION_IDLE_HOURS` (default 24) — deletes session if idle exceeded
- Cookie: `httpOnly`, `sameSite: strict`, `secure` from `COOKIE_SECURE`

### `auth.repository.ts`
CRUD for users, sessions, setup_pending, audit_events. Parameterized SQL. `createSetupPending` clears prior pending rows. `getLatestSetupPending` prunes expired rows.

### `auth.service.ts`
Login: lookup user → bcrypt verify (or dummy hash) → decrypt TOTP → verify 6-digit code → audit → `createSession`. Failures return generic `{ ok: false }`.

### `setup.service.ts`
- `initSetupTotp`: generates secret, stores encrypted in `setup_pending` (15 min TTL), returns QR + **secret**
- `verifySetupTotp` (`715921c`): verifies code, sets `verified_at`, extends TTL to 30 min
- `verifySetupIntegritasKey`: upstream validation
- `completeSetup`: validates username/password, requires verified pending TOTP, transactional user create + optional API key save + audit + session

### `auth.routes.ts`
- Public: `POST /login` (rate limited)
- Protected: `POST /logout`, `GET /me`

### `setup.routes.ts`
- `GET /status`
- `POST /totp/init`, `/totp/verify`, `/integritas/verify`, `/complete` (all rate limited)

### `auth.middleware.ts`
- `requireAuth`: read cookie → `validateSession` → attach `req.user` or 401
- `requireRole('admin')`: 403 if role mismatch

### `rate-limit.middleware.ts`
`express-rate-limit`: 5 requests / 15 min / IP, `skipSuccessfulRequests: true`

### `audit.service.ts`
Thin wrapper inserting into `audit_events` (no secrets in detail by convention).

### `integritas-validation.service.ts`
Lightweight upstream proof request with zero hash to validate API key.

### `database.ts` (auth tables)
`users`, `sessions` (FK cascade), `setup_pending` (+ `verified_at` migration), `audit_events`.

### `app.ts`
```txt
Public:  /api/health, /api/setup, /api/auth (login only)
requireAuth
Protected: /api/auth (logout, me), /api/status, minima, integritas, data-sources, data-reads, automation, files
```

---

## Frontend file breakdown

### `lib/api.ts`
All fetches use `credentials: "include"`. On 401, calls `onUnauthorized` except for public auth/setup paths.

### `AuthProvider.tsx`
State machine: loading → setup wizard | login | authenticated children. Registers 401 handler. `signOut` calls logout API then clears local state.

### `LoginPage.tsx`
Two phases: credentials → TOTP. `POST /api/auth/login`. No guest skip. Errors show API message (login endpoint only returns generic text).

### `features/setup/OnboardingWizard.tsx`
Steps: welcome → account → 2FA → integritas (optional skip) → complete.

- On 2FA step: `POST /api/setup/totp/init` → QR + manual key
- Verify button: `POST /api/setup/totp/verify`
- Integritas verify or skip (`INTEGRITAS_STEP_REQUIRED = false`)
- Finish: `POST /api/setup/complete`

### `features/setup/api.ts` & `features/auth/api.ts`
Thin wrappers over `getJson` / `postJson`.

### `App.tsx`
`AuthProvider` → `AppContent` (requires `user` from context).

### `SetupPage.tsx`
Operational checklist; real sign-out button (no “preview wizard”).

---

## Public vs protected API routes

| Route | Auth |
|-------|------|
| `GET /api/health` | Public |
| `GET /api/setup/status` | Public |
| `POST /api/setup/totp/init` | Public (only when no users) |
| `POST /api/setup/totp/verify` | Public (only when no users) |
| `POST /api/setup/integritas/verify` | Public (only when no users) |
| `POST /api/setup/complete` | Public (only when no users) |
| `POST /api/auth/login` | Public |
| `POST /api/auth/logout` | Session required |
| `GET /api/auth/me` | Session required |
| All other `/api/*` | Session required |

**Admin-only mutations** (`requireRole('admin')`):

- `POST/DELETE /api/integritas/api-key`
- All `/api/files/*`
- `POST/PATCH/DELETE /api/automation/workflows*`
- `POST/DELETE /api/data-sources/*` (mutations and manual read trigger)

**Note:** Other integritas routes (stamp, history delete, etc.) require any valid session but not explicit `requireRole` — acceptable in V1 because only `admin` users exist.

---

## Security findings for review

Severity: **Critical** > **High** > **Medium** > **Low** > **Info**

### F-01 — Medium: TOTP secret returned in setup API response

**Location:** `setup.service.ts` → `setup.routes.ts` → `frontend/src/features/setup/api.ts`

The plan in `docs/plans/auth-implementation.md` states the init endpoint must **never** return the raw secret in JSON. Current code returns `{ qrCodePngBase64, expiresAt, secret }` so the wizard can show/copy a manual setup key.

**Risk:** Any observer on the LAN (HTTP) or XSS during setup could capture the long-term TOTP secret before the account exists.

**Mitigation options:**
1. Accept risk for trusted LAN one-time setup (document explicitly).
2. Remove `secret` from JSON; QR-only enrollment.
3. Serve manual key only over HTTPS with `COOKIE_SECURE=true` and document.

### F-02 — High (environmental): HTTP + `COOKIE_SECURE=false` default

**Location:** `.env.example`, `env.ts`, `session.service.ts`

Session cookies are sent in cleartext on default HTTP LAN deploy. Documented in SECURITY.md.

**Action:** Require HTTPS + `COOKIE_SECURE=true` before untrusted networks.

### F-03 — Medium: No automated security tests

No unit/integration tests for 401 gates, setup guard, generic login errors, or rate limits.

**Action:** Add backend tests before treating auth as production-ready.

### F-04 — Low: Expired sessions not proactively purged

`deleteExpiredSessions()` in `auth.repository.ts` is never called from `index.ts` or a scheduler. Expired rows remain until accessed or DB maintenance.

**Impact:** Minor — stale rows only; validation still rejects expired tokens.

### F-05 — Low: Login failure audit includes username

`auth.service.ts` records `login.failure` with `detail: username`. Not exposed via API, but usernames appear in `audit_events` (potential enumeration in DB dumps).

### F-06 — Medium: No CSRF tokens

Relies on `SameSite=Strict`. Cross-site POST from same-site subdomains or future cookie policy changes may need tokens.

### F-07 — Medium: CLI unauthenticated

Documented. `integritas-pi` CLI gets 401 on protected routes.

### F-08 — Low: Default `APP_SECRET`

`dev-change-me` default with startup warning only. Weak secret breaks TOTP/API key encryption at rest.

### F-09 — Info: Setup errors are specific (not generic)

Setup endpoints return messages like `"Invalid TOTP code"`, `"Setup is already complete"`. Acceptable because setup is only available when `count(users) === 0`, but differs from login’s generic errors.

### F-10 — Positive controls verified

| Control | Status |
|---------|--------|
| Passwords bcrypt-hashed | OK |
| Session tokens hashed (SHA-256) in DB | OK |
| HttpOnly + SameSite=Strict cookies | OK |
| New session on login/setup (no fixation) | OK |
| Idle + max session lifetime | OK |
| Rate limit login/setup (5/15min) | OK |
| Dummy bcrypt on missing user | OK |
| Generic login error message | OK |
| Setup blocked after first user | OK |
| Setup complete in transaction + re-check user count | OK |
| TOTP encrypted at rest | OK |
| Integritas key validated before save | OK |
| API key never returned to browser | OK |
| Request logger does not log bodies | OK |
| Mock localStorage auth removed | OK |
| `trust proxy` set for future TLS | OK |

---

## Suggested audit procedure (per file)

For each file in the [audit list](#complete-file-audit-list):

1. **Secrets** — Confirm no passwords, TOTP codes, session tokens, or API keys are logged or returned in responses.
2. **Auth gates** — Routes that mutate state or read sensitive data must be behind `requireAuth` and `requireRole` where applicable.
3. **Input validation** — String type checks, length limits, TOTP format `^\d{6}$`.
4. **SQL** — Parameterized queries only (repository layer).
5. **Frontend** — No secrets in `localStorage`; all API calls use `credentials: "include"`.
6. **Error messages** — Login stays generic; document any intentional specificity elsewhere.

---

## Dependencies added (`backend/package.json`)

| Package | Purpose |
|---------|---------|
| `bcrypt` | Password hashing |
| `otpauth` | TOTP |
| `qrcode` | Setup QR images |
| `cookie-parser` | Session cookie parsing |
| `express-rate-limit` | Login/setup throttling |

---

## Known limitations (V1, by design)

- Single admin account only; no password reset UI
- No guest/read-only mode
- No CLI session auth
- No “log out everywhere” UI
- No TLS management in-app
- Integritas step optional at setup (`INTEGRITAS_STEP_REQUIRED = false`)

---

## Recommended follow-up work

1. **Decide on F-01** — Document accepted risk or remove `secret` from API.
2. **Add auth integration tests** — 401 on protected routes, setup guard, rate limit, login generic errors.
3. **Schedule session cleanup** — Call `deleteExpiredSessions()` periodically from `index.ts`.
4. **HTTPS guidance** — Installer/README checklist for field deploy with `COOKIE_SECURE=true`.
5. **Optional:** `requireRole('admin')` on integritas stamp/history-delete for defense in depth when guest role is added later.

---

## Report metadata

- **Method:** Git history (`704e575`, `715921c`, `2b38829`), full codebase read of auth-related paths
- **Verification not run for this report:** `npm run check`, manual wizard/login flows (recommend running before production use)
