# Wallet — QA & testing gaps

**Status:** Open — verify before treating wallet feature as field-ready  
**Created:** 2026-06-15  
**Hub:** [qa/README.md](./README.md)  
**Plan (shipped):** [wallet.md](../plans/wallet.md)  
**Security:** [SECURITY.md](../../SECURITY.md) — see _Seed Phrase Import_ and _Minima RPC Exposure_ sections

## Purpose

Phases 1–4 of the wallet plan are **implemented** (balance API, dashboard card, labeled multi-account UX, send/import, SQLite send history, account recovery for unlabeled funded addresses). This document lists **remaining gaps** for QA: live RPC verification, auth hardening checks, and UX edge cases discovered during implementation.

**Not in scope here:** export backup (deferred — format TBD), MEG multi-wallet, node lock, burn fee UX.

---

## Exit criteria (Wallet QA sign-off)

Wallet moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack with a live Minima node.
- [ ] `npm run check` passes (TypeScript + lint).
- [ ] `npm --prefix backend run build` and `npm --prefix frontend run build` both pass.

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 4 | Must verify before field pilot |
| **P1** | 5 | Recommended during QA |
| **P2** | 4 | Post-QA / optional |

---

## P0 — Must verify before field pilot

### WALLET-01 — Seed phrase travels over plain HTTP

**Security ref:** [SECURITY.md — Seed Phrase Import](../../SECURITY.md)

`POST /api/wallet/import` sends the phrase as a JSON body over the existing HTTP-only LAN connection. On an untrusted network this can be intercepted.

- [ ] Confirm HTTPS + `COOKIE_SECURE=true` is in place before any field use of the import modal
- [ ] Verify phrase does not appear in backend Docker logs (request body must not be logged)
- [ ] Verify audit event `wallet.import` in Diagnostics contains no phrase text — only `{ userId }` and timestamp

### WALLET-02 — Auth / role gating on all mutation routes

