# Auth Implementation Plan (aligned with integritas-pi)

**Phase 1** of auth & permissions. Security model and pre-coding checklist: [auth-security.md](./auth-security.md). General risks: [../SECURITY.md](../SECURITY.md).

Revised from the original auth spec to match this repo’s architecture, conventions, and existing security primitives.

## Verdict on the original plan

The core design is sound for this project:

- Backend as the security boundary
- Username + password + TOTP for admin login
- HttpOnly session cookies with hashed tokens in SQLite
- First-run setup wizard that also configures Integritas
- Generic login errors, no secret leakage

Several details conflict with how **integritas-pi** is built today and must change before implementation.

---

## Key alignments (what changes vs the original plan)

| Original plan | integritas-pi reality |
|---|---|
| Separate `auth.db` + `src/db/client.ts` + `schema.ts` | Single SQLite file: `/data/integritas-pi.db` via `backend/src/db/database.ts`; add auth tables in `runMigrations()` |
| Flat `src/routes/setup.ts` and `src/routes/auth.ts` | Feature folders under `backend/src/features/auth/` (same pattern as integritas, automation, etc.) |
| `src/config.ts` + `dotenv` + strict startup validation | Extend existing `backend/src/config/env.ts`; env comes from Docker Compose / host `.env`, not `dotenv` inside the container |
| Write Integritas API key to `.env` on setup | Use existing `saveIntegritasApiKey()` in `backend/src/features/settings/secrets.service.ts` (AES-256-GCM in SQLite `settings` table) |
| `INTEGER` unix timestamps | Match existing schema: `TEXT` ISO timestamps (`created_at`, `updated_at`, etc.) |
| `secure: true` cookie always | App is served over **HTTP** on the LAN (`http://<pi-ip>:8080`); `Secure` cookies would not be sent. Use env-driven cookie options (see Phase 5) |
| Routes at `/auth/*`, `/setup/*` | All API routes live under `/api/*` (e.g. `/api/auth/login`) |
| New encryption for `totp_secret` | Reuse `encryptSecret()` / `decryptSecret()` from `backend/src/shared/crypto.ts` (already keyed off `APP_SECRET`) |
| Standalone backend `.env.example` | Root `.env.example` already documents `APP_SECRET` and `INTEGRITAS_API_KEY` |
| Guest sessions not in scope | Frontend **mock** already has guest mode (`frontend/src/mock/login`); V1 backend auth should implement **admin only** and remove/replace mock guest until permissions are defined |

---

## Target architecture

```txt
Browser
  → frontend (Nginx :8080)
  → /api/* proxied to backend:3000
  → auth middleware on protected routes
  → SQLite integritas-pi.db (users, sessions, settings, …)
```

CLI (`bin/integritas-pi`) calls the same `/api` surface. **V1 auth does not cover the CLI** — document that operational CLI commands will return `401` until a later token or cookie-based CLI auth story is added.

---

## Folder structure

```
backend/src/
├── config/
│   └── env.ts                         ← extend (cookie flags, session TTLs)
├── db/
│   └── database.ts                    ← add users/sessions migrations + WAL pragma
├── middleware/
│   ├── requestLogger.ts               ← existing
│   └── requireAuth.ts                 ← thin wrapper, or re-export from auth feature
├── shared/
│   └── crypto.ts                      ← reuse for totp_secret + session token hashing option
└── features/
    └── auth/
        ├── auth.types.ts
        ├── auth.repository.ts         ← users + sessions CRUD
        ├── password.service.ts        ← bcrypt hash/verify
        ├── totp.service.ts            ← otpauth + qrcode
        ├── session.service.ts         ← create / validate / delete sessions
        ├── setup.service.ts           ← first-run orchestration
        ├── auth.middleware.ts         ← attach user to req
        ├── auth.routes.ts             ← login, logout, me
        └── setup.routes.ts            ← status, totp init, complete

frontend/src/
└── features/
    └── auth/
        ├── api.ts
        ├── types.ts
        ├── AuthProvider.tsx           ← session state, /api/auth/me on load
        ├── LoginPage.tsx              ← replace mock/login
        └── hooks.ts
```

