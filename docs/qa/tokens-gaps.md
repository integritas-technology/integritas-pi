# Tokens — QA & testing gaps

**Status:** Open — track in QA phase before treating custom token creation as field-ready  
**Created:** 2026-06-24  
**Hub:** [qa/README.md](./README.md)  
**Plan (shipped):** [tokens.md](../plans/tokens.md)  
**Security:** [SECURITY.md](../../SECURITY.md) — see _Custom token creation (admin)_

## Purpose

Phases 1–2 of the tokens plan are **implemented** (`GET /api/tokens`, `POST /api/tokens/create`, `GET /api/tokens/create-requirements`, SQLite `custom_tokens`, Wallet page create-token modal with labeled-account funding checks). This document lists **remaining gaps** for QA: live `tokencreate` RPC verification on Pi hardware, auth hardening checks, and UX polish discovered during implementation.

**Not in scope here:** token event listeners (`/api/tokens/events`, `/api/tokens/listeners`), dedicated Tokens nav page, NFT/rich metadata, repository integration tests.

---

## Exit criteria (Tokens QA sign-off)

Tokens moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack with a live Minima node and labeled account holding MINIMA.
- [ ] `npm run check` typecheck + tests pass; `npm --prefix backend run build` and `npm --prefix frontend run build` pass.
- [ ] Optional: live integration tests pass with `TOKENS_INTEGRATION_TEST=1` (when implemented).

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 4 | Must verify before field pilot |
| **P1** | 5 | Recommended during QA |
| **P2** | 4 | Post-QA / optional |

---

## P0 — Must verify before field pilot

### TOKENS-01 — Live `tokencreate` RPC shape on Pi hardware