**Plan ref:** [Canonical API routes](../plans/wallet.md#canonical-api-routes)

- [ ] Unauthenticated request to `POST /api/wallet/accounts` → 401
- [ ] Non-admin session to `POST /api/wallet/accounts` → 403
- [ ] Unauthenticated request to `GET /api/wallet/history` → 401
- [ ] Non-admin session to `GET /api/wallet/history` → 200 (read-only)
- [ ] Unauthenticated request to `POST /api/wallet/receive-address` → 401
- [ ] Non-admin session to `POST /api/wallet/receive-address` → 403
- [ ] Unauthenticated request to `POST /api/wallet/send-payment` → 401
- [ ] Non-admin session to `POST /api/wallet/send-payment` → 403
- [ ] Unauthenticated request to `POST /api/wallet/import` → 401
- [ ] Non-admin session to `POST /api/wallet/import` → 403
- [ ] Unauthenticated request to `GET /api/wallet/payment-status/:id` → 401
- [ ] Non-admin (but authenticated) session to `GET /api/wallet/payment-status/:id` → 200 (read-only, auth-only)

### WALLET-03 — Live Minima RPC response shapes unverified

**Shipped behavior:** `parseSendResponse`, `parsePaymentStatusResponse`, and `parseImportResponse` were written against documentation and known Minima patterns — not against a live node response.

- [ ] Send a real test payment (even 0.0001 MINIMA to own address) and confirm `txpowId` is returned and the poll reaches `confirmed`
- [ ] Verify `parsePaymentStatusResponse` correctly derives `confirmed` from `response.confirmed === true || txpow.isblock === true` on a real confirmed TX
- [ ] Verify `POST /api/wallet/import` reaches Minima (`restore` RPC) without error on a known-valid phrase (use a test phrase on a dev node)
- [ ] Confirm `parseImportResponse` correctly surfaces the `ok: false` path when Minima rejects the phrase

### WALLET-04 — Clipboard API requires HTTPS or localhost

**Shipped behavior:** `CopyableCode` (account/history modals) calls `navigator.clipboard.writeText()`. This API requires a secure context (HTTPS or `localhost`).

- [ ] Test copy buttons on the HTTP LAN deploy (`http://<pi-ip>:8080`) — verify behavior when `navigator.clipboard` is unavailable (currently: silent fail in `CopyableCode`)
- [ ] If silent fail is unacceptable: add fallback (`document.execCommand('copy')` or a toast explaining why copy is unavailable)

---

## P1 — Recommended during QA

### WALLET-05 — Node restart after wallet import

**Shipped behavior:** `POST /api/wallet/import` succeeds and returns `{ ok: true, message: "Wallet restored. The node may restart…" }`. The Minima node may restart immediately after restore.

- [ ] Verify the Minima node recovers after import and RPC calls resume (dashboard and wallet page reload correctly)
- [ ] Verify the Dashboard Minima status card reflects the restarted state without a full page reload
- [ ] Confirm no stale balance or stale address data is shown while the node restarts

### WALLET-06 — Send payment error paths

**Shipped behavior:** `parseSendResponse` handles `record.status === false` for failures. Insufficient balance and invalid address errors are expected to come through this path.

- [ ] Attempt a send with insufficient balance — confirm `ok: false` + `status: "failed"` returned; form error shown in modal
- [ ] Attempt a send to a malformed address — confirm 400 or RPC error surfaced correctly
- [ ] Attempt a send of `0` or negative amount — confirm 400 from server-side validation before RPC call

### WALLET-07 — Token name parsing for custom tokens

**Shipped behavior:** `parseToken()` in `wallet.parse.ts` extracts `item.token` as the name. For native MINIMA this is always `"Minima"`. For custom tokens, Minima may return the name as a string or nested object.

- [ ] If any custom tokens are present on the node: verify they appear correctly in the token table with a human-readable name (not tokenId fallback)
- [ ] Verify the `isNative` flag and Minima / Tokens filter tabs work correctly with a mix of native + custom tokens

### WALLET-08 — Payment status `unknown` vs `pending` distinction

**Shipped behavior:** `parsePaymentStatusResponse` returns `"unknown"` when `response.txpow` is absent, `"pending"` otherwise. The UI treats both as "not yet confirmed" and keeps polling. The poll state only distinguishes `confirmed`, `failed`, and timeout.

- [ ] Verify that a valid submitted TX ID eventually transitions from `pending` → `confirmed` on a real send (not stuck in `unknown` indefinitely)
- [ ] Confirm what Minima returns for a TX ID that doesn't exist — verify `"unknown"` is returned and the poll continues until timeout rather than crashing

### WALLET-09 — Input validation gaps on send-payment

**Shipped behavior:** Backend validates `address` (non-empty string) and `amount` (positive finite number). No format check on address — any non-empty string is accepted by the backend.

- [ ] Confirm the Minima `send` RPC returns a clear error for a syntactically invalid address (e.g., `"notanaddress"`) and that error surfaces in the modal as `formError`
- [ ] Confirm the frontend placeholder text `"Mx… or 0x…"` is sufficient guidance — or note in wallet-gaps if an input format validator should be added

---

## P2 — Post-QA / optional

### WALLET-10 — No automated tests for parse functions

`wallet.parse.ts` contains all the Minima response normalization logic but has no tests. The minima feature has precedent (`node:test` fixtures in `minima.parse.ts`).

```bash
# Suggested: add fixture-based unit tests
npm --prefix backend run test:wallet   # (not yet implemented)
```

- [ ] Add `node:test` fixtures for `parseBalanceResponse` (empty, one native token, multiple tokens, malformed)
- [ ] Add fixtures for `parseAddressResponse` (with miniaddress, without miniaddress, missing both)
- [ ] Add fixtures for `parseSendResponse` (ok with txpowId, status:false, missing txpowid)
- [ ] Add fixtures for `parsePaymentStatusResponse` (confirmed, pending, unknown)
- [ ] Add fixtures for `parseImportResponse` (ok, status:false)

### WALLET-11 — Wallet audit events not visible in Diagnostics UI

`wallet.address.get`, `wallet.payment.send`, and `wallet.import` are recorded via `recordAuditEvent` but the Diagnostics page only surfaces Integritas proof history, not general audit events.

- [ ] Decide: add a general audit log view to Diagnostics, or keep wallet events backend-only (accessible via SQLite / logs)
- [ ] Note: this is a product decision, not a bug — wallet events _are_ recorded; they're just not displayed

### WALLET-12 — Send confirmation not surfaced in wallet UI after submit

**Shipped behavior:** `SendPaymentModal` closes on successful submit with a toast containing a truncated `txpowId`. The wallet UI does not poll `GET /api/wallet/payment-status/:txpowid` or show a pending-transactions list.

- [ ] Decide: reintroduce optional in-page poll, or rely on send history + manual `payment-status` lookup
- [ ] Confirm `wallet.payment.send` audit event includes `txpowId` for operator lookup (currently yes)
- [ ] Optionally: surface pending sends in the history card when status is `submitted` but unconfirmed on-chain

### WALLET-13 — `restore` / `import` and Megammr resync interaction

**Security ref:** [SECURITY.md — Seed Phrase Import (Megammr note)](../../SECURITY.md)

If `MINIMA_AUTO_RESYNC=true` is enabled and a resync triggers concurrently with a wallet import, behavior is unverified.

- [ ] Verify: disable `MINIMA_AUTO_RESYNC` before using `POST /api/wallet/import` in any field scenario
- [ ] Document this as an operator checklist item in the deploy guide when the export/import flow is fully scoped

### WALLET-14 — Receive history (Phase 2) not implemented yet

**Current scope:** Wallet history currently records **send activity** from backend `POST /api/wallet/send-payment` into SQLite (`wallet_send_history`) and renders it in the Wallet page.

**Phase 2 target:** add **receive history** based on Minima node data (`history` / `txpow` parsing), mapped to labeled account addresses.

- [ ] Define parser contract for `history` entries into wallet-friendly rows (`direction`, `address`, `token`, `amount`, `txpowId`, `timestamp`)
- [ ] Verify token amount and name normalization for received custom tokens
- [ ] Add receive rows to the wallet history API/UI with pagination and clear distinction from local send-only records
- [ ] Document residual gaps when chain pruning or node re-sync affects historical visibility

---

## Manual QA checklist (copy for test runs)

```txt
Wallet QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Balance and accounts
[ ] GET /api/wallet returns { checkedAt, tokens } with correct isNative flags
[ ] GET /api/wallet/accounts returns labeled accounts + unlabeledFunded when applicable
[ ] WalletPage hero card shows total MINIMA across labeled accounts
[ ] Create account (random address) and label existing funded address both work
[ ] Account detail shows Mx/0x with CopyableCode; funds tabs filter Minima vs custom tokens
[ ] Dashboard wallet card shows balance; shows "Unavailable" when node is down

Send payment modal
[ ] Requires source account selection
[ ] External and internal (my account) destination modes work
[ ] Token row shows available balance for selected account + token
[ ] Form blocks submit when amount exceeds available balance
[ ] Form rejects empty address → inline error
[ ] Form rejects 0 / negative / non-numeric amount → inline error
[ ] Valid send → success toast with truncated txpowId; history row appears

Send history
[ ] History card shows recent sends with account flow annotation
[ ] History detail modal shows amount, addresses, token ID, txpow ID with copy buttons

Import wallet modal
[ ] Warning banner visible before entering phrase
[ ] Fewer than 12 words → frontend error (no API call)
[ ] Valid phrase → node restores; success message shown; toast fires
[ ] Invalid phrase → error from Minima surfaced in modal

Auth / role gating
[ ] Unauthenticated → 401 on all POST /api/wallet/* routes
[ ] Non-admin session → 403 on send-payment, import, accounts create, debug clears
[ ] Non-admin session → 200 on GET /api/wallet, /accounts, /history, /payment-status/:id

Audit log
[ ] wallet.payment.send recorded with { address, amount, tokenId, txpowId, fromAccountAddress } — no phrase
[ ] wallet.account.create recorded after account create
[ ] wallet.import recorded — no phrase in detail field

Automated
[ ] npm run typecheck
[ ] npm --prefix backend run build
[ ] npm --prefix frontend run build

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-16 | Updated for multi-account UX, send history, CopyableCode, send UX changes (no in-page poll) |
| 2026-06-15 | Initial wallet QA gaps — plan vs implementation audit, Phases 1–3 |