Wire routers in `backend/src/app.ts`:

```ts
app.use("/api/setup", setupRouter);   // partially public
app.use("/api/auth", authRouter);       // login public; logout/me protected
// … existing feature routers behind requireAuth
```

Replace `frontend/src/mock/login` and connect `frontend/src/mock/onboarding/OnboardingWizard.tsx` to real setup endpoints (then delete mock auth storage).

---

## Phase 1 — Database (extend existing DB)

**File: `backend/src/db/database.ts`**

- After opening the DB, enable WAL: `db.pragma("journal_mode = WAL")`
- Add migrations in `runMigrations()` (do **not** create a second database file)

**`users` table**

```sql
id           TEXT PRIMARY KEY
username     TEXT UNIQUE NOT NULL
password     TEXT NOT NULL          -- bcrypt hash
totp_secret  TEXT NOT NULL          -- JSON EncryptedSecret (shared/crypto.ts)
role         TEXT NOT NULL DEFAULT 'admin'
created_at   TEXT NOT NULL
last_login   TEXT
```

**`sessions` table**

```sql
id           TEXT PRIMARY KEY
user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_hash   TEXT UNIQUE NOT NULL   -- SHA-256 hex of raw cookie token
created_at   TEXT NOT NULL
expires_at   TEXT NOT NULL
last_seen_at TEXT NOT NULL
```

**`setup_pending` table** (short-lived TOTP during first-run only)

```sql
id           TEXT PRIMARY KEY
totp_secret  TEXT NOT NULL          -- EncryptedSecret JSON
expires_at   TEXT NOT NULL          -- e.g. 15 minutes from init
```

> Why `setup_pending`: the original plan’s single `POST /setup/complete` cannot show a real QR code unless the server generates the secret first. The frontend onboarding wizard already has a dedicated 2FA step with QR display.

Use `crypto.randomUUID()` for IDs (consistent with other features). Use `new Date().toISOString()` for timestamps.

---

## Phase 2 — Password

**File: `backend/src/features/auth/password.service.ts`**

- `hashPassword(plain: string): Promise<string>` — bcrypt, 12 rounds
- `verifyPassword(plain: string, hash: string): Promise<boolean>`

Packages: `bcrypt` + `@types/bcrypt`

---

## Phase 3 — TOTP / 2FA

**File: `backend/src/features/auth/totp.service.ts`**

- `generateSecret(): string`
- `getOtpAuthUrl(secret: string, username: string): string` — `otpauth://` URL
- `renderQrPngBase64(otpAuthUrl: string): Promise<string>` — for frontend `<img src="data:image/png;base64,…">`
- `verifyToken(secret: string, token: string): boolean` — 6-digit code, ±1 step (30s drift)

Libraries: `otpauth`, `qrcode` + `@types/qrcode`

**At rest:** encrypt TOTP secrets with `encryptSecret()` before INSERT; decrypt only server-side for verification.

---

## Phase 4 — Sessions

**File: `backend/src/features/auth/session.service.ts`**

- `createSession(userId: string): string`
  - `crypto.randomBytes(32)` → raw token (return to caller / Set-Cookie)
  - Store `SHA-256(rawToken)` hex in `token_hash` (use `node:crypto`; optionally add `sha256Hex()` beside existing `sha3HashHex()` in `shared/crypto.ts`)
  - `expires_at` = now + 7 days
  - `last_seen_at` = now
- `validateSession(rawToken: string): User | null`
  - Hash incoming token, lookup row
  - Reject if `expires_at` passed
  - **Idle timeout:** if `last_seen_at` older than 24 hours, delete session and return null
  - Otherwise update `last_seen_at` and return user
- `deleteSession(rawToken: string): void`
- `deleteAllUserSessions(userId: string): void`

Constants in `env.ts`: `SESSION_MAX_AGE_DAYS=7`, `SESSION_IDLE_HOURS=24`.

---

## Phase 5 — Middleware

