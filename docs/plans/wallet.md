# Wallet Service Plan

| | |
|---|---|
| **Status** | **Phases 1–3 shipped (uncommitted); export backup deferred** |
| **Done** | Normalized balance API, token filter tabs, dashboard balance card, MinimaIcon, receive address modal, send payment modal with in-page polling, seed phrase import modal |
| **Next** | Merge `wallet-service` branch; scope export backup format before Phase 4 |
| **Deferred** | Export backup (format TBD), MEG create-wallet, node lock, burn amount UX |

_Wallet lifecycle service for the primary Minima wallet: balance, addresses, send, import/export — for operators managing value flows on the Pi._

Companion docs: [docs index](../README.md), [project README](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: [minima-node.md](./minima-node.md). QA: [qa/README.md](../qa/README.md).

**External interface:** Minima node RPC over HTTP on port 9005 — path-encoded commands. All wallet operations are narrow allowlisted calls through the existing `minima.rpc.ts` primitive. Reference: [Minima docs](https://docs.minima.global/).

---

## Verdict

The nav, routing, and a minimal `WalletPage` already exist. The existing `GET /api/minima/balance` returns the raw Minima RPC response; the current page just dumps a JSON preview with the confirmed MINIMA amount. Nothing else is built. This plan adds a dedicated `/api/wallet` namespace on top of the existing `minima.rpc.ts` layer, adds parsing, proper UX, and the remaining lifecycle operations in phases.

**Naming / scope notes:** The ticket uses `/api/wallet/*` placeholder paths — this plan adopts them directly. The existing `/api/minima/balance` route stays as-is (it is a Minima node diagnostic); the new wallet routes live in `backend/src/features/wallet/` and are the primary browser-facing wallet API. The WalletPage migrates from `/api/minima/balance` to `GET /api/wallet`.

---

## Shipped capabilities

_Update during/after implementation. When complete, audit against codebase._

| Area | Status | Implementation |
|---|---|---|
| Wallet nav + routing | **Done** | `nav.ts`, `App.tsx`, `WalletPage.tsx` |
| Raw balance passthrough | **Done** | `GET /api/minima/balance` → `getWalletBalance()` in `minima.service.ts` |
| Minimal balance display | **Done** | Replaced with hero card redesign in Phase 1 |
| Normalized balance API | **Done** | `GET /api/wallet` → `wallet.service.ts` / `wallet.routes.ts` |
| Token filter (All / Minima / Tokens) | **Done** | `WalletPage.tsx` subtabs, `filterTokens()` client-side |
| Dashboard balance card | **Done** | `DashboardPage.tsx` MetricCard with MinimaIcon; non-blocking |
| MinimaIcon component | **Done** | `frontend/src/components/MinimaIcon.tsx` — reusable inline SVG |
| Receive address | **Done** | `POST /api/wallet/receive-address` → `getaddress` RPC; modal with Mx/0x display and clipboard copy |
| Send payment + pending poll | **Done** | `POST /api/wallet/send-payment`; `GET /api/wallet/payment-status/:txpowid`; modal with 5 s poll × 60 s |
| Audit log (wallet mutations) | **Done** | `wallet.address.get`, `wallet.payment.send`, `wallet.import` — phrase never logged |
| Seed phrase import | **Done** | `POST /api/wallet/import` → `restore` RPC; admin-gated, 30 s timeout, modal with warning |
| Encrypted backup export | **Deferred** | Placeholder button in UI; format (file download vs JSON body) to be scoped |

### Not shipped / deferred → [qa-gaps.md](../qa/wallet-gaps.md)

| Item | Notes |
|---|---|
| Export backup format | File download vs JSON body — decide in Phase 3 scope call |
| MEG multi-wallet (`POST /api/wallet/create`) | Deferred to Minima MEG support milestone |
| Node lock (hardware / Google binding) | Future — out of scope V1 |
| Burn amount / fee UX improvements | Deferred — needs clearer Minima fee API |
| Security review (key handling, encryption at rest) | Required before merge — flag in Phase 3 |

---

## Canonical API routes

All routes require `requireAuth`. **Admin-gated mutations:** `POST /api/wallet/send-payment`, `POST /api/wallet/generate-address`, `POST /api/wallet/import`, `POST /api/wallet/export-backup`.

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/api/wallet` | Normalized balance + token list | **Done** |
| `POST` | `/api/wallet/receive-address` | Random address from 64-address pool | **Done** (renamed from `generate-address` — uses `getaddress` not `newaddress`) |
| `POST` | `/api/wallet/send-payment` | Send tokens to an address | **Done** |
| `GET` | `/api/wallet/payment-status/:txpowid` | Poll pending TX status | **Done** |
| `POST` | `/api/wallet/import` | Restore from seed phrase | **Done** |
| `POST` | `/api/wallet/export-backup` | Encrypted wallet backup download | **Deferred** |

**Related (outside this feature namespace):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/minima/balance` | Raw Minima balance RPC response (kept for diagnostics) |
| `GET` | `/api/health` | Backend liveness (public) |

**CLI:** None in V1.

---

## Upstream / integration reference

All wallet operations are narrow allowlisted Minima RPC path commands through the existing `runMinimaPathCommand(command)` helper in `minima.rpc.ts`.

```txt
# Minima RPC — path-encoded commands (verify names against https://docs.minima.global/)
http://minima:9005/balance
http://minima:9005/newaddress
http://minima:9005/send%20amount%3AX%20address%3AY%20tokenid%3A0x00
http://minima:9005/txpow%20txpowid%3A<id>
http://minima:9005/backup%20password%3A<pass>
http://minima:9005/restore%20phrase%3A%22word1%20word2%20...%22
```

**Allowlist (current + planned):**

| Command / operation | Purpose | Exposed via |
|---|---|---|
| `balance` | Token balances for all wallet tokens | `GET /api/wallet` (and existing `/api/minima/balance`) |
| `newaddress` | Generate a new receiving address | `POST /api/wallet/generate-address` |
| `send amount:X address:Y tokenid:Z` | Send tokens | `POST /api/wallet/send-payment` |
| `txpow txpowid:<id>` | Look up TX status for pending confirmation | `GET /api/wallet/payment-status/:txpowid` |
| `backup password:<pass>` | Export encrypted wallet backup | `POST /api/wallet/export-backup` |
| `restore phrase:"…"` | Import wallet from seed phrase | `POST /api/wallet/import` |

Do **not** add a generic command proxy. Each operation stays a narrow named function (per `AGENTS.md` and `SECURITY.md`).

> **Verify before Phase 2:** Confirm exact command syntax against [Minima docs](https://docs.minima.global/) — particularly `send` field names, `txpow` status shape, and `backup`/`restore` command signatures — before writing the Phase 2/3 service functions.

---

## Target architecture (KISS + separation of concerns)

```txt
Browser
  → /api/wallet/* (wallet.routes.ts: HTTP only)
  → wallet.service.ts (orchestration — one function per allowlisted operation)
  → minima.rpc.ts (existing — runMinimaPathCommand; do NOT duplicate)
  → wallet.parse.ts (Minima raw RPC JSON → typed wallet DTOs)
  → audit_events (recordAuditEvent for mutations)
```

**Principles:**

1. **Reuse `minima.rpc.ts`** — `wallet.service.ts` imports `runMinimaPathCommand` directly; no second HTTP client.
2. **Parse once** — `wallet.parse.ts` owns all balance/address/send/status shape normalization; routes never inspect raw RPC bodies.
3. **Fail safe** — RPC errors return `{ ok: false, error }` never secrets; seed phrases never appear in responses or logs.
4. **Admin gate all mutations** — `requireRole('admin')` on generate-address, send, import, export.
5. **Audit all mutations** — `recordAuditEvent` on every state-changing wallet action.

---

## Current state snapshot

_Date: 2026-06-15_

### Backend (`backend/src/features/`)

| File | Role |
|---|---|
| `minima/minima.service.ts` | `getWalletBalance()` — raw balance passthrough |
| `minima/minima.routes.ts` | `GET /api/minima/balance` — raw balance route |
| `minima/minima.rpc.ts` | `runMinimaPathCommand` — the HTTP RPC primitive wallet will reuse |

No `wallet/` folder exists yet.

### Frontend (`frontend/src/pages/`)

| File | Role |
|---|---|
| `WalletPage.tsx` | Current page — fetches `/api/minima/balance`, shows raw confirmed MINIMA + JSON debug |

No `features/wallet/` folder exists yet. WalletPage uses `fetch` directly (not via `lib/api.ts`).

### Cross-cutting

- `app/types.ts` — `MinimaCommandResult` type used by WalletPage
- `app/nav.ts` — wallet nav item exists
- `App.tsx` — `WalletPage` routed to `wallet` nav id
- `features/auth/audit.service.ts` — `recordAuditEvent` available for mutations
- `features/auth/auth.middleware.ts` — `requireAuth`, `requireRole('admin')` available

### Git history

| Commit | Summary |
|---|---|
| `59ef47a` | 0.5.0 (last release; wallet branch `wallet-service` branched from main) |

### Open gaps → [qa-gaps.md](../qa/wallet-gaps.md)

---

## API shape

**`GET /api/wallet` — primary wallet DTO:**

```ts
type WalletStatus = {
  checkedAt: string;
  tokens: TokenBalance[];
};

type TokenBalance = {
  tokenId: string;       // "0x00" for native MINIMA
  name: string;          // "Minima" for native; token name or tokenId for others
  confirmed: string;     // confirmed spendable amount
  unconfirmed: string;   // pending inbound
  sendable: string;      // sendable now
  isNative: boolean;     // tokenId === "0x00"
};
```

Token filter is a **frontend concern** — the backend returns the full list; the frontend filters by `isNative` (All / Minima / Tokens tab). The ticket's "My own / Others / All" distinction requires additional Minima RPC investigation; Phase 1 ships the simpler All / Minima / Tokens split and revisits semantics in Q&A.

**`POST /api/wallet/generate-address` response:**

```ts
type GeneratedAddress = {
  address: string;
  publicKey?: string;
};
```

**`POST /api/wallet/send-payment` request / response:**

```ts
// Request body
type SendPaymentRequest = {
  address: string;
  amount: string;
  tokenId?: string;  // defaults to "0x00" (native MINIMA)
};

// Response
type SendPaymentResult = {
  ok: boolean;
  txpowId: string | null;    // pending TX id for polling
  status: "pending" | "sent" | "failed";
  message?: string;
};
```

**`GET /api/wallet/payment-status/:txpowid` response:**

```ts
type PaymentStatus = {
  txpowId: string;
  status: "pending" | "confirmed" | "failed" | "unknown";
  checkedAt: string;
};
```

**State / status derivation:**

| Value | When |
|---|---|
| `pending` | TX submitted but not in a confirmed block |
| `confirmed` | Minima RPC indicates TX is in chain |
| `failed` | RPC returned error on send; or TX explicitly rejected |
| `unknown` | `txpow` lookup returned nothing yet |

---

## Implementation plan

### Phase 1 — Normalized balance + token filter + dashboard card — **Done**

**Goal:** Replace the raw JSON dump on WalletPage with a proper balance DTO, token list with filter tabs, and add a wallet balance card to the Dashboard. No new RPC commands — this only wraps the existing `balance` command better.

#### Backend

1. Create `backend/src/features/wallet/wallet.parse.ts` — `parseBalanceResponse(body)` → `WalletStatus`. Extract `response` array, map each token to `TokenBalance` DTO, derive `isNative` from `tokenId === "0x00"`.
2. Create `backend/src/features/wallet/wallet.service.ts` — `getWalletStatus()` calls `runMinimaPathCommand("balance")` then `parseBalanceResponse`. Return `WalletStatus`.
3. Create `backend/src/features/wallet/wallet.routes.ts` — `GET /` returns `getWalletStatus()`. HTTP 200 always (wallet might be empty, not an error). 502 on transport failure.
4. Register `walletRouter` in `backend/src/app.ts` under `/api/wallet`.
5. Create `backend/src/features/wallet/wallet.types.ts` — `WalletStatus`, `TokenBalance` types.

**Files:** `wallet/wallet.parse.ts`, `wallet/wallet.service.ts`, `wallet/wallet.routes.ts`, `wallet/wallet.types.ts`, `app.ts`

**Env:** None.

#### Frontend

1. Create `frontend/src/features/wallet/walletApi.ts` — `getWalletStatus()` using `getJson` from `lib/api.ts`.
2. Create `frontend/src/features/wallet/walletTypes.ts` — mirror `WalletStatus` and `TokenBalance`.
3. Update `WalletPage.tsx`:
   - Fetch from `GET /api/wallet` via `walletApi.ts` (not direct `fetch`).
   - Replace JSON dump with balance card (dark card like the mock: balance value + current address).
   - Add token filter tabs: **All** / **Minima** / **Tokens** (filter by `isNative`).
   - Show token list table: name, confirmed, unconfirmed, sendable.
4. Add wallet balance card to `DashboardPage.tsx` — shows native MINIMA confirmed balance + MetricCard style (icon Wallet, label "Wallet balance", helper "Primary Pi wallet"). Reuse `getWalletStatus()`. Keep it non-blocking: if wallet fetch fails, card shows "unavailable" — never breaks the dashboard.

**Files:** `frontend/src/features/wallet/walletApi.ts`, `frontend/src/features/wallet/walletTypes.ts`, `frontend/src/pages/WalletPage.tsx`, `frontend/src/pages/DashboardPage.tsx`

**Verification:**

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Manual:
- `GET /api/wallet` returns `{ checkedAt, tokens: [...] }` with `isNative` set correctly on each token.
- WalletPage shows balance card + token list; filter tabs switch between All/Minima/Tokens.
- Dashboard shows wallet balance card; if Minima node is down, card shows "unavailable" without breaking other cards.
- `/api/minima/balance` still works (existing route untouched).

---

### Phase 2 — Address generation + Send payment + Audit log — **Done**

**Goal:** Operators can generate a new receiving address and send MINIMA/tokens from the UI. All mutations are admin-gated and audit-logged. Payment confirmation is polled in-page after send.

> **Before starting Phase 2:** Verify Minima RPC command syntax from [Minima docs](https://docs.minima.global/): exact field names for `newaddress`, `send`, and `txpow`. Update `wallet.parse.ts` and `wallet.service.ts` accordingly.

#### Backend

1. Add `generateAddress()` to `wallet.service.ts` — calls `runMinimaPathCommand("newaddress")` → parse with `parseAddressResponse()`.
2. Add `parseAddressResponse(body)` to `wallet.parse.ts` → `GeneratedAddress`.
3. Add `POST /generate-address` to `wallet.routes.ts` — `requireRole('admin')`, calls `generateAddress()`, records `wallet.address.generate` audit event.
4. Add `sendPayment({ address, amount, tokenId })` to `wallet.service.ts` — validates inputs, builds `send amount:X address:Y tokenid:Z` command, calls `runMinimaPathCommand` with a longer timeout (10s). Parse result with `parseSendResponse()`.
5. Add `parseSendResponse(body)` to `wallet.parse.ts` → `SendPaymentResult` (extracts txpow id, derives pending/sent/failed).
6. Add `POST /send-payment` to `wallet.routes.ts` — `requireRole('admin')`, validates `address` (non-empty), `amount` (positive number string), records `wallet.payment.send` audit event (log `{ address, amount, tokenId, txpowId }` — never log seed phrases or secrets).
7. Add `getPaymentStatus(txpowid)` to `wallet.service.ts` — calls `runMinimaPathCommand(`txpow txpowid:${txpowid}`)` → parse with `parsePaymentStatusResponse()`.
8. Add `parsePaymentStatusResponse(body)` to `wallet.parse.ts` → `PaymentStatus`.
9. Add `GET /payment-status/:txpowid` to `wallet.routes.ts` — no admin gate (read-only); `requireAuth` from global middleware is enough.

**Files:** `wallet.service.ts`, `wallet.parse.ts`, `wallet.routes.ts`, `wallet.types.ts`

**Env:** None.

#### Frontend

1. Add `generateAddress()`, `sendPayment()`, `getPaymentStatus()` to `walletApi.ts`.
2. Add types to `walletTypes.ts`.
3. Add **Generate address** action button on WalletPage → calls `POST /api/wallet/generate-address` → shows new address in a modal/card. Copies to clipboard.
4. Add **Send payment** action button on WalletPage → modal with `address`, `amount`, optional `tokenId` selector (dropdown from token list). On submit: calls `POST /api/wallet/send-payment`. On `status: "pending"`: show pending state + poll `GET /api/wallet/payment-status/:txpowid` every 5s up to 60s. On confirm/fail: show toast.
5. Use `useToast` for transient send errors; inline validation on the send form (empty address, non-numeric amount).

**Verification:**

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Manual:
- `POST /api/wallet/generate-address` (with admin session) returns address; audit event appears in diagnostics log.
- `POST /api/wallet/send-payment` with valid inputs returns `txpowId`; audit event recorded.
- `GET /api/wallet/payment-status/:id` polls correctly.
- Unauthenticated request to send-payment → 401; non-admin → 403.
- Send with missing/invalid inputs → 400 with useful error.

---

### Phase 3 — Import (seed phrase) — **Done**

| Item | Approach |
|---|---|
| `POST /api/wallet/import` | `requireRole('admin')`, accepts `{ phrase: string }`, calls `runMinimaPathCommand` with restore command; audit event `wallet.import`; **seed phrase must never appear in audit log detail or response body** |
| Export backup | **Deferred** — format (file download vs JSON body) to be scoped separately |
| Security review | Required before merging Phase 3 — key handling, encryption at rest, seed phrase in memory/logs |

**Files:** `wallet.service.ts`, `wallet.parse.ts`, `wallet.routes.ts`

> **Security note:** The seed phrase travels in the request body over the existing HTTP-only LAN connection. Document in `SECURITY.md`. Enforce HTTPS before field deployment. Never log `phrase` in request logging or audit detail.

---

## Frontend UX target

| UI element | Data source |
|---|---|
| Balance card (dark, primary) | `GET /api/wallet` → `tokens[isNative].confirmed` |
| Current address display | Inline in balance card — fetch on page load or generate-address result |
| Token filter tabs (All / Minima / Tokens) | `tokens[]` list filtered by `isNative` client-side |
| Token list table | `tokens[]` — name, confirmed, unconfirmed, sendable |
| Generate address button + result | `POST /api/wallet/generate-address` |
| Send payment modal | `POST /api/wallet/send-payment` → pending + poll |
| Wallet balance on Dashboard | `GET /api/wallet` → native token confirmed balance, MetricCard style |

**Optional polish (deferred):** "My own / Others" token ownership filter; transaction history list; burn fee display; clipboard copy address button.

---

## Open decisions

| # | Decision | Recommendation / outcome |
|---|---|---|
| 1 | Token filter semantics: "Mine / Others / All" | Phase 1 ships **All / Minima / Tokens** (native vs custom). True "mine vs received" ownership requires Minima RPC investigation — defer to Phase 2 scope. |
| 2 | Export backup format | **Deferred** — file download preferred but needs Minima backup file path / streaming design; scope before Phase 3. |
| 3 | Payment confirmation timeout | Poll `GET /payment-status` every 5s for up to 60s (12 polls), then show "still pending — check back" state. Avoid blocking the UI. |
| 4 | Seed phrase in-transit risk | **Document in SECURITY.md before Phase 3 merge.** Seed phrase sent as JSON body over HTTP (LAN only). Flag for HTTPS-before-field-deployment requirement. |
| 5 | Minima RPC command names | Verify against [Minima docs](https://docs.minima.global/) before Phase 2 starts. Treat current names (`newaddress`, `send`, `txpow`, `backup`, `restore`) as provisional. |
| 6 | New address vs current address for balance card | Minima `balance` response does not include the wallet address. Phase 1 can omit address from balance card; Phase 2 `generate-address` can surface it. |

---

## Verification checklist (per phase)

**Phase 1:**
- [x] `GET /api/wallet` returns `{ checkedAt, tokens }` with correct `isNative` flag
- [x] WalletPage uses `walletApi.ts` + shows balance card + token list + filter tabs
- [x] Dashboard shows wallet balance card; gracefully handles node-down state
- [x] `CHANGELOG.md` updated under `[Unreleased]`

**Phase 2:**
- [x] `POST /api/wallet/receive-address` (renamed from `generate-address`) — admin only, audit logged
- [x] `POST /api/wallet/send-payment` — admin only, audit logged, phrase never in log
- [x] `GET /api/wallet/payment-status/:txpowid` — any auth, polls correctly
- [x] Frontend: send modal with pending state + in-page poll + toast on confirm/fail
- [x] Correction: `getaddress` (not `newaddress`) — returns from 64-address pool; Mx format primary

**Phase 3:**
- [x] `POST /api/wallet/import` — admin only, seed phrase never in audit log or response
- [x] `SECURITY.md` updated (seed phrase in-transit risk, Megammr resync interaction note, HTTPS requirement)
- [ ] Security review completed before merge (open — required before field deployment)

---

## Changelog & docs

When shipping each phase:

- Add operator-facing notes to `CHANGELOG.md` (`[Unreleased]`).
- Update `README.md` if wallet API or install behavior changes.
- Update `SECURITY.md` for Phase 3 (seed phrase handling, new exposure).
- Mark plan **Complete** in `docs/README.md` when all phases ship; move hardening to `docs/qa/wallet-gaps.md`.

---

## Ticket checklist (tracking copy)

**Backend**

- [x] Define key storage and encryption strategy (Q-004 — Minima owns key storage; no Pi-side key material)
- [x] `GET /api/wallet` (normalized balance + token list)
- [x] `POST /api/wallet/receive-address` (renamed; uses `getaddress` RPC, not `newaddress`)
- [x] `POST /api/wallet/send-payment`
- [x] Payment pending poll (`GET /api/wallet/payment-status/:txpowid`)
- [x] `POST /api/wallet/import` (seed phrase)
- [ ] `POST /api/wallet/export-backup` (deferred — format TBD)
- [x] Audit log for all wallet mutations
- [x] Token filter (All / Minima / Tokens)

**Frontend**

- [x] WalletPage: balance card + token list + filter tabs
- [x] WalletPage: receive address modal (Mx primary, clipboard copy, 64-pool re-sample)
- [x] WalletPage: send payment modal + pending poll
- [x] WalletPage: import wallet modal (seed phrase, destructive warning)
- [x] WalletPage: disabled Export wallet button (placeholder)
- [x] Dashboard: wallet balance card with MinimaIcon

**Future / QA**

- [ ] Export backup format — scope separately (file download vs JSON body)
- [ ] "Mine / Others" ownership filter — Minima RPC investigation
- [ ] Security review before field deployment (seed phrase, HTTPS requirement)
- [ ] MEG create-wallet (`POST /api/wallet/create`) — Minima MEG milestone
- [ ] Node lock to hardware — future
- [ ] Burn amount / fee UX — future
