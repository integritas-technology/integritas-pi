# Custom Token Service Plan

| | |
|---|---|
| **Status** | **Complete** (Phases 1–2 shipped; event listeners deferred) |
| **Done** | Phases 1–2 — create/list API, SQLite `custom_tokens`, Wallet create-token modal |
| **Next** | QA — live `tokencreate` RPC verification on Pi hardware |
| **Deferred** | Token event listeners (automation overlap), unit tests, create-token UI polish |
| **QA follow-up** | _(create `docs/qa/tokens-gaps.md` when Phase 1 ships)_ |

_Custom token lifecycle on the Pi node: create tokens via Minima `tokencreate`, list wallet-held tokens, and (later) rules that react to token payments or transfers._

Companion docs: [docs index](../README.md), [project README](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: [wallet.md](./wallet.md), [minima-node.md](./minima-node.md). QA: [qa/README.md](../qa/README.md).

**External interface:** Minima node RPC over HTTP on port 9005 — path-encoded commands. Token creation uses `tokencreate`; listing uses existing `balance` / `tokens` search commands. Reference: [Minima terminal commands](https://docs.minima.global/docs/development/terminal-commands) (`tokencreate`, `tokens`, `balance`).

---

## Verdict

**Read paths for tokens already exist in the wallet feature** — `GET /api/wallet` and per-account balances on `GET /api/wallet/accounts` parse Minima responses and power send/holdings UI. **Nothing is implemented for the ticket’s `/api/tokens` namespace:** no create route, no token-specific DB table, no event listeners, no create-token UI in the production app (only a mock workbench placeholder).

Phase 1 should add a small `tokens` feature folder that owns creation + a dedicated list API, reusing `runMinimaPathCommand` and wallet parse helpers where sensible. Wallet routes stay unchanged; callers that only need balances keep using `/api/wallet`.

**Naming / scope notes:** Ticket paths use `/api/tokens/*` (not `/api/wallet/tokens/*`). Event listener routes in the ticket (`/api/tokens/events`, `/api/tokens/listeners`) are **deferred** — they overlap the automation engine (BE-007) and need a separate design pass.

---

## Shipped capabilities

_Audit date: 2026-06-16. Only wallet-adjacent token support exists today._

| Area | Status | Implementation |
|---|---|---|
| Node-wide token balances (read) | **Done** (wallet) | `GET /api/wallet` → `balance` RPC → `parseBalanceResponse` |
| Per-account token balances (read) | **Done** (wallet) | `GET /api/wallet/accounts` → `coins relevant:true` → `buildAccountTokenBalances` |
| Send custom tokens | **Done** (wallet) | `POST /api/wallet/send-payment` with `tokenId` |
| Token types + parsing | **Done** (wallet) | `wallet.types.ts`, `wallet.parse.ts` |
| Wallet UI: holdings + send token picker | **Done** (wallet) | `WalletPage.tsx` account funds + send modal |
| `POST /api/tokens/create` | **Done** | `tokens.service.ts` → Minima `tokencreate`; `custom_tokens` SQLite |
| `GET /api/tokens` | **Done** | `tokens.service.ts` → `balance` + SQLite merge |
| SQLite token metadata | **Done** | `custom_tokens` in `database.ts` |
| Token event listeners | **Not started** | Deferred (ticket future) |
| Create-token UI | **Done** | `WalletPage.tsx` create-token modal; `tokensApi.ts` |

### Not shipped / deferred → _(qa/tokens-gaps.md when Phase 1 lands)_

| Item | Notes |
|---|---|
| Event listener CRUD + trigger evaluation | Ticket future; overlaps automation scheduler |
| Unit tests for token parse/create | Ticket future; follow `minima.parse.test.ts` pattern |
| `tokencreate` RPC shape verification on live node | Required before field use — same class of gap as [wallet-gaps.md](../qa/wallet-gaps.md) |
| NFT / rich metadata (images, scripts) | Out of scope V1 — name + amount + decimal only (Q-006) |
| “Mine vs received” token ownership filter | Deferred in wallet plan; not required for this ticket |

---

## Canonical API routes

All routes require `requireAuth`. **Admin-gated mutations:** `POST /api/tokens/create` (creates on-chain value; same risk class as wallet send/import).

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/api/tokens` | List wallet tokens (non-native), enriched with local metadata | **Done** |
| `POST` | `/api/tokens/create` | Create a custom token via Minima `tokencreate` | **Done** |

**Deferred (ticket future):**

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/api/tokens/events` | List token event rules | **Deferred** |
| `POST` | `/api/tokens/listeners` | Create token event listener | **Deferred** |
| `DELETE` | `/api/tokens/listeners/:id` | Remove listener | **Deferred** |

**Related (outside this feature namespace):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/wallet` | Node-wide balance + token list (unchanged) |
| `GET` | `/api/wallet/accounts` | Per-account token holdings (unchanged) |
| `POST` | `/api/wallet/send-payment` | Send MINIMA or custom tokens (unchanged) |
| `GET` | `/api/health` | Backend liveness (public) |

**CLI:** None in V1.

---

## Upstream / integration reference

Commands are path-encoded per `AGENTS.md` (build command string first, then percent-encode into the path).

```txt
# List balances (already used by wallet)
http://minima:9005/balance

# Search / list known tokens (verify response shape on live node)
http://minima:9005/tokens

# Create custom token (verify exact param names via `help command:tokencreate` on node)
http://minima:9005/tokencreate%20name%3AMyToken%20amount%3A1000%20decimal%3A8
```

**Allowlist:**

| Command / operation | Purpose | Exposed via |
|---|---|---|
| `tokencreate name:X amount:Y decimal:Z` | Mint / colour a custom token | `POST /api/tokens/create` |
| `balance` | Token balances for wallet | `GET /api/tokens` (reuse parse path from wallet) |
| `tokens` | Token registry search (if needed for metadata) | Internal in `tokens.service.ts` only |

Do **not** add a generic Minima command proxy. Each capability gets a narrow service function and route.

---

## Target architecture (KISS + separation of concerns)

```txt
Browser
  → /api/tokens/* (routes: HTTP + validation only)
  → tokens.service.ts (orchestration: RPC + DB merge)
  → tokens.parse.ts (tokencreate response → DTO)
  → tokens.repository.ts (SQLite custom_tokens)
  → runMinimaPathCommand (existing minima.rpc.ts)
  → wallet.parse.ts (reuse parseBalanceResponse / parseToken for list — import, do not duplicate)

Wallet feature (unchanged)
  → still owns send, accounts, history
```

**Principles:**

1. **Wallet reads, tokens manages** — wallet keeps send/holdings UX; tokens feature owns create + token catalog API.
2. **Parse once** — reuse `parseToken` / `parseBalanceResponse` from `wallet.parse.ts` for list; only add parsers for `tokencreate` response.
3. **Minima is source of truth for balances** — SQLite stores operator metadata (at minimum `name`) keyed by `token_id`; never invent balances in the DB.
4. **Admin + audit for create** — same pattern as `POST /api/wallet/send-payment`.
5. **No secrets in responses** — return `tokenId`, `name`, amounts; never log seed phrases or RPC passwords.

---

## Current state snapshot

_Refresh when auditing plan vs code. Date: 2026-06-16_

### Backend (`backend/src/features/tokens/`)

| File | Role |
|---|---|
| `tokens.types.ts` | DTOs: create request/result, list item/response |
| `tokens.repository.ts` | SQLite `custom_tokens` CRUD |
| `tokens.parse.ts` | `parseTokenCreateResponse` |
| `tokens.service.ts` | `createCustomToken`, `listWalletTokens` |
| `tokens.routes.ts` | `GET /`, `POST /create` |

**Existing reuse points:**

| File | Role |
|---|---|
| `backend/src/features/wallet/wallet.parse.ts` | `parseBalanceResponse`, `parseToken` — list enrichment |
| `backend/src/features/wallet/wallet.service.ts` | `getWalletStatus()` — optional internal call for list |
| `backend/src/features/minima/minima.rpc.ts` | `runMinimaPathCommand` |
| `backend/src/db/database.ts` | Migrations — add `custom_tokens` here |

### Frontend (`frontend/src/features/tokens/`)

| File | Role |
|---|---|
| `tokensTypes.ts` | Mirror backend DTOs |
| `tokensApi.ts` | `listTokens`, `createToken` |

**UI:** `WalletPage.tsx` — **Create token** hero action + modal.

### Cross-cutting

| Area | Notes |
|---|---|
| `app.ts` | `tokensRouter` registered at `/api/tokens` |
| Schedulers | No token listener poller |
| `mock/MinimaEdgeWorkbench.tsx` | Prior design reference only |

### Git history

| Commit | Summary |
|---|---|
| — | Token service not started on main as of audit date |

### Open gaps

Live `tokencreate` parameter names and response fields must be verified on a running Minima node before locking the DTO (see Open decisions #1).

---

## API shape

**Create request** (`POST /api/tokens/create`):

```ts
type CreateTokenRequest = {
  name: string;    // required, human label (Q-006)
  amount: string;  // required, positive supply string (Q-006)
  decimal: number; // required, non-negative integer (Q-006)
};
```

**Create response:**

```ts
type CreateTokenResult = {
  ok: boolean;
  tokenId: string | null;
  name: string;
  amount: string;
  decimal: number;
  txpowId: string | null;
  message?: string;
};
```

**List response** (`GET /api/tokens`):

```ts
type TokenListItem = {
  tokenId: string;
  name: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  isNative: false;           // native MINIMA excluded from this endpoint
  createdLocally: boolean;   // true when token_id exists in custom_tokens
  decimal?: number;          // from SQLite when we created it
};

type TokenListResponse = {
  checkedAt: string;
  tokens: TokenListItem[];
};
```

**State / enum derivation:**

| Value | When |
|---|---|
| `createdLocally: true` | `token_id` row in `custom_tokens` for this Pi |
| `name` | SQLite `custom_tokens.name` if set, else Minima `balance` token metadata, else `tokenId` fallback (same as wallet) |
| HTTP 400 | Missing/invalid `name`, `amount`, or `decimal` on create |
| HTTP 502 | Minima RPC failure |

---

## Implementation plan

### Phase 1 — Create + list API — **complete**

**Goal:** Smallest backend slice from the ticket checklist — DB name field, create route, list route. No frontend required to mark backend checklist done.

#### Backend

1. Add migration in `database.ts`:

```sql
CREATE TABLE IF NOT EXISTS custom_tokens (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount TEXT NOT NULL,
  decimal INTEGER NOT NULL,
  txpow_id TEXT,
  created_at TEXT NOT NULL
);
```

2. Create `backend/src/features/tokens/`:
   - `tokens.types.ts` — DTOs above
   - `tokens.repository.ts` — insert/list/find by `token_id`
   - `tokens.parse.ts` — `parseTokenCreateResponse(body)` → `{ tokenId, txpowId, ok, message }`
   - `tokens.service.ts`:
     - `createCustomToken({ name, amount, decimal })` — validate, call `runMinimaPathCommand(\`tokencreate name:${name} amount:${amount} decimal:${decimal}\`, timeout)`, persist row on success
     - `listWalletTokens()` — call `balance` (or reuse `getWalletStatus()`), filter out `0x00`, merge SQLite metadata, set `createdLocally`
   - `tokens.routes.ts`:
     - `GET /` → list
     - `POST /create` → `requireRole('admin')`, audit `tokens.create` with `{ tokenId, name, amount, decimal, txpowId }` (no secrets)

3. Register `app.use("/api/tokens", tokensRouter)` in `app.ts` after `requireAuth`.

4. Document `tokencreate` command string in plan/README once verified on live node; adjust parser if response shape differs.

**Files:**

- `backend/src/db/database.ts`
- `backend/src/features/tokens/tokens.{types,repository,parse,service,routes}.ts`
- `backend/src/app.ts`

**Env:** None new.

**Verification:**

```bash
npm run check
npm --prefix backend run build
docker compose config
```

Manual (with Minima node running):

- `POST /api/tokens/create` as admin with `{ name, amount, decimal }` → returns `tokenId`, row in SQLite
- `GET /api/tokens` → includes new token with `createdLocally: true`
- `GET /api/wallet` still works unchanged; new token appears there after balance refresh
- Non-admin create → 403

---

### Phase 2 — Create-token UI — **complete**

**Goal:** Operators can create tokens from the Wallet page without curl. Reuse existing modal/toast patterns.

#### Frontend

1. Add `frontend/src/features/tokens/tokensTypes.ts` + `tokensApi.ts` (`getTokens`, `createToken`).
2. Add **Create token** action on `WalletPage.tsx` (admin-visible; matches mock workbench intent).
3. Modal fields: name, amount, decimal — client validation mirrors backend.
4. On success: toast + refresh wallet accounts / token list.

**Files:**

- `frontend/src/features/tokens/tokensTypes.ts`
- `frontend/src/features/tokens/tokensApi.ts`
- `frontend/src/pages/WalletPage.tsx`

**Verification:**

```bash
npm --prefix frontend run build
```

Manual: create token in UI → appears in account funds and `GET /api/tokens`.

---

### Phase 3 — Event listeners — **deferred**

**Goal:** Rules that react to token payments/transfers (ticket future; overlaps BE-007 automation engine).

| Item | Approach |
|---|---|
| `GET /api/tokens/events` | List rules from new `token_event_listeners` table |
| `POST /api/tokens/listeners` | CRUD row: token filter, trigger type, action hook |
| `DELETE /api/tokens/listeners/:id` | Soft or hard delete |
| Trigger evaluation | New poller or extend automation scheduler — **design with automation feature owner before coding** |

Do not start Phase 3 until automation overlap is agreed (shared scheduler vs dedicated token poller).

---

## Frontend UX target

| UI element | Data source |
|---|---|
| Account funds / send token picker | `GET /api/wallet/accounts` (unchanged) |
| Create token modal (Phase 2) | `POST /api/tokens/create` |
| Post-create refresh | `GET /api/wallet/accounts` or `GET /api/tokens` |
| Token event rules table (future) | `GET /api/tokens/events` |

**Optional polish (deferred):** dedicated Tokens page/nav; link tokenId to history; show `decimal` in holdings table.

---

## Open decisions

| # | Decision | Recommendation / outcome |
|---|---|---|
| 1 | Q-006: exact `tokencreate` RPC params and response fields | **TBD on live node** — ticket specifies `name`, `amount`, `decimal`. Run `help command:tokencreate` on Pi Minima container; adjust `tokens.parse.ts` before merge. Minima release notes mention decimal limit changes — use string amounts in API. |
| 2 | `GET /api/tokens` data source | **Recommend:** `balance` RPC + SQLite merge (reuse `parseBalanceResponse`). Call `tokens` only if balance metadata is insufficient. Exclude native `0x00`. |
| 3 | Why store `name` in SQLite when Minima may persist metadata? | **Recommend:** local record proves Pi-initiated create, survives ambiguous chain names, powers `createdLocally` flag. Minimum field per ticket; store `amount`/`decimal`/`txpow_id` for operator audit. |
| 4 | Route layout: `POST /create` vs `POST /` | **Recommend:** `POST /api/tokens/create` per ticket (explicit; avoids REST ambiguity with list). |
| 5 | Event listeners vs automation | **Defer** — new plan section or extend [automation](../features/automation/) when BE-007 is scoped. |

---

## Verification checklist (phase exit)

**Phase 1:**

- [ ] `custom_tokens` table migrated
- [ ] `POST /api/tokens/create` (admin) creates on-chain token and SQLite row
- [ ] `GET /api/tokens` returns non-native tokens with balances + `createdLocally`
- [ ] Audit event `tokens.create` recorded without secrets
- [ ] Wallet APIs unchanged and still pass smoke checks
- [ ] `npm run check` passes
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `README.md` updated with new routes
- [ ] `SECURITY.md` updated if create exposure needs noting (admin gate, on-chain irreversibility)

**Phase 2:**

- [ ] Create token modal on Wallet page (admin)
- [ ] `npm --prefix frontend run build` passes

---

## Changelog & docs

When shipping each phase:

- Add operator-facing notes to `CHANGELOG.md` (`[Unreleased]`).
- Update `README.md` API section with `/api/tokens` routes.
- Update `SECURITY.md` for admin-gated on-chain mutations.
- Add `docs/qa/tokens-gaps.md` from [templates/qa-gaps.md](../templates/qa-gaps.md) when Phase 1 ships; link from `docs/README.md`.
- Mark plan **Complete** in `docs/README.md` when Phase 2 ships; keep RPC verification in QA gaps.

---

## Ticket checklist (tracking copy)

**Backend**

- [x] Define token creation fields (Q-006): `name`, `amount`, `decimal`
- [x] Define token creation DB field: `name` (+ supporting columns in `custom_tokens`)
- [x] `POST /api/tokens/create`
- [x] `GET /api/tokens` (list tokens for wallet)

**Frontend**

- [x] Create token modal on Wallet page _(Phase 2)_

**Future / QA**

- [ ] `GET /api/tokens/events`
- [ ] `POST /api/tokens/listeners`
- [ ] `DELETE /api/tokens/listeners/:id`
- [ ] Event listener trigger evaluation (BE-007 overlap)
- [ ] Unit tests (`tokens.parse.ts`, repository)
- [ ] Live `tokencreate` RPC verification on Pi hardware