**File: `backend/src/features/auth/auth.middleware.ts`**

- Read `session` cookie (`cookie-parser` middleware in `createApp()`)
- `validateSession` → attach `req.user` (extend Express types in `auth.types.ts`)
- Missing/invalid → `401 { error: "Unauthorized" }`

**Registration in `createApp()`**

```ts
app.use(cookieParser());

// Public routes (no requireAuth):
app.use("/api/health", healthRouter);
app.use("/api/setup", setupRouter);
app.post("/api/auth/login", …);  // or mount auth router with login excluded

// Protected:
app.use(requireAuth);
app.use("/api/status", statusRouter);
// … all other existing /api routers
```

**Public route list (V1)**

| Route | Reason |
|---|---|
| `GET /api/health` | Liveness for dashboard / installer |
| `GET /api/setup/status` | First-load routing |
| `POST /api/setup/totp/init` | Generate QR during setup (only when no users) |
| `POST /api/setup/complete` | Finish setup (only when no users) |
| `POST /api/auth/login` | Login |

Everything else requires a valid session, including Integritas stamping, file browse, Minima status, automation, data sources, and API key write/delete.

**Cookie options** (`backend/src/config/env.ts`)

```ts
cookieSecure: process.env.COOKIE_SECURE === "true",  // false for default HTTP LAN deploy
cookieSameSite: "strict" as const,
sessionCookieName: "session",
```

Default `COOKIE_SECURE=false` in `.env.example` with a comment that TLS + `COOKIE_SECURE=true` is recommended before internet exposure. Always set `httpOnly: true`, `path: "/"`, `maxAge` = 7 days.

**Trust proxy:** `app.set("trust proxy", 1)` in `createApp()` so future TLS-terminated setups can honor `X-Forwarded-Proto` if cookie policy evolves.

**CSRF:** `SameSite=Strict` is the V1 baseline. Full CSRF tokens are a documented follow-up in `SECURITY.md`.

---

## Phase 6 — Routes

### Setup — `backend/src/features/auth/setup.routes.ts`

**`GET /api/setup/status`**

```json
{ "setupComplete": true }
```

`setupComplete` = `SELECT COUNT(*) FROM users > 0`.

**`POST /api/setup/totp/init`** (only when `setupComplete === false`)

- Generate TOTP secret, store encrypted row in `setup_pending` (15 min TTL)
- Return `{ qrCodePngBase64, expiresAt }` — **never** return raw secret in JSON
- Frontend shows QR; user enters code on next step

**`POST /api/setup/complete`** (only when no users)

Body:

```json
{
  "username": "admin",
  "password": "…",
  "totpToken": "123456",
  "integritasApiKey": "…"
}
```

Steps:

1. Validate fields (password length policy: min 8, match frontend wizard)
2. Load latest non-expired `setup_pending` row; fail if missing
3. Decrypt pending secret; verify `totpToken`
4. `hashPassword`, encrypt totp secret, INSERT user
5. If `integritasApiKey` non-empty → `saveIntegritasApiKey()` (not `.env`)
6. Delete `setup_pending` rows
7. `createSession`, set cookie
8. Return `{ success: true, user: { username, role } }`

Integritas API key is **optional** at setup (wizard allows skip; key can be saved later on Integritas page).

### Auth — `backend/src/features/auth/auth.routes.ts`

**`POST /api/auth/login`**

Body: `{ username, password, totpToken }`

1. Lookup user by username
2. `verifyPassword` + `verifyToken` (decrypt stored totp)
3. Any failure → `401 { error: "Invalid credentials" }` (same message always)
4. Update `last_login`
5. Create session + Set-Cookie
6. Return `{ success: true, user: { username, role } }`

**`POST /api/auth/logout`** (protected)

- Delete session row, clear cookie (`maxAge: 0`)

**`GET /api/auth/me`** (protected)

```json
{ "username": "admin", "role": "admin", "lastLogin": "2026-06-08T12:00:00.000Z" }
```

---

## Phase 7 — Config

