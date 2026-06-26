# Auth — QA & Testing Gaps Backlog

**Status:** Open — track in QA phase before treating auth as complete  
**Created:** 2026-06-09  
**Hub:** [README.md](./README.md) — project QA entry point (auth + Integritas tests)  
**Related:** [auth-implementation-audit.md](../reports/auth-implementation-audit.md), [auth-security.md](../plans/auth-security.md), [SECURITY.md](../../SECURITY.md)

## Purpose

Phase 1 auth and the setup wizard are **implemented and wired**. This document lists the **remaining gaps** to close in **QA and testing** so you can:

1. Sign off auth as “done enough” to build other features.
2. Avoid discovering security regressions later.
3. Have a concrete test plan (manual + automated).

**Not in scope here:** new product features (wallet, guest mode, CLI auth, password reset). Those stay backlog until this QA phase passes.

---

## Exit criteria (auth QA sign-off)

Auth moves from **QA** to **accepted** when:

- [ ] All **P0** items below are implemented **or** explicitly accepted with documented risk in `SECURITY.md`.
- [ ] All **P0 manual tests** pass on a fresh `DATA_DIR`.
- [ ] **P0 automated tests** exist and pass in CI (`npm run check` or dedicated test script).
- [ ] `README.md` / `SECURITY.md` reflect final deploy expectations (HTTP vs HTTPS).

Until then, treat auth as **feature-complete, security-incomplete**.

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 7 | Must address or accept before other features |
| **P1** | 6 | Complete during QA phase (recommended) |
| **P2** | 5 | Post-QA hardening; does not block feature work |

---

## P0 — Must close or accept before feature sign-off

### GAP-01 — Transport security (HTTPS + Secure cookies)

**Risk:** Session cookies and credentials visible on the network.

**Current (2026-06-25):** HTTPS shipped on default Docker deploy (self-signed cert, nginx TLS, `COOKIE_SECURE=true`). **HSTS deferred** — out of scope for self-hosted IP access; see [v1-security.md](../plans/v1-security.md).

**QA work:**

| Type | Task | Status |
|------|------|--------|
| Implement | Ship HTTPS path (nginx TLS + installer cert generation). | Done |
| Implement | Set `COOKIE_SECURE=true` when HTTPS is enabled. | Done |
| Implement | Add HSTS header on HTTPS deploys. | **Deferred (V2+)** |
| Manual test | Login over HTTPS; confirm cookie has `Secure` flag in DevTools. | |
| Manual test | Plain HTTP on `${FRONTEND_PORT}` rejected (HTTPS-only port). | |

**Acceptance:** Operator uses `https://<pi-ip>:8080`; browser warning documented. See [v1-security.md](../plans/v1-security.md) verify checklist.

**Files touched:** `frontend/nginx.conf`, `docker-compose.yml`, `scripts/generate-tls-cert.sh`, `install.sh`, `.env.example`, `README.md`, `SECURITY.md`

---

### GAP-02 — Automated auth security tests

**Risk:** Regressions in route protection go unnoticed while building new features.

**Current:** No auth integration tests.

**QA work — add tests for:**

| Test | Expected |
|------|----------|
| `GET /api/status/overview` without cookie | `401` |
| `POST /api/auth/login` wrong password/TOTP | `401`, body `{ error: "Invalid credentials" }` |
| `GET /api/setup/status` | `200` (public) |
| `POST /api/setup/complete` when user exists | `403` |
| `POST /api/integritas/api-key` without session | `401` |
| Rate limit login (6+ failures / 15 min) | `429` |
| Session idle expiry | `401` after idle window (or mocked time) |

**Acceptance:** Tests run in CI; fail on auth regression.

**Files likely touched:** new `backend/src/features/auth/*.test.ts` or `backend/test/auth.test.ts`, root `package.json` scripts

---

### GAP-03 — Manual end-to-end auth test script

**Risk:** Wizard/login flows break without anyone noticing.

**QA work — manual checklist (run on fresh `DATA_DIR`):**

