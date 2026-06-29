# QA gap docs sanity-check report

**Date:** 2026-06-29  
**Checked against:** commit `97ae112` (`main`)  
**Scope:** `docs/qa/*.md` vs. current code, `CHANGELOG.md`, and recent git history  
**Author:** Kimi Code CLI (read-only inspection)

---

## Executive summary

The five QA gap documents in `docs/qa/` are **mostly accurate** but several are now slightly out of date because of recent releases (especially 0.8.0 wallet simplification and 0.9.0 auth settings). None of the technical gaps themselves have silently closed — the code still matches the open issues described — but the surrounding narrative, file references, and checklists need a small cleanup pass.

**Headline findings:**

1. `docs/qa/auth-gaps.md` is accurate but misses the new 0.9.0 account-settings password/TOTP-reset flow.
2. `docs/qa/device-status-gaps.md` references a deleted plan file and still says the dashboard has six metric cards; it currently has seven.
3. `docs/qa/wallet-gaps.md` opens with “seed phrase travels over plain HTTP,” which is misleading now that HTTPS is the default deploy.
4. `SECURITY.md` still describes custom token creation using labeled accounts/`fromAccountAddress`, which the code no longer does.
5. `docs/README.md` lists a `plans/wallet-simplification.md` plan as “In progress,” but that file was deleted when the feature shipped.

All P0 technical gaps remain real and open.

---

## What I checked

- Read every file in `docs/qa/`.
- Read `CHANGELOG.md`, `SECURITY.md`, `docs/README.md`, `docs/plans/v1-security.md`.
- Checked `git log` for recent commits, especially the latest `97ae112` (“Removed obsolete and old documentation; add empty reports directory.”).
- Inspected backend routes (`backend/src/app.ts`, feature routers, services) and frontend pages (`DashboardPage`, `WalletPage`, `MinimaPage`, `AuthSettingsPage`).
- Cross-referenced QA claims against actual code paths.

---

## Findings by QA doc

### 1. `docs/qa/auth-gaps.md`

| Area | Verdict | Notes |
|------|---------|-------|
| GAP-01 HTTPS + Secure cookies | Accurate | HTTPS is the default Docker deploy, nginx redirects HTTP→HTTPS, `COOKIE_SECURE=true` in `.env`/compose. HSTS is still absent, matching the “deferred” note. |
| GAP-02 Automated auth tests | Accurate | No auth tests exist. Only parser tests (`minima.parse.test.ts`, `tokens.parse.test.ts`) are present. |
| GAP-03 Manual E2E checklist | Accurate | Checklist is still open/unchecked. |
| GAP-04 `APP_SECRET` startup validation | Accurate | `backend/src/config/env.ts` defaults to `dev-change-me`; `backend/src/index.ts` only warns, does not refuse startup. |
| GAP-05 TOTP secret in setup API | Accurate, needs widening | `POST /api/setup/totp/init` still returns `secret`. The same exposure now also exists in the 0.9.0 account-settings TOTP reset flow. The doc should mention both. |
| GAP-06 CSRF baseline | Accurate | No CSRF tokens; only `SameSite=Strict` cookies. |
| GAP-07 Security headers | Accurate | No CSP / X-Frame-Options / etc. in nginx or backend. |
| GAP-08 Session cleanup | Accurate | `deleteExpiredSessions()` exists but is not scheduled from `index.ts`. |
| GAP-09 Single-session on login | Accurate | New sessions are created without invalidating old ones. |
| GAP-10 Rate limits beyond login/setup | Accurate, minor update needed | Rate limiter now also covers `/api/auth/settings/*`, but still not broader endpoints like Integritas stamp or automation. |
| GAP-11 `zod` validation | Accurate | No `zod` in backend; manual checks remain. |
| GAP-12 `requireRole('admin')` on Integritas mutations | Accurate | Only `/api/integritas/api-key/*` is admin-gated; stamp/history/verify routes are `requireAuth` only. |
| GAP-13 Audit log hygiene | Accurate | `login.failure` stores `"failed"` only; no passwords/TOTP/API keys logged. |
| GAP-17 Password change + session invalidation | Partly outdated | Password change and TOTP reset **are** implemented in 0.9.0 (`AuthSettingsPage`, `auth.service.ts`). Session invalidation after change is still missing. The doc should split this into “UI done / session invalidation still missing.” |
| P2 items (Argon2id, `__Host-` prefix, CLI auth, pen test) | Accurate | No changes since the doc was written. |

**Recommended updates:**
- Mention the 0.9.0 account-settings TOTP reset in GAP-05.
- Update GAP-17 to reflect implemented UI/backend but missing session invalidation.
- Note that `/api/auth/settings/*` is also rate-limited in GAP-10.

---

### 2. `docs/qa/device-status-gaps.md`