**Extend `backend/src/config/env.ts`** (do not add a separate `config.ts`)

Already present and used:

- `APP_SECRET` — encryption key for secrets and TOTP at rest
- `INTEGRITAS_API_KEY` — optional env fallback (SQLite store preferred)
- `DATABASE_PATH` — `/data/integritas-pi.db`
- `PORT`

Add:

```env
COOKIE_SECURE=false
SESSION_MAX_AGE_DAYS=7
SESSION_IDLE_HOURS=24
```

**Startup validation (minimal)**

- Warn if `APP_SECRET` is `dev-change-me` in production-like deploys
- Do **not** require `INTEGRITAS_API_KEY` at startup (current behavior)

No `dotenv` package — Docker Compose and `install.sh` already inject env vars.

---

## Phase 8 — Frontend integration

1. On app load: `GET /api/setup/status`
   - `setupComplete: false` → show onboarding wizard (real API)
   - `setupComplete: true` → `GET /api/auth/me` (credentials: include)
     - 200 → main app
     - 401 → login screen
2. Replace `localStorage` mock session (`frontend/src/mock/login/storage.ts`) with cookie-based session (`fetch(..., { credentials: "include" })`).
3. Remove guest login from V1 product flow (or keep UI hidden until guest permissions exist).
4. Onboarding wizard steps map to:
   - account → local form state
   - twofa → `POST /api/setup/totp/init` then display `qrCodePngBase64`
   - integritas → optional key in `POST /api/setup/complete`
5. Global API helper: on `401`, redirect to login (except on public auth/setup calls).

Nginx already proxies `/api/` with cookies; no frontend nginx change required.

---

## Security rules (unchanged intent)

- Never return password hash, TOTP secret, raw session token, or Integritas API key
- Never log passwords, TOTP codes, session tokens, or API keys
- Login errors are always generic: `"Invalid credentials"`
- Only token **hashes** in `sessions` table
- `httpOnly` + `sameSite: strict` always; `secure` per `COOKIE_SECURE`
- Integritas key writes require authenticated session (replaces current unauthenticated `POST /api/integritas/api-key`)

---

## Libraries to add

| Purpose | Package |
|---|---|
| Password hashing | `bcrypt` + `@types/bcrypt` |
| TOTP | `otpauth` |
| QR code | `qrcode` + `@types/qrcode` |
| Cookies | `cookie-parser` + `@types/cookie-parser` |

Already present: `better-sqlite3`, `@types/better-sqlite3`, `express`.

---

## Documentation updates (when implementing)

- `README.md` — setup wizard, login, cookie behavior, CLI 401 note
- `SECURITY.md` — close “No Authentication” risk; document cookie/`COOKIE_SECURE` tradeoff on HTTP LAN
- `AGENTS.md` — auth feature folder, protected route policy
- `.env.example` — `COOKIE_SECURE`, session TTL vars

---

## Explicitly out of scope (V1)

- Wallet / Minima private key auth
- Multi-user admin UI (single admin account only)
- Guest / read-only session mode (defer until permissions model exists)
- CLI authentication
- TLS certificate management
- Password reset / account recovery (physical access to Pi + DB reset only)
- “Log out everywhere” UI (backend `deleteAllUserSessions` can exist without UI)

---

## Suggested implementation order

1. DB migrations + auth repository
2. password + totp + session services
3. setup routes (status, totp/init, complete) + integritas key via secrets service
4. auth routes (login, logout, me) + middleware + protect existing routers
5. Frontend auth feature + wire onboarding wizard
6. Remove mock login/onboarding persistence
7. Verification: `npm run check`, manual HTTP LAN test with `COOKIE_SECURE=false`
8. Update README / SECURITY / AGENTS

---

## Verification checklist

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual:

- Fresh `DATA_DIR`: wizard → admin + 2FA → logged in
- Reload browser: session persists via cookie
- Logout clears access; API returns 401
- Wrong password/TOTP: generic error only
- `integritas-pi status` without cookie: 401 (documented)
- API key saved during setup appears as configured in Integritas UI (masked, not returned)
