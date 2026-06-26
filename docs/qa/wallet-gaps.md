# Wallet — QA & testing gaps

**Status:** Open — verify before treating wallet feature as field-ready  
**Created:** 2026-06-15  
**Updated:** 2026-06-26 — simplified to single-wallet model (labeled account architecture removed)  
**Security:** [SECURITY.md](../../SECURITY.md) — see _Seed Phrase Import_ and _Minima RPC Exposure_ sections

## Purpose

Wallet uses Minima's default single-wallet model: total balance from `balance` RPC, random receive address from `getaddress`, send from whole UTXO pool via `send`. Send history is persisted in SQLite. This document lists remaining gaps for QA: live RPC verification, auth hardening checks, and UX edge cases.

**Not in scope:** export backup (format TBD), multi-wallet, node lock, burn fee UX.

---

## Exit criteria (Wallet QA sign-off)

Wallet moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack with a live Minima node.
- [ ] `npm run typecheck` passes.
- [ ] `npm --prefix backend run build` and `npm --prefix frontend run build` both pass.

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 4 | Must verify before field pilot |
| **P1** | 4 | Recommended during QA |
| **P2** | 3 | Post-QA / optional |

---

## P0 — Must verify before field pilot

### WALLET-01 — Seed phrase travels over plain HTTP

**Security ref:** [SECURITY.md — Seed Phrase Import](../../SECURITY.md)

`POST /api/wallet/import` sends the phrase as a JSON body over the LAN connection. On an untrusted network this can be intercepted.

- [ ] Confirm HTTPS + `COOKIE_SECURE=true` is in place before any field use of the import modal
- [ ] Verify phrase does not appear in backend Docker logs
- [ ] Verify audit event `wallet.import` in Diagnostics contains no phrase text — only `{ userId }` and timestamp

### WALLET-02 — Auth / role gating on all mutation routes

- [ ] Unauthenticated request to `GET /api/wallet/history` → 401
- [ ] Non-admin session to `GET /api/wallet/history` → 200 (read-only)
- [ ] Unauthenticated request to `POST /api/wallet/receive-address` → 401
- [ ] Non-admin session to `POST /api/wallet/receive-address` → 403
- [ ] Unauthenticated request to `POST /api/wallet/send-payment` → 401
- [ ] Non-admin session to `POST /api/wallet/send-payment` → 403
- [ ] Unauthenticated request to `POST /api/wallet/import` → 401
- [ ] Non-admin session to `POST /api/wallet/import` → 403
- [ ] Unauthenticated request to `GET /api/wallet/payment-status/:id` → 401
- [ ] Authenticated non-admin session to `GET /api/wallet/payment-status/:id` → 200 (read-only)

### WALLET-03 — Live Minima RPC response shapes unverified

`parseSendResponse`, `parsePaymentStatusResponse`, and `parseImportResponse` were written against documentation — not a live node response.

- [ ] Send a real test payment (even 0.0001 MINIMA to own address) and confirm `txpowId` is returned
- [ ] Verify `parsePaymentStatusResponse` correctly derives `confirmed` from `response.confirmed === true || txpow.isblock === true` on a real TX
- [ ] Verify `POST /api/wallet/import` reaches Minima `restore` RPC without error on a known-valid test phrase
- [ ] Confirm `parseImportResponse` correctly surfaces the `ok: false` path when Minima rejects the phrase

### WALLET-04 — Clipboard API requires HTTPS or localhost

`CopyableCode` calls `navigator.clipboard.writeText()`. This requires a secure context.

- [ ] Test copy buttons on the HTTP LAN deploy (`http://<pi-ip>:8080`) — verify behavior when `navigator.clipboard` is unavailable
- [ ] If silent fail is unacceptable: add fallback or a toast explaining why copy is unavailable

---

## P1 — Recommended during QA

### WALLET-05 — Node restart after wallet import

