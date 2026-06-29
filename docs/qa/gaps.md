# QA gaps backlog

**Status:** Open  
**Last verified:** 2026-06-29 (against `main`)  
**Related:** [SECURITY.md](../../SECURITY.md), [CHANGELOG.md](../../CHANGELOG.md)

Shipped features with open QA, security, and test gaps. Close P0 items (or document accepted risk in `SECURITY.md`) before treating an area field-ready.

---

## Sign-off criteria

- [ ] All **P0** items below are done or explicitly accepted in `SECURITY.md`
- [ ] P0 manual checklists pass on a fresh `DATA_DIR` (Pi or dev stack)
- [ ] `npm run check` passes (typecheck + existing parser tests)

---

## Auth

### P0

- [ ] **GAP-01 Transport** — HTTPS default deploy ships (`COOKIE_SECURE=true`). Manual: cookie has `Secure` flag; HTTP redirects to HTTPS. HSTS deferred (V2+).
- [ ] **GAP-02 Automated auth tests** — No auth integration tests. Add: 401 on protected routes, login failure, setup guard, rate limit, session expiry.
- [ ] **GAP-03 Manual E2E checklist** — Wizard (with/without Integritas key), reload persistence, logout, generic login errors, setup cannot re-run, CLI 401 documented.
- [ ] **GAP-04 `APP_SECRET` validation** — Default `dev-change-me` only warns; refuse startup in production-like mode.
- [ ] **GAP-05 TOTP secret in API** — `POST /api/setup/totp/init` and `POST /api/auth/settings/totp/init` both return raw `secret`. Decide: QR-only (stricter) or document HTTPS-only risk.
- [ ] **GAP-06 CSRF** — `SameSite=Strict` only; no CSRF tokens. Decide and document in `SECURITY.md`.
- [ ] **GAP-07 Security headers** — No CSP, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` on nginx/backend.

### P1

- [ ] **GAP-08 Session cleanup** — `deleteExpiredSessions()` exists but is not scheduled from `index.ts`.
- [ ] **GAP-09 Single-session on login** — New login does not invalidate other sessions (optional for single-admin Pi).
- [ ] **GAP-10 Rate limits** — Login, setup, and `/api/auth/settings/*` are rate-limited. Integritas stamp, automation, files, etc. are not.
- [ ] **GAP-11 Input validation** — No `zod` on auth/setup bodies; manual checks only.
- [ ] **GAP-12 Integritas admin gates** — Stamp, history delete/export, verify require session only; `requireRole('admin')` only on API-key routes.
- [ ] **GAP-13 Audit hygiene** — Confirm audit rows never contain passwords, TOTP, tokens, or API keys (`login.failure` stores `"failed"` only).
- [ ] **GAP-17 Session invalidation** — Password change and TOTP reset UI shipped (0.9.0); sessions are **not** invalidated after password/TOTP change.

### P2

- [ ] **GAP-14** Argon2id instead of bcrypt
- [ ] **GAP-15** `__Host-` session cookie prefix
- [ ] **GAP-16** CLI authentication (401 today)
- [ ] **GAP-18** Pen test / OWASP ZAP scan

---

## Device status

### P0

- [ ] **DS-01 `GET /api/status`** — Auth-gated; returns `{ checkedAt, device, app, node }`; `setupComplete` and `integritasConnected` behave as expected.
- [ ] **DS-02 Device ID** — `device.id` stable across backend restarts; not regenerated on other settings changes.
- [ ] **DS-03 Graceful shutdown** — `docker stop` completes without hang; clean restart. Note: schedulers/MQTT/GPIO/SQLite stop, but Express HTTP server is not explicitly closed.

### P1

- [ ] **DS-04 Unit tests** — `device.service.ts` (`ensureDeviceId`, `getDeviceInfo`).
- [ ] **DS-05 Route tests** — `status.routes.ts` authenticated 200, unauthenticated 401.

### P2

- [ ] **DS-06 Health integration test** — `GET /api/health` returns `{ status: "ok", service: "integritas-pi-backend" }` without auth.
- [ ] **DS-07 `integritasConnected` live check** — 30 s cache, 3 s timeout; unreachable upstream returns `false` with HTTP 200 (not 500). Verify latency ≤ ~3.5 s when upstream is down.

### Manual — dashboard

- [ ] Seven metric cards render: Wallet balance, Node status, Integritas API, Device, Device CPU, Device Memory, Device Disk
- [ ] Device status card auto-refreshes (~30 s)

---

## Minima

### P0

- [ ] **MINIMA-01 Stopped container** — `docker compose stop minima` → `state: "stopped"` (HTTP 200); recovers on start.
- [ ] **MINIMA-02 Megammr resync + restart (UI)** — Resync chains container restart when Minima reports `needsRestart`; success toast; stats recover.
- [ ] **MINIMA-03 Manual restart** — Admin restart works; audit event `minima.container.restart` recorded.
- [ ] **MINIMA-04 Peer add** — `GET /api/minima/peers` (auth); `POST /api/minima/peers/add` (admin). Active peers vs configured peers count may differ.
- [ ] **MINIMA-05 Parser tests** — `minima.parse.test.ts` (8 tests) passes in `npm run check`.

### P1

- [ ] **MINIMA-06 Admin gate on resync** — `POST /api/minima/megammrsync/resync` is any authenticated user, not admin.
- [ ] **MINIMA-07 Admin gate on config** — `POST /api/minima/config` is any authenticated user.
- [ ] **MINIMA-08 Auto-resync no restart** — Poller calls `resyncMegammr()` only; does not restart container when `needsRestart`.
- [ ] **MINIMA-09 App shell overview** — Header wallet/node pills fetched once on mount; may be stale until reload.
- [ ] **MINIMA-10 Stall detection** — In-memory `monitoring.*` resets on backend restart.
- [ ] **MINIMA-11 Docker socket** — Writable mount required for restart; risk accepted in `SECURITY.md`.

### P2

- [ ] **MINIMA-12** Live RPC integration tests behind `MINIMA_INTEGRATION_TEST=1`
- [ ] **MINIMA-13** Document curl examples for operators
- [ ] **MINIMA-14** Peer remove (not in Minima docs; defer)
- [ ] **MINIMA-15** `GET /api/minima/peers` returns 502 on RPC failure; `GET /status` returns 200 with `state: "error"` — inconsistent

---

## Tokens

### P0

- [ ] **TOKENS-01 Live `tokencreate`** — Verify RPC shape on Pi; create via API/UI; `tokenId` in SQLite and `GET /api/tokens`.
- [ ] **TOKENS-02 Auth gating** — List/requirements: auth; create: admin. Unauthenticated → 401; non-admin create → 403.
- [ ] **TOKENS-03 Audit `tokens.create`** — Records `tokenId`, `name`, `amount`, `decimal`, `txpowId`; no secrets; failed creates do not log success.
- [ ] **TOKENS-04 UI create flow** — Modal with name/supply/decimal; minimum MINIMA indicator; submit disabled when insufficient; success toast.

### P1

- [ ] **TOKENS-05 Validation/errors** — < 0.001 MINIMA blocked; bad name/amount/decimal → 400; RPC failure → 502.
- [ ] **TOKENS-06 List behavior** — Excludes native `0x00`; merges SQLite metadata; empty wallet → `[]`.
- [ ] **TOKENS-07 Irreversibility UX** — No visible "cannot be undone" warning in create modal.
- [ ] **TOKENS-08 Duplicate idempotency** — Re-submit after partial failure skips second SQLite insert but returns success.

### P2

- [ ] **TOKENS-09** Repository/service unit tests (only parser test exists today)
- [ ] **TOKENS-10** Event listeners (defer — automation design)
- [ ] **TOKENS-11** Dedicated Tokens nav page (optional)
- [ ] **TOKENS-12** `tokens.create` audit rows not visible in Diagnostics UI

---

## Wallet

### P0

- [ ] **WALLET-01 Seed phrase import** — Phrase sent as JSON body over the connection; **use only on HTTPS default deploy**. Confirm phrase not in Docker logs; `wallet.import` audit has `{ userId }` only.
- [ ] **WALLET-02 Auth gating** — GET routes: any auth; POST mutations (`receive-address`, `send-payment`, `import`): admin.
- [ ] **WALLET-03 Live RPC parsers** — `parseSendResponse`, `parsePaymentStatusResponse`, `parseImportResponse` not verified against live node.
- [ ] **WALLET-04 Clipboard** — `CopyableCode` silently fails without secure context; no fallback toast on HTTP.

### P1

- [ ] **WALLET-05 Import restart** — Node may restart after import; verify RPC recovery and no stale balance.
- [ ] **WALLET-06 Send errors** — Insufficient balance, malformed address, zero/negative amount surfaced correctly.
- [ ] **WALLET-07 Token names** — Custom tokens show human-readable name in send modal (not tokenId fallback).
- [ ] **WALLET-08 Address validation** — No server-side format regex; frontend placeholder `Mx… or 0x…` only.

### P2

- [ ] **WALLET-09** No parser unit tests for `wallet.parse.ts`
- [ ] **WALLET-10** Wallet audit events (`wallet.payment.send`, `wallet.import`, etc.) not in Diagnostics UI
- [ ] **WALLET-11** Receive history not implemented (send history only)

---

## Cross-cutting doc debt

These are not code gaps but stale docs that confuse QA:

- `SECURITY.md` custom-token section still mentions labeled accounts / `fromAccountAddress` (removed in 0.8.0).
- `docs/README.md` active-plans table references deleted plan files.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-29 | Consolidated per-area QA docs into single backlog; applied 0.8.0/0.9.0 corrections |
