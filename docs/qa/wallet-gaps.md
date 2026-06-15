# Wallet — QA & testing gaps

**Status:** Open — verify before treating wallet feature as field-ready  
**Created:** 2026-06-15  
**Hub:** [qa/README.md](./README.md)  
**Plan (shipped):** [wallet.md](../plans/wallet.md)  
**Security:** [SECURITY.md](../../SECURITY.md) — see _Seed Phrase Import_ and _Minima RPC Exposure_ sections

## Purpose

Phases 1–3 of the wallet plan are **implemented** (balance API, token filter, dashboard card, receive address modal, send payment modal with in-page polling, seed phrase import modal). This document lists **remaining gaps** for QA: live RPC verification, auth hardening checks, and UX edge cases discovered during implementation.

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

**Shipped behavior:** `ReceiveAddressModal` Copy button calls `navigator.clipboard.writeText()`. This API requires a secure context (HTTPS or `localhost`).

- [ ] Test Copy button on the HTTP LAN deploy (`http://<pi-ip>:8080`) — verify behavior when `navigator.clipboard` is unavailable (currently: no error handling, silent fail)
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

### WALLET-12 — Mid-poll close loses transaction traceability

**Shipped behavior:** Closing `SendPaymentModal` during polling fires an info toast with a message to "check the diagnostics log." The TX continues on-chain, but the UI has no way to resurface its status later.

- [ ] Decide: add txpowId to the wallet audit event detail so operators can look it up manually (currently `wallet.payment.send` already includes `txpowId`)
- [ ] Optionally: surface a "pending transactions" list on the Wallet page in a future iteration

### WALLET-13 — `restore` / `import` and Megammr resync interaction

**Security ref:** [SECURITY.md — Seed Phrase Import (Megammr note)](../../SECURITY.md)

If `MINIMA_AUTO_RESYNC=true` is enabled and a resync triggers concurrently with a wallet import, behavior is unverified.

- [ ] Verify: disable `MINIMA_AUTO_RESYNC` before using `POST /api/wallet/import` in any field scenario
- [ ] Document this as an operator checklist item in the deploy guide when the export/import flow is fully scoped

---

## Manual QA checklist (copy for test runs)

```txt
Wallet QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Balance and token display
[ ] GET /api/wallet returns { checkedAt, tokens } with correct isNative flags
[ ] WalletPage hero card shows confirmed MINIMA balance
[ ] Token filter tabs (All / Minima / Tokens) filter correctly
[ ] Dashboard wallet card shows balance; shows "Unavailable" when node is down

Receive address modal
[ ] Opens and fetches an address (Mx format shown green, 0x shown below)
[ ] Copy button copies Mx address to clipboard (note: requires HTTPS or localhost)
[ ] "Get another address" fetches a different address from the 64-address pool

Send payment modal
[ ] Form rejects empty address → inline error
[ ] Form rejects 0 / negative / non-numeric amount → inline error
[ ] Valid send → txpowId shown in pending state
[ ] Poll reaches confirmed within 60 s on real node (or timeout state shown)
[ ] Closing mid-poll fires info toast

Import wallet modal
[ ] Warning banner visible before entering phrase
[ ] Fewer than 12 words → frontend error (no API call)
[ ] Valid phrase → node restores; success message shown; toast fires
[ ] Invalid phrase → error from Minima surfaced in modal

Auth / role gating
[ ] Unauthenticated → 401 on all POST /api/wallet/* routes
[ ] Non-admin session → 403 on receive-address, send-payment, import
[ ] Non-admin session → 200 on GET /api/wallet/payment-status/:id

Audit log
[ ] wallet.address.get recorded after receive-address (visible in SQLite / backend logs)
[ ] wallet.payment.send recorded with { address, amount, tokenId, txpowId } — no phrase
[ ] wallet.import recorded — no phrase in detail field

Automated
[ ] npm run check
[ ] npm --prefix backend run build
[ ] npm --prefix frontend run build

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Initial wallet QA gaps — plan vs implementation audit, Phases 1–3 |