**Plan ref:** [Open decisions #1](../plans/tokens.md#open-decisions)  
**Shipped behavior:** Backend sends `tokencreate name:X amount:Y decimals:Z` (Minima uses `decimals:`; API request field remains `decimal`). `parseTokenCreateResponse` extracts `tokenId` from txpow `body.txn.outputs[].token.tokenid`. Parser unit tests cover error and txpow-output shapes only — not a live node response.

- [ ] On a running Minima container, run `help command:tokencreate` and confirm param names match the service command string
- [ ] Create a token via `POST /api/tokens/create` (curl or UI) with a labeled account funded with ≥ `0.001` MINIMA
- [ ] Confirm response includes `tokenId` and `txpowId`; row appears in SQLite `custom_tokens`
- [ ] Confirm `GET /api/tokens` returns the new token with `createdLocally: true` and correct `decimal`
- [ ] Confirm `GET /api/wallet` and account funds show the new token after refresh

### TOKENS-02 — Auth / role gating on token routes

**Plan ref:** [Canonical API routes](../plans/tokens.md#canonical-api-routes)

- [ ] Unauthenticated request to `GET /api/tokens` → 401
- [ ] Unauthenticated request to `GET /api/tokens/create-requirements` → 401
- [ ] Unauthenticated request to `POST /api/tokens/create` → 401
- [ ] Non-admin session to `POST /api/tokens/create` → 403 _(V1 has a single admin user; verify when multi-role ships)_
- [ ] Authenticated session to `GET /api/tokens` → 200

### TOKENS-03 — Audit event `tokens.create` without secrets

**Security ref:** [SECURITY.md — Custom token creation](../../SECURITY.md)

- [ ] Successful create records audit event `tokens.create` in Diagnostics with `tokenId`, `name`, `amount`, `decimal`, `txpowId`, `fromAccountAddress` — no RPC passwords or seed material
- [ ] Failed create (502 / `ok: false`) does not record a misleading success audit row

### TOKENS-04 — End-to-end UI create flow

**Shipped behavior:** Wallet page **Create token** opens a modal with account picker (funded labeled accounts only), name, supply amount, and decimal places. Success toast + account list refresh.

- [ ] Admin opens Wallet → **Create token** → selects funded labeled account → submits valid fields → success toast
- [ ] New token appears in source account funds and send-payment token picker
- [ ] Modal blocks submit when selected account has insufficient MINIMA on its address
- [ ] Operator with zero labeled accounts sees guidance to create/label an account first

---

## P1 — Recommended during QA

### TOKENS-05 — Labeled-account and funding validation

**Plan evolution:** Create requires `fromAccountAddress` on a labeled wallet account with ≥ `0.001` MINIMA on that address (not in original Phase 1 sketch).

- [ ] `POST /api/tokens/create` without `fromAccountAddress` → 400
- [ ] Unknown / unlabeled address → `ok: false` with friendly message (no RPC call)
- [ ] Labeled account with zero MINIMA on address → `ok: false` before or after RPC with actionable message
- [ ] `GET /api/tokens/create-requirements` returns `estimatedMinimaCost`, `minimumAccountMinima`, and `note`

### TOKENS-06 — Create validation and error surfaces

- [ ] Empty `name` → 400
- [ ] Zero or negative `amount` → 400
- [ ] Non-integer or negative `decimal` → 400
- [ ] Minima RPC failure → 502 with error detail (no secret leakage in response body)
- [ ] UI shows inline error for `ok: false` API responses (e.g. insufficient coins message)

### TOKENS-07 — List endpoint behavior

- [ ] `GET /api/tokens` excludes native MINIMA (`0x00`)
- [ ] Tokens received from elsewhere show `createdLocally: false`; Pi-created tokens show `true` with SQLite `name` preference
- [ ] Empty wallet returns `{ checkedAt, tokens: [] }` without error
- [ ] Minima unreachable → 502 from list route

### TOKENS-08 — On-chain irreversibility UX

**Current:** Destructive-action warning banner in `CreateTokenModal` is commented out; submit button and loading copy mention on-chain timing only.

- [ ] Product decision: restore visible “on-chain / cannot be undone” warning **or** accept risk and note in `SECURITY.md`
- [ ] Verify loading state persists for slow `tokencreate` (up to 60 s backend timeout)

### TOKENS-09 — Duplicate create idempotency

**Current:** If Minima returns a `tokenId` that already exists in `custom_tokens`, the service skips a second insert but still returns success.

- [ ] Confirm behavior is acceptable when re-submitting after partial failure
- [ ] Document or adjust if duplicate creates should error instead

---

## P2 — Post-QA / optional

### TOKENS-10 — Repository and service unit tests

**Plan deferred:** repository tests; partial parse coverage shipped in `tokens.parse.test.ts`.

- [ ] Add `tokens.repository.test.ts` (insert, list, find by `token_id`)
- [ ] Add service tests for `listWalletTokens` merge logic (mock wallet status + SQLite rows)

```bash
# Example when integration tests land
TOKENS_INTEGRATION_TEST=1 npm --prefix backend run test:tokens
```

### TOKENS-11 — Event listeners (ticket future)

Deferred per plan — overlaps automation engine (BE-007). Do not implement without automation design sign-off.

### TOKENS-12 — Dedicated Tokens page / nav

Optional polish: standalone catalog view using `GET /api/tokens`; wallet send/holdings remain on `/api/wallet/*`.

### TOKENS-13 — Diagnostics visibility for token audit events

- [ ] Confirm `tokens.create` rows are readable in Diagnostics audit/history UI (same pattern as `wallet.send`)

---

## Manual QA checklist (copy for test runs)

```txt
Tokens QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Prerequisites
[ ] Minima node running and synced
[ ] Labeled wallet account with ≥ 0.001 MINIMA on its address

Core flows
[ ] GET /api/tokens/create-requirements — cost fields present
[ ] POST /api/tokens/create (admin) — tokenId + SQLite row
[ ] GET /api/tokens — createdLocally true for new token
[ ] Wallet UI create-token modal — success toast + account refresh
[ ] New token in account funds and send token picker

Failure modes
[ ] Unlabeled / unfunded account — clear error, no silent success
[ ] Invalid amount/decimal — 400
[ ] Minima down — 502 on list/create

Security / auth
[ ] Unauthenticated → 401 on all /api/tokens routes
[ ] Non-admin create → 403 (when multi-role available)
[ ] Audit tokens.create — no secrets in Diagnostics

Automated
[ ] npm run test — parseTokenCreateResponse suite passes
[ ] npm run check (typecheck + tests)
[ ] npm --prefix backend run build && npm --prefix frontend run build

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Initial tokens QA gaps from plan vs implementation audit (Phases 1–2 shipped) |