| Area | Verdict | Notes |
|------|---------|-------|
| DS-01 `GET /api/status` shape/auth | Accurate | Route is behind `requireAuth`; returns `{ checkedAt, device, app, node }` with `setupComplete` and `integritasConnected` behaving as described. |
| DS-02 Device ID stability | Accurate | `ensureDeviceId()` writes once, reads back on restarts. |
| DS-03 Graceful shutdown | Accurate with caveat | Signal handler stops schedulers/pollers, MQTT/GPIO ingestion, and closes SQLite. The Express HTTP server is **not explicitly closed**, which could delay shutdown under active connections. Worth a one-line note. |
| DS-04 Unit tests for `device.service.ts` | Accurate | No tests exist. |
| DS-05 Tests for `status.routes.ts` | Accurate | No tests exist. |
| DS-06 Integration test for `/api/health` | Accurate | No integration test exists; health route returns `{ status: "ok", service: "integritas-pi-backend" }`. |
| DS-07 `integritasConnected` live check | Accurate | 30 s cache, 3 s timeout; unreachable upstream returns `false` with HTTP 200. |
| DS-08 API shape drift vs plan | Outdated | `docs/plans/device-status.md` was deleted in commit `97ae112`. The stale-plan issue is moot. The doc should remove this reference. |
| Dashboard metric card count | Partly outdated | `DashboardPage.tsx` renders **seven** `MetricCard`s (Wallet balance, Node status, Integritas API, Device, Device CPU, Device Memory, Device Disk). The doc and checklist still say six. |

**Recommended updates:**
- Remove or rewrite DS-08 because the plan file no longer exists.
- Update manual checklist to seven cards and add Wallet balance.
- Add a note that the Express server is not explicitly closed during graceful shutdown.

---

### 3. `docs/qa/minima-gaps.md`

| Area | Verdict | Notes |
|------|---------|-------|
| MINIMA-01 Stopped container → `state: stopped` | Accurate | Service derives `stopped` from Docker state and RPC failure. |
| MINIMA-02 Megammr resync + auto-restart UI | Accurate | UI chains container restart when Minima reports `needsRestart`; polling pauses during operation. |
| MINIMA-03 Manual container restart | Accurate | Admin-only, audit event recorded. |
| MINIMA-04 Peer add | Accurate | `GET /api/minima/peers` read-only auth; `POST /api/minima/peers/add` admin-only. |
| MINIMA-05 Parser unit tests | Accurate | `minima.parse.test.ts` has 8 tests. |
| MINIMA-06 Admin gate on resync | Accurate | `POST /api/minima/megammrsync/resync` is `requireAuth` only, not admin. |
| MINIMA-07 Admin gate on Megammr config | Accurate | `POST /api/minima/config` is `requireAuth` only. |
| MINIMA-08 Auto-resync does not restart container | Accurate | Poller calls `resyncMegammr()` only; no container restart even if `needsRestart`. |
| MINIMA-09 App shell overview not refreshed | Accurate | Overview fetched once on mount. |
| MINIMA-10 Stall detection snapshot | Accurate | In-memory snapshot resets on backend restart. |
| MINIMA-11 Docker socket writable | Accurate | Socket mount is writable; risk accepted in `SECURITY.md`. |
| MINIMA-12–15 P2 items | Accurate | No integration-test flag, no peer remove, no curl examples, peers route still returns 502 on RPC failure. |

**Recommended updates:** none major; doc remains current.

---

### 4. `docs/qa/tokens-gaps.md`

| Area | Verdict | Notes |
|------|---------|-------|
| TOKENS-01 Live `tokencreate` RPC | Accurate | Backend sends `tokencreate name:X amount:Y decimals:Z`, parses txpow outputs, persists to `custom_tokens`. |
| TOKENS-02 Auth/role gating | Accurate | List/requirements require auth; create requires admin. |
| TOKENS-03 Audit event `tokens.create` | Accurate | Records tokenId/name/amount/decimal/txpowId; no secrets. Failed creates do not record success audit rows. |
| TOKENS-04 UI create flow | Accurate | Modal has name/supply/decimal, no account picker, minimum-balance indicator, disabled submit when insufficient, success toast. |
| TOKENS-05 Validation/error surfaces | Accurate | < 0.001 MINIMA blocked; empty name / bad amount / bad decimal → 400; RPC failure → 502. |
| TOKENS-06 List endpoint behavior | Accurate | Excludes native `0x00`; merges SQLite metadata; empty wallet returns `[]`. |
| TOKENS-07 On-chain irreversibility UX | Accurate | Create-token modal still lacks a visible “cannot be undone” warning. |
| TOKENS-08 Duplicate idempotency | Accurate | Service skips insert if tokenId already exists. |
| TOKENS-09 Repository/service tests | Accurate (gap) | Only parser test exists. |
| TOKENS-12 Audit visibility | Accurate (gap) | Diagnostics page shows only proof/read history; `tokens.create` audit rows are not visible. |

**Recommended updates:** none major. Note that `SECURITY.md`’s token-creation section is stale (see cross-cutting issue below).

---

### 5. `docs/qa/wallet-gaps.md`