- [ ] Wizard: set password → 2FA QR → verify code → skip Integritas → complete → dashboard
- [ ] Wizard with Integritas key: verify key → complete → key shows configured (masked)
- [ ] Browser reload: still logged in (cookie persists)
- [ ] Sign out: protected API returns `401`; login screen shown
- [ ] Wrong password/TOTP: generic error only (no “user not found” / “bad TOTP”)
- [ ] Setup cannot re-run after admin exists (`GET /api/setup/status` → `setupComplete: true`)
- [ ] No guest skip; no “preview wizard” on Setup page
- [ ] `integritas-pi status` (or equivalent CLI) without cookie → `401` (documented)

**Acceptance:** Checklist recorded in this doc or `README.md`; last run date noted in PR/release notes.

---

### GAP-04 — `APP_SECRET` startup validation

**Risk:** Weak default encrypts TOTP and Integritas keys trivially if `.env` leaks.

**Current:** `dev-change-me` logs a warning only.

**QA work:**

| Type | Task |
|------|------|
| Implement | Refuse startup when `APP_SECRET` is default and `NODE_ENV=production` (or `REQUIRE_STRONG_SECRETS=true`). |
| Manual test | Start with default secret in prod mode → exit with clear error. |
| Manual test | Start with random 32+ char secret → OK. |

**Acceptance:** Impossible to run “production-like” deploy with default secret without explicit override flag.

**Files likely touched:** `backend/src/index.ts`, `backend/src/config/env.ts`, `.env.example`, `SECURITY.md`

---

### GAP-05 — TOTP secret in setup API response

**Risk:** Raw `secret` in `POST /api/setup/totp/init` JSON conflicts with security plan; XSS or HTTP observer could capture long-term 2FA secret.

**Current:** Backend returns `{ qrCodePngBase64, expiresAt, secret }`; frontend shows manual copy UI.

**QA work — pick one:**

| Option | Action |
|--------|--------|
| **A (stricter)** | Remove `secret` from API; QR-only enrollment. Update wizard UI. |
| **B (document)** | Keep manual key UX; require HTTPS + document accepted risk in `SECURITY.md` and [auth-security.md](../plans/auth-security.md). |

**Acceptance:** Decision recorded in `SECURITY.md`; QA verifies chosen behavior.

**Files likely touched:** `backend/src/features/auth/setup.service.ts`, `setup.routes.ts`, `frontend/src/features/setup/api.ts`, `OnboardingWizard.tsx`

---

### GAP-06 — CSRF baseline for mutations

**Risk:** `SameSite=Strict` alone is OWASP baseline, not full CSRF coverage (especially if XSS exists).

**Current:** No CSRF tokens; cookie sent on same-site requests only.

**QA work:**

| Type | Task |
|------|------|
| Decide | Accept SameSite-only for trusted LAN **or** implement CSRF token / custom header on mutations. |
| Manual test | If tokens added: cross-site form POST without token → rejected. |
| Document | Update `SECURITY.md` with CSRF posture. |

**Acceptance:** Documented decision; if deferred, marked “accepted risk — trusted LAN only” in `SECURITY.md`.

---

### GAP-07 — Security headers (XSS defense-in-depth)

**Risk:** No CSP / frame protection; XSS could abuse session cookie in-browser.

**Current:** No `helmet` or nginx security headers.

**QA work:**

| Type | Task |
|------|------|
| Implement | Add headers: `Content-Security-Policy` (minimum), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. |
| Manual test | Response headers present on frontend and `/api/*` (via nginx or backend). |
| Manual test | App still loads and login/wizard work with CSP enabled. |

**Acceptance:** Headers on production build; no broken auth flows.

**Files likely touched:** `frontend/nginx.conf` and/or `backend/src/app.ts`, `SECURITY.md`

---

## P1 — Complete during QA phase (recommended)

### GAP-08 — Session lifecycle cleanup

**Current:** `deleteExpiredSessions()` in repository is never called.

**QA work:**

- [ ] Schedule periodic cleanup from `backend/src/index.ts` (e.g. hourly).
- [ ] Manual test: expired session row removed; valid session still works.

---

### GAP-09 — Single-session policy on login (optional for Pi)

**Current:** New session on login; old sessions remain valid.

**QA work:**

- [ ] On successful login, call `deleteAllUserSessions(userId)` before `createSession` (product decision).
- [ ] Manual test: login on browser A invalidates browser B’s session.

**Note:** Good for single-admin Pi; skip if multi-tab/multi-device is desired.

---

### GAP-10 — Rate limits on high-value endpoints

