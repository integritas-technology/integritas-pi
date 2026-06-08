# Auth & Permissions — Security Model (Phase 1)

Living doc for **auth implementation** risks and controls. Implementation details: [auth-implementation.md](./auth-implementation.md). General project risks: [../SECURITY.md](../SECURITY.md).

---

## Scope

**In scope (app responsibility):**
- Login, sessions, TOTP, and **first-run startup wizard** (same Phase 1 delivery)
- Protecting all `/api/*` routes except explicit public endpoints
- Secrets handling (passwords, TOTP, Integritas key, session tokens)
- Server-side input validation on auth/setup routes
- Audit metadata for sensitive actions (`audit_events` table)

**Out of scope (user / later phases):**
- OS hardening, firewall, SSH, physical security
- TLS certificate automation (roadmap; V1 supports HTTP LAN with documented tradeoff)
- Multi-device registry / per-device revocation UI
- Guest permissions (define before enabling)
- CLI authentication (documented gap in V1)
- Encrypted storage at rest beyond hashed passwords + encrypted TOTP/API key

---

## Threat Model → Controls (Phase 1)

### 1. Unauthorised UI access
**Risk:** Anyone on the LAN uses the app without credentials.

**Controls (V1):**
- `requireAuth` on all routes except: `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, `POST /api/auth/login`
- Admin-only: single `admin` role; `requireRole('admin')` on high-risk mutations
- TOTP mandatory at first-run setup and every login
- Remove frontend mock guest/localStorage auth
- Wizard gated by `GET /api/setup/status` (not `localStorage`); no re-run after admin exists

**Status:** Planned — see auth-implementation.md

---

### 2. Session theft / fixation
**Risk:** Stolen or reused session cookie grants full admin access.

**Controls (V1):**
- HttpOnly cookie, `SameSite=Strict`, `Secure` when `COOKIE_SECURE=true`
- Raw token never in DB — SHA-256 hash only
- New session token on every successful login/setup (no fixation)
- Idle expiry 24h, max age 7 days
- Logout deletes server-side session row

**Gap:** Default deploy is HTTP → `COOKIE_SECURE=false` → cookie sent in cleartext on LAN. Acceptable only on trusted networks. HTTPS + `COOKIE_SECURE=true` is the target for field/untrusted networks.

---

### 3. Brute force (login / setup)
**Risk:** Repeated credential guessing on the network.

**Controls (V1):**
- Rate limit `POST /api/auth/login` and `POST /api/setup/*` by IP (e.g. 5 failures / 15 min)
- Generic error always: `"Invalid credentials"`
- Constant-time login path: run bcrypt even when username missing

**Later:** Broader per-IP / per-session limits on stamp and automation endpoints.

---

### 4. Browser ↔ backend interception
**Risk:** Credentials, TOTP, API key, session cookie visible on untrusted networks.

**Controls:**
- **Now:** Trusted LAN + HTTP documented in SECURITY.md
- **Target:** HTTPS on local app (self-signed OK for home; signed cert for field). Then `COOKIE_SECURE=true` always.

---

### 5. Backend ↔ Integritas interception
**Risk:** API key or payload leaked in transit to cloud.

**Controls (existing + auth):**
- HTTPS outbound to Integritas (already)
- API key never in frontend responses
- Key save/delete requires admin session
- Validate key with lightweight upstream check before persisting

---

### 6. Secrets exposure (API / logs / frontend)
**Risk:** Keys, tokens, or hashes leak via responses or logs.

**Controls:**
- Never return: password hash, TOTP secret, raw session token, Integritas API key
- Never log: passwords, TOTP codes, cookies, API keys, request bodies on auth routes
- Typed API responses — no secret fields on DTOs sent to browser

---

### 7. Injection / malformed input
**Risk:** Bad payloads on auth/setup or automation endpoints.

**Controls (V1):**
- Server-side validation on auth/setup bodies (min length, required fields, TOTP format)
- **Phase 1.5 / follow-up:** `zod` schemas on all API routes (align with SECURITY.md development plan)

---

### 8. Setup race / replay
**Risk:** Concurrent or repeated setup calls before first user exists.

**Controls:**
- Reject setup if any user exists
- `setup_pending` TOTP rows: 15 min TTL, rate limited
- `POST /api/setup/totp/init` requires `{ username }` from account step
- Setup complete in transaction where practical
- TOTP verified only on `POST /api/setup/complete` (no separate verify endpoint in V1)

---

### 11. Wizard UX / mock leftovers
**Risk:** Mock wizard leaves localStorage gates, fake QR, or guest skip — bypassing real auth.

**Controls:**
- Migrate wizard from `mock/onboarding` → `features/setup/`; wire real APIs
- `AuthProvider` owns bootstrap (`setup/status` → wizard vs `auth/me`)
- Remove mock QR, `MOCK_2FA_SECRET`, "UI mockup" copy, guest skip
- Integritas step optional via `INTEGRITAS_STEP_REQUIRED = false` (toggle to require later)
- All `fetch` calls use `credentials: "include"`

---

### 9. Stolen device / DB file
**Risk:** Attacker reads SQLite or `.env` from disk.

**Controls:**
- Passwords: bcrypt only
- TOTP + Integritas key: encrypted with `APP_SECRET` (AES-256-GCM)
- Session tokens: hashed in DB
- `.env` should be `chmod 600`; data dir `700` (installer)

**Gap:** No full-disk encryption or remote wipe — user responsibility.

---

### 10. CLI bypass
**Risk:** `integritas-pi` CLI calls API without session.

**Controls (V1):**
- Protected routes return `401` for CLI
- Document in README / SECURITY.md
- **Later:** API token or cookie file for operators

---

## Auth Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Session storage | Stateful SQLite | Revocable; fits Pi single-node |
| Browser token | HttpOnly cookie | XSS cannot read session |
| Password | Bcrypt, 12 rounds | Slow by design |
| 2FA | TOTP (`otpauth`) | Offline, no cloud |
| Login errors | Generic only | No user/password/TOTP enumeration |
| DB token storage | SHA-256 hash | DB leak ≠ usable sessions |
| TOTP at rest | `encryptSecret()` + `APP_SECRET` | Reuse existing crypto |

---

## Secrets Storage (this repo)

| Secret | Location | Notes |
|---|---|---|
| `APP_SECRET` | Host `.env` → container env | Encrypts TOTP + Integritas key in DB |
| Integritas API key | SQLite `settings` (encrypted) | Optional `.env` fallback; UI save → DB |
| User password | SQLite `users.password` | Bcrypt hash |
| TOTP secret | SQLite `users.totp_secret` | Encrypted JSON (`EncryptedSecret`) |
| Session token | Browser cookie (raw) | DB stores SHA-256 hash in `sessions` |
| Minima credentials | N/A today | Wallet not built |

Single DB file: `/data/integritas-pi.db` — not a separate `auth.db`.

---

## Permissions (V1)

| Role | Access |
|---|---|
| Unauthenticated | Public routes only (health, setup, login) |
| `admin` | All protected routes |
| `guest` | **Not implemented** — remove UI mock until matrix defined |

**High-risk routes** — always `requireRole('admin')` even in V1:
- `POST/DELETE /api/integritas/api-key`
- `/api/files/*`
- `/api/automation/*` mutations
- `/api/data-sources/*` mutations

---

## Audit Events (V1)

Log metadata only to `audit_events` (or equivalent):

| Action | When |
|---|---|
| `login.success` / `login.failure` | Auth attempts |
| `logout` | Session end |
| `setup.complete` | First admin created |
| `integritas_api_key.save` / `.delete` | Secret changes |

No passwords, tokens, or key values in audit rows.

---

## Known Gaps (auth phase)

| Gap | Priority | Notes |
|---|---|---|
| HTTPS / `COOKIE_SECURE=true` default | High for field deploy | HTTP OK for trusted home LAN in V1 |
| CSRF tokens | Medium | `SameSite=Strict` baseline; tokens later |
| CLI auth | Medium | Document 401 until token story |
| Guest permissions | Backlog | Define before UI |
| `zod` on all routes | Medium | Auth routes first |
| Multi-device `DEVICE_ID` | Roadmap | Per-device API keys — not in V1 |
| Account recovery | Backlog | Physical / DB reset only |
| Rate limit all endpoints | Low after login limits | Stamp/automation next |

---

## What We Do Not Promise (auth context)

- Protection on untrusted networks without HTTPS
- Safety if `APP_SECRET` or `.env` is exposed
- Recovery without TOTP device + password
- CLI access without future token auth

---

## Pre-coding checklist

**Backend**
- [ ] `audit_events` table + logging (login, logout, setup.complete, api key changes)
- [ ] Rate limits on login/setup
- [ ] Session regeneration on login/setup complete
- [ ] Integritas key validation before save (setup + integritas routes)
- [ ] `requireRole('admin')` on high-risk routes

**Frontend (wizard + auth together)**
- [ ] `lib/api.ts`: `credentials: "include"` on all requests
- [ ] `AuthProvider` bootstrap flow
- [ ] Wizard wired: `totp/init` (with username) → `setup/complete`
- [ ] Integritas step Skip + `INTEGRITAS_STEP_REQUIRED` toggle
- [ ] Remove mock login/onboarding + localStorage gates
- [ ] `SetupPage`: real logout; no "Preview setup wizard"

**Verification**
- [ ] Security tests (401, setup guard, generic login error)
- [ ] Manual: wizard skip Integritas path + wizard with key path
- [ ] Update SECURITY.md statuses when merged
