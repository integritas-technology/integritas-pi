# Tokens — QA & testing gaps

**Status:** Open — track in QA phase before treating custom token creation as field-ready  
**Created:** 2026-06-24  
**Updated:** 2026-06-26 — removed labeled-account requirements (wallet simplification)  
**Security:** [SECURITY.md](../../SECURITY.md) — see _Custom token creation (admin)_

## Purpose

Token creation uses Minima `tokencreate name:X amount:Y decimals:Z`. The wallet must hold at least `0.001` sendable MINIMA — no labeled account required. Token list (`GET /api/tokens`) merges live Minima `balance` with SQLite `custom_tokens` metadata. This document lists remaining gaps for QA.

**Not in scope here:** token event listeners, dedicated Tokens nav page, NFT/rich metadata, repository integration tests.

---

## Exit criteria (Tokens QA sign-off)

Tokens moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack with a live Minima node and wallet holding ≥ 0.001 sendable MINIMA.
- [ ] `npm run typecheck` + tests pass; `npm --prefix backend run build` and `npm --prefix frontend run build` pass.

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 4 | Must verify before field pilot |
| **P1** | 4 | Recommended during QA |
| **P2** | 4 | Post-QA / optional |

---

## P0 — Must verify before field pilot

### TOKENS-01 — Live `tokencreate` RPC shape on Pi hardware

**Shipped behavior:** Backend sends `tokencreate name:X amount:Y decimals:Z`. `parseTokenCreateResponse` extracts `tokenId` from txpow `body.txn.outputs[].token.tokenid`. Parser unit tests cover error and txpow-output shapes only — not a live node response.

- [ ] On a running Minima container, run `help command:tokencreate` and confirm param names match the service command string
- [ ] Create a token via `POST /api/tokens/create` (curl or UI) with a wallet holding ≥ `0.001` sendable MINIMA
- [ ] Confirm response includes `tokenId` and `txpowId`; row appears in SQLite `custom_tokens`
- [ ] Confirm `GET /api/tokens` returns the new token with `createdLocally: true` and correct `decimal`
- [ ] Confirm `GET /api/wallet` shows the new token after refresh

### TOKENS-02 — Auth / role gating on token routes

- [ ] Unauthenticated request to `GET /api/tokens` → 401
- [ ] Unauthenticated request to `GET /api/tokens/create-requirements` → 401
- [ ] Unauthenticated request to `POST /api/tokens/create` → 401
- [ ] Non-admin session to `POST /api/tokens/create` → 403
- [ ] Authenticated session to `GET /api/tokens` → 200

### TOKENS-03 — Audit event `tokens.create` without secrets

- [ ] Successful create records audit event `tokens.create` with `tokenId`, `name`, `amount`, `decimal`, `txpowId` — no RPC passwords or seed material
- [ ] Failed create (502 / `ok: false`) does not record a misleading success audit row

### TOKENS-04 — End-to-end UI create flow

**Shipped behavior:** Wallet page **Create token** opens a modal with name, supply amount, and decimal places. Wallet MINIMA balance shown with pass/fail indicator against minimum. Submit disabled when insufficient MINIMA.

- [ ] Admin opens Wallet → **Create token** → submits valid fields with sufficient MINIMA → success toast
- [ ] New token appears in send-payment token picker after refresh
- [ ] Modal disables submit and shows minimum MINIMA requirement when wallet balance is too low

---

## P1 — Recommended during QA

### TOKENS-05 — Balance validation and error surfaces

- [ ] `POST /api/tokens/create` with wallet sendable MINIMA < `0.001` → `ok: false` with actionable message (no RPC call)
- [ ] `GET /api/tokens/create-requirements` returns `estimatedMinimaCost`, `minimumAccountMinima`, and `note`
- [ ] Empty `name` → 400
- [ ] Zero or negative `amount` → 400
- [ ] Non-integer or negative `decimal` → 400
- [ ] Minima RPC failure → 502 with error detail (no secret leakage in response body)
- [ ] UI shows inline error for `ok: false` API responses

### TOKENS-06 — List endpoint behavior

- [ ] `GET /api/tokens` excludes native MINIMA (`0x00`)
- [ ] Tokens received from elsewhere show `createdLocally: false`; Pi-created tokens show `true` with SQLite name preference
- [ ] Empty wallet returns `{ checkedAt, tokens: [] }` without error
- [ ] Minima unreachable → 502 from list route

### TOKENS-07 — On-chain irreversibility UX

**Current:** Destructive-action warning in `CreateTokenModal` is not shown; submit and loading copy mention timing only.

- [ ] Product decision: add visible "on-chain / cannot be undone" warning **or** accept and note in `SECURITY.md`
- [ ] Verify loading state persists for slow `tokencreate` (up to 60 s backend timeout)

### TOKENS-08 — Duplicate create idempotency

If Minima returns a `tokenId` already in `custom_tokens`, the service skips a second insert but still returns success.

- [ ] Confirm behavior is acceptable when re-submitting after partial failure

---

## P2 — Post-QA / optional

### TOKENS-09 — Repository and service unit tests

- [ ] Add `tokens.repository.test.ts` (insert, list, find by `token_id`)
- [ ] Add service tests for `listWalletTokens` merge logic (mock wallet status + SQLite rows)

### TOKENS-10 — Event listeners (ticket future)

Deferred — overlaps automation engine (BE-007). Do not implement without automation design sign-off.

### TOKENS-11 — Dedicated Tokens page / nav

Optional polish: standalone catalog view using `GET /api/tokens`.

### TOKENS-12 — Diagnostics visibility for token audit events

- [ ] Confirm `tokens.create` rows are readable in Diagnostics audit/history UI

---

## Manual QA checklist (copy for test runs)

```txt
Tokens QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Prerequisites
[ ] Minima node running and synced
[ ] Wallet holds ≥ 0.001 sendable MINIMA

Core flows
[ ] GET /api/tokens/create-requirements — cost fields present
[ ] POST /api/tokens/create (admin) — tokenId + SQLite row
[ ] GET /api/tokens — createdLocally true for new token
[ ] Wallet UI create-token modal — success toast + wallet refresh
[ ] New token in send payment token picker

Failure modes
[ ] Insufficient wallet MINIMA — clear error, no silent success
[ ] Invalid amount/decimal — 400
[ ] Minima down — 502 on list/create

Security / auth
[ ] Unauthenticated → 401 on all /api/tokens routes
[ ] Non-admin create → 403
[ ] Audit tokens.create — no secrets in Diagnostics

Automated
[ ] npm run test — parseTokenCreateResponse suite passes
[ ] npm run typecheck
[ ] npm --prefix backend run build && npm --prefix frontend run build

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-26 | Removed labeled-account requirements throughout — TOKENS-04 UX, TOKENS-05 validation, prerequisites, checklist |
| 2026-06-24 | Initial tokens QA gaps from plan vs implementation audit |