**Current:** Rate limit only on `/api/auth/login` and `/api/setup/*`.

**QA work:**

- [ ] Add per-IP limits on: Integritas stamp, automation run, file listing (tune thresholds).
- [ ] Manual test: burst requests → `429` without breaking normal use.

---

### GAP-11 — Input validation (`zod`) on auth/setup routes

**Current:** Manual `typeof` + length checks.

**QA work:**

- [ ] Add schemas for login, setup complete, totp init/verify bodies.
- [ ] Test malformed bodies → `400`, not `500`.

---

### GAP-12 — `requireRole('admin')` on remaining Integritas mutations

**Current:** Stamp, history delete, etc. require session only (OK while only `admin` exists).

**QA work:**

- [ ] Add `requireRole('admin')` on stamp, history delete/export, verify routes.
- [ ] Test non-admin role → `403` (when guest role exists, or mock in test).

---

### GAP-13 — Audit log hygiene

**Current:** `login.failure` stores `"failed"` in `audit_events.detail` (no user input).

**QA work:**

- [x] Stop storing raw username on failure (use `"failed"` or hashed identifier).
- [ ] Confirm audit rows never contain passwords, TOTP, tokens, or API keys.

---

## P2 — Post-QA hardening (does not block other features)

| ID | Gap | Notes |
|----|-----|-------|
| GAP-14 | Argon2id instead of bcrypt | OWASP preferred; bcrypt cost 12 is acceptable for Pi |
| GAP-15 | `__Host-` session cookie prefix | Browser-enforced Secure + Path=/ |
| GAP-16 | CLI authentication | Documented 401 today; token story later |
| GAP-17 | Password change + session invalidation | No recovery UI in V1 |
| GAP-18 | Penetration test / OWASP ZAP scan | Run against staging before field deploy |

---

## QA test matrix (quick reference)

| Area | Manual | Automated | Owner |
|------|--------|-----------|-------|
| Wizard happy path | ✓ | — | QA |
| Wizard + Integritas key | ✓ | — | QA |
| Login + logout | ✓ | ✓ | QA |
| 401 on protected routes | ✓ | ✓ | Dev |
| Setup guard (no re-run) | ✓ | ✓ | Dev |
| Generic login errors | ✓ | ✓ | Dev |
| Rate limiting | ✓ | ✓ | Dev |
| Cookie flags (HttpOnly, SameSite, Secure) | ✓ | — | QA |
| HTTPS deploy | ✓ | — | Ops |
| Security headers | ✓ | — | Dev |
| Session idle / max age | ✓ | optional | Dev |
| CLI 401 | ✓ | — | QA |

---

## Suggested QA phase order

```txt
Week 1 — Test what exists
  → GAP-03 manual E2E checklist
  → GAP-02 automated tests (start with 401 + setup guard + login error)
  → GAP-04 APP_SECRET validation

Week 2 — Close transport & headers (or document LAN-only acceptance)
  → GAP-01 HTTPS / COOKIE_SECURE / HSTS
  → GAP-07 security headers
  → GAP-05 TOTP secret decision (A or B)

Week 3 — Hardening & sign-off
  → GAP-06 CSRF decision + doc
  → GAP-08 session cleanup
  → P1 items as time allows (GAP-09–13)
  → Update SECURITY.md statuses
  → Auth QA sign-off → unblock other features
```

---

## What you can build in parallel

While QA runs, **other features are safe to start** if they:

- Call backend only via `/api/*` with `credentials: "include"` (use `lib/api.ts`).
- Do not add new public routes without updating `app.ts` and this doc.
- Do not store secrets in frontend or `localStorage`.
- Assume all non-public APIs return `401` without a valid session.

Auth **must not** be re-implemented in frontend or CLI.

---

## Sign-off template

When QA completes, copy into PR or release notes:

```txt
Auth QA sign-off — YYYY-MM-DD

P0: [ ] all closed  [ ] accepted risks documented in SECURITY.md
P0 manual checklist: passed (fresh DATA_DIR)
Automated auth tests: passing in CI
Deploy mode: [ ] HTTP LAN  [ ] HTTPS + COOKIE_SECURE=true
Known deferred: P2 items GAP-14–18

Approved to proceed with feature work beyond auth.
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-09 | Initial backlog from implementation audit + OWASP gap assessment |
