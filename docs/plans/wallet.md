# Wallet Service Plan

| | |
|---|---|
| **Status** | **Complete** (Phases 1–3 shipped; export backup and live RPC verification deferred to QA) |
| **Done** | Phases 1–3 — normalized balance API, token filter tabs, dashboard card, MinimaIcon, receive address modal, send payment modal with in-page poll, seed phrase import modal |
| **Next** | QA — live Minima RPC shape verification, HTTPS before seed phrase import in field; scope export backup format |
| **Deferred** | Export backup (format TBD), MEG create-wallet, node lock, burn amount UX |
| **QA follow-up** | [wallet-gaps.md](../qa/wallet-gaps.md) |

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

All routes require `requireAuth`. **Admin-gated mutations:** `POST /api/wallet/receive-address`, `POST /api/wallet/send-payment`, `POST /api/wallet/import`, `POST /api/wallet/export-backup` (deferred).

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
| `getaddress` | Return one of 64 pre-created addresses at random | `POST /api/wallet/receive-address` (note: `newaddress` creates new key material — not used) |
| `send amount:X address:Y tokenid:Z` | Send tokens | `POST /api/wallet/send-payment` |
| `txpow txpowid:<id>` | Look up TX status for pending confirmation | `GET /api/wallet/payment-status/:txpowid` |
| `restore phrase:"…"` | Import wallet from seed phrase | `POST /api/wallet/import` |
| `backup password:<pass>` | Export encrypted wallet backup | `POST /api/wallet/export-backup` (**Deferred**) |

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

## Implementation snapshot

_Branched from `main` at `59ef47a` (0.5.0). Implemented on branch `wallet-service`._

### Backend (`backend/src/features/wallet/`)

| File | Role |
|---|---|
| `wallet.types.ts` | `TokenBalance`, `WalletStatus`, `ReceiveAddress`, `SendPaymentRequest`, `SendPaymentResult`, `PaymentStatus`, `ImportWalletResult` |
| `wallet.parse.ts` | `parseBalanceResponse`, `parseAddressResponse`, `parseSendResponse`, `parsePaymentStatusResponse`, `parseImportResponse` |
| `wallet.service.ts` | `getWalletStatus`, `getReceiveAddress`, `sendPayment`, `getPaymentStatus`, `importWallet` |
| `wallet.routes.ts` | All `/api/wallet/*` routes; registered in `app.ts` under `/api/wallet` |

### Frontend

| File | Role |
|---|---|
| `frontend/src/features/wallet/walletTypes.ts` | Mirror of backend types |
| `frontend/src/features/wallet/walletApi.ts` | `getWalletStatus`, `getReceiveAddress`, `sendPayment`, `getPaymentStatus`, `importWallet` |
| `frontend/src/pages/WalletPage.tsx` | Hero balance card, token table, `ReceiveAddressModal`, `SendPaymentModal`, `ImportWalletModal`, disabled Export button |
| `frontend/src/components/MinimaIcon.tsx` | Reusable inline SVG icon (`currentColor`) |
| `frontend/src/pages/DashboardPage.tsx` | Non-blocking wallet balance MetricCard with MinimaIcon |

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

**`POST /api/wallet/receive-address` response:**

```ts
type ReceiveAddress = {
  miniAddress: string;  // Mx… — Minima native format; primary for display/sharing
  address: string;      // 0x… — hex format
  publicKey?: string;
};
```

**`POST /api/wallet/import` request / response:**

```ts
// Request body
{ phrase: string }  // 24-word BIP-39 seed phrase; minimum 12 words validated server-side

// Response
type ImportWalletResult = {
  ok: boolean;
  message: string;
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

> **Correction applied during implementation:** `getaddress` RPC (returns from 64-address pool) was used instead of `newaddress` (creates new key material). Route renamed from `/generate-address` to `/receive-address`. Type renamed from `GeneratedAddress` to `ReceiveAddress`; `miniAddress` (Mx format) added as primary field.

#### Backend (as shipped)

- `getReceiveAddress()` in `wallet.service.ts` — calls `runMinimaPathCommand("getaddress")`; parses `miniaddress` (Mx, primary) and `address` (0x).
- `POST /receive-address` — `requireRole('admin')`, records `wallet.address.get` audit event.
- `sendPayment()` — builds `send amount:X address:Y tokenid:Z`, 10 s timeout; parses txpowId from response.
- `POST /send-payment` — `requireRole('admin')`, validates address (non-empty) and amount (positive finite number); records `wallet.payment.send` with `{ address, amount, tokenId, txpowId }`.
- `getPaymentStatus()` — `txpow txpowid:<id>`; derives `confirmed` from `response.confirmed === true || txpow.isblock === true`.
- `GET /payment-status/:txpowid` — `requireAuth` only (read-only).

#### Frontend (as shipped)

- **Receive address** button → `ReceiveAddressModal`: fetches on mount, shows Mx (dark code block, green), 0x (light bg), publicKey; Copy copies `miniAddress`; "Get another address" re-fetches.
- **Send payment** button → `SendPaymentModal`: address/amount/token form; on submit polls every 5 s × 12; shows confirmed/failed/timeout inline; close mid-poll fires info toast.

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

| UI element | Data source | Status |
|---|---|---|
| Balance card (dark hero card) | `GET /api/wallet` → `tokens[isNative].confirmed` | Done |
| Token filter tabs (All / Minima / Tokens) | `tokens[]` filtered client-side by `isNative` | Done |
| Token list table | `tokens[]` — name, confirmed, unconfirmed, sendable | Done |
| Receive address modal | `POST /api/wallet/receive-address` → Mx (primary) + 0x display, clipboard copy, re-sample | Done |
| Send payment modal | `POST /api/wallet/send-payment` → 5 s poll × 60 s, inline state, toast | Done |
| Import wallet modal | `POST /api/wallet/import` — destructive warning, seed phrase textarea, success state | Done |
| Export wallet button | Disabled placeholder — `POST /api/wallet/export-backup` deferred | Placeholder |
| Wallet balance on Dashboard | `GET /api/wallet` → native confirmed, MetricCard + MinimaIcon; non-blocking | Done |

**Optional polish (deferred):** "My own / Others" token ownership filter; transaction history list; burn fee display.

---

## Open decisions

| # | Decision | Recommendation / outcome |
|---|---|---|
| 1 | Token filter semantics: "Mine / Others / All" | **Shipped:** All / Minima / Tokens (native vs custom token). True "mine vs received" ownership deferred — requires Minima RPC investigation. |
| 2 | Export backup format | **Deferred** — placeholder button in UI. File download vs JSON body to be scoped separately. `backup password:<pass>` RPC is the candidate. |
| 3 | Payment confirmation timeout | **Shipped:** 5 s poll × 12 = 60 s max, then "still pending" state with TX ID shown. |
| 4 | Seed phrase in-transit risk | **Documented in SECURITY.md** — HTTP-only LAN risk noted; HTTPS required before field deployment. Megammr resync interaction also noted. |
| 5 | Minima RPC command names | **Resolved** — `getaddress` (not `newaddress`) confirmed for receive-address; `send`, `txpow`, `restore` used as shipped. `backup` deferred. |
| 6 | Address in balance card | **Resolved** — balance card omits address (not in `balance` RPC response); address fetched on demand via receive-address modal. |

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