`POST /api/wallet/import` returns `{ ok: true, message: "Wallet restored. The node may restart…" }`. The node may restart immediately.

- [ ] Verify the Minima node recovers after import and RPC calls resume
- [ ] Confirm no stale balance data is shown while the node restarts

### WALLET-06 — Send payment error paths

- [ ] Attempt a send with insufficient balance — confirm `ok: false` + `status: "failed"`; form error shown in modal
- [ ] Attempt a send to a malformed address — confirm RPC error surfaced correctly
- [ ] Attempt a send of `0` or negative amount — confirm 400 from server-side validation before RPC call

### WALLET-07 — Token name parsing for custom tokens

`parseToken()` in `wallet.parse.ts` extracts `item.token` as the name. For custom tokens, Minima may return the name as a string or nested object.

- [ ] Verify custom tokens appear in the send modal token list with a human-readable name (not tokenId fallback)
- [ ] Verify the `isNative` flag and token selector work correctly with a mix of native + custom tokens

### WALLET-08 — Input validation on send-payment

- [ ] Confirm the Minima `send` RPC returns a clear error for a syntactically invalid address and that error surfaces in the modal
- [ ] Confirm the frontend placeholder `"Mx… or 0x…"` is sufficient guidance — or note if a format validator should be added

---

## P2 — Post-QA / optional

### WALLET-09 — No automated tests for parse functions

`wallet.parse.ts` has no tests.

- [ ] Add `node:test` fixtures for `parseBalanceResponse`, `parseAddressResponse`, `parseSendResponse`, `parsePaymentStatusResponse`, `parseImportResponse`

### WALLET-10 — Wallet audit events not visible in Diagnostics UI

`wallet.address.get`, `wallet.payment.send`, and `wallet.import` are recorded but Diagnostics only surfaces Integritas proof history.

- [ ] Decide: add general audit log view to Diagnostics, or keep wallet events backend-only

### WALLET-11 — Receive history not implemented

Current scope: send activity only. Phase 2 target: receive history from Minima `history` / `txpow` parsing.

- [ ] Define parser contract for `history` entries into wallet-friendly rows
- [ ] Add receive rows to the wallet history API/UI with pagination

---

## Manual QA checklist (copy for test runs)

```txt
Wallet QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Balance
[ ] GET /api/wallet returns { checkedAt, tokens } with correct isNative flags
[ ] Wallet page hero card shows total sendable MINIMA
[ ] Dashboard wallet card shows balance; shows "Unavailable" when node is down

Send payment modal
[ ] Recipient address field accepts Mx… and 0x… formats
[ ] Token dropdown shows wallet tokens with sendable balance displayed
[ ] Form blocks submit when amount exceeds sendable balance
[ ] Form rejects empty address → inline error
[ ] Form rejects 0 / negative / non-numeric amount → inline error
[ ] Valid send → success toast with truncated txpowId; history row appears

Send history
[ ] History card shows recent sends with "To <address>" annotation
[ ] History detail modal shows amount, to address, token ID, txpow ID with copy buttons

Import wallet modal
[ ] Warning banner visible before entering phrase
[ ] Fewer than 12 words → frontend error (no API call)
[ ] Valid phrase → node restores; success message shown; toast fires
[ ] Invalid phrase → error from Minima surfaced in modal

Auth / role gating
[ ] Unauthenticated → 401 on all POST /api/wallet/* routes
[ ] Non-admin session → 403 on send-payment, import, debug clears
[ ] Non-admin session → 200 on GET /api/wallet, /history, /payment-status/:id

Audit log
[ ] wallet.payment.send recorded with { address, amount, tokenId, txpowId } — no phrase, no account refs
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
| 2026-06-26 | Rewritten for single-wallet model — removed labeled account gaps (WALLET-02 route list, checklist, purpose) |
| 2026-06-16 | Updated for multi-account UX, send history, CopyableCode |
| 2026-06-15 | Initial wallet QA gaps |