| Area | Verdict | Notes |
|------|---------|-------|
| WALLET-01 Seed phrase over HTTP | Partly outdated | The **default** deploy is now HTTPS, and the doc’s opening framing (“travels over plain HTTP”) is misleading. The real point — only use import over HTTPS — is still valid. Request logging is method/URL only; `wallet.import` audit event stores only `userId`, no phrase. |
| WALLET-02 Auth/role gating | Accurate | GET routes any auth; POST mutations (`receive-address`, `send-payment`, `import`) admin-only. Old labeled-account routes are gone. |
| WALLET-03 Live RPC parsers | Accurate | Parsers exist and are used; not verified against live node. |
| WALLET-04 Clipboard API | Accurate | `CopyableCode` silently ignores clipboard failures; no fallback on HTTP. |
| WALLET-05 Node restart after import | Accurate | Message is surfaced; recovery not verified. |
| WALLET-06 Send payment errors | Accurate | Validation, failed status, and RPC error surfacing are present. |
| WALLET-07 Token name parsing | Accurate | `parseToken` handles string/object token metadata and falls back to tokenId. |
| WALLET-08 Input validation | Accurate | No address-format regex; frontend placeholder is `Mx… or 0x…`. |
| WALLET-09 Parser tests | Accurate (gap) | No wallet parser tests. |
| WALLET-10 Audit visibility | Accurate (gap) | Wallet audit events are not shown in Diagnostics UI. |
| WALLET-11 Receive history | Accurate | Send history only; no receive history parser/endpoint. |

**Recommended updates:**
- Rewrite WALLET-01 to say the seed phrase travels over the existing connection and must only be used on the HTTPS default deploy.

---

## Cross-cutting documentation issues

### 1. `docs/README.md` active plans table is stale

It lists:

| Plan | Status |
|---|---|
| `plans/wallet-simplification.md` | In progress |
| `plans/v1-security.md` | In progress |

`plans/wallet-simplification.md` does **not exist**; the simplification shipped in 0.8.0. `v1-security.md` still exists and is correctly “In progress.”

**Fix:** Remove the wallet-simplification row or mark it Complete/Removed and point to CHANGELOG 0.8.0.

### 2. `SECURITY.md` custom-token section is stale

Lines 109–122 still say token creation requires a “labeled wallet account” and validates `fromAccountAddress`. The 0.8.0 simplification removed labeled accounts; `tokens.service.ts` now uses the whole wallet’s sendable MINIMA and no `fromAccountAddress`.

**Fix:** Update the section to match the single-wallet, total-balance check introduced in 0.8.0.

### 3. Deleted plan files referenced by QA docs

- `docs/plans/device-status.md` — referenced in `device-status-gaps.md` DS-08. Deleted in `97ae112`.
- `docs/plans/wallet-simplification.md` — referenced in `docs/README.md`. Deleted when the feature shipped.

These references should be cleaned up so future readers are not pointed to missing files.

---

## Recent code changes that affect the QA docs

From `CHANGELOG.md` and `git log`:

- **0.9.0 (2026-06-26):** Account settings page added — password change and TOTP reset. This closes the “no password change UI” part of `auth-gaps.md` GAP-17 but leaves session invalidation open.
- **0.8.0 (2026-06-26):** Wallet simplified to single-wallet model; labeled accounts removed; token creation no longer uses `fromAccountAddress`; `SECURITY.md` was not fully updated.
- **0.7.3 (2026-06-26):** GPIO input data sources added.
- **0.7.1 (2026-06-24):** Dashboard layout changed; metric row split into node/wallet/integritas and device/cpu/memory/disk rows. Since then a Wallet balance card was added, making seven cards total.
- **Latest commit `97ae112`:** Removed obsolete documentation, including `docs/plans/device-status.md` and `docs/plans/wallet-simplification.md`.

---

## Recommendations (in priority order)

1. **Clean up broken/missing file references.**
   - Remove `plans/device-status.md` link from `device-status-gaps.md` DS-08.
   - Remove or update `plans/wallet-simplification.md` entry in `docs/README.md`.

2. **Update `SECURITY.md` for the single-wallet token model.**
   - Remove `fromAccountAddress` / labeled-account language from the custom-token section.

3. **Update `docs/qa/auth-gaps.md` for 0.9.0.**
   - Mention account-settings TOTP reset in GAP-05.
   - Split GAP-17 into “UI/backend done” vs “session invalidation still missing.”
   - Note `/api/auth/settings/*` is rate-limited.

4. **Update `docs/qa/device-status-gaps.md`.**
   - Remove DS-08 stale-plan reference.
   - Change dashboard checklist from six to seven metric cards.
   - Add note about Express HTTP server not being explicitly closed during shutdown.

5. **Update `docs/qa/wallet-gaps.md` WALLET-01.**
   - Replace “plain HTTP” framing with “only use over HTTPS default deploy.”

6. **No action needed on `minima-gaps.md` or most `tokens-gaps.md` entries** — they remain accurate.

---

## Bottom line

The QA gap docs are still a trustworthy guide to what is open. The only real inaccuracies are **documentation/meta-level** (broken plan references, stale `SECURITY.md` paragraph, card counts, and 0.9.0 auth-settings updates). No P0 technical gap is falsely marked closed, and no implemented feature is falsely marked missing — except that `auth-gaps.md` GAP-17 now understates the work that already shipped.
