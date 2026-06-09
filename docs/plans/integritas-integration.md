# Integritas Integration Plan

Backend Integritas proof API integration, proof lifecycle automation, and related frontend polish for `integritas-pi`.

Companion docs: [README.md](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: [auth-implementation.md](../auth-implementation.md).

---

## Verdict

The **core Integritas backend integration is largely done**. Stamping, hashing, status polling, verification, API key management, SQLite history, automation stamping, and manual UI flows all exist under `backend/src/features/integritas/` with a matching frontend feature folder.

What remains is **operational hardening** (automated proof polling, retry policy, upstream error taxonomy), **test coverage** (sandbox integration tests), and **small UX improvements** (shared config components, on-chain status messaging, portal link). Future ticket items (usage limits, OAuth connector) should stay out of this phase.

**API naming:** The ticket used placeholder route names with no fixed schema. **This plan uses the routes already in the repo** as the canonical API. All new work extends those endpoints and services in place — no renames, no compatibility aliases.

---

## Capability checklist (mapped to current routes)

The ticket checklist is treated as a **capability list**, not a route spec. Status below references the real paths under `/api/integritas/*`.

### Backend — done or partial

| Capability | Status | Route(s) / location |
|---|---|---|
| Integritas external API reviewed | **Done** | Upstream: `POST /v1/timestamp/post`, `POST /v1/timestamp/status`, `POST /v1/verify/post-lite-pdf`, `GET /v1/web/check/health` in `integritas.service.ts` and `status.routes.ts`. |
| API key save + validate | **Done** | `POST /api/integritas/api-key`, `DELETE /api/integritas/api-key` (admin); setup: `POST /api/setup/integritas/verify`. Validation via `validateIntegritasApiKey()` (test stamp). |
| Hash content | **Done** | `POST /api/integritas/hash` |
| Submit stamp (hash → proof UID) | **Done** | `POST /api/integritas/stamp` |
| Stamp local file (hash + submit + history row) | **Done** | `POST /api/integritas/stamp-file` |
| List proofs with status | **Done** | `GET /api/integritas/history` → `integritas_proofs.proof_status` |
| Poll proof status (single record) | **Done** | `POST /api/integritas/history/:id/poll` |
| Poll proof status (bulk UIDs) | **Done** | `POST /api/integritas/status` |
| Verify proof | **Done** | `POST /api/integritas/verify`, `POST /api/integritas/history/:id/verify`, `POST /api/integritas/verify-proof-file` |
| Runtime config + upstream health | **Done** | `GET /api/integritas/config` (local config, key presence); `GET /api/status/overview` (Integritas health probe when key exists) |
| History maintenance | **Done** | `POST /api/integritas/history/delete-selected`, `POST /api/integritas/history/export-selected` |
| Error handling (rate limits, unavailability, proof failure) | **Partial** | Upstream HTTP status forwarded; poll exceptions → `502`; terminal errors → `proof_status: failed`. **Missing:** explicit `429` handling, fetch timeouts on Integritas calls, structured `errorCode`, retry-after respect. |

**Summary:** Core stamping and history flows are complete on the current routes. Gaps are reliability (timeouts, retries, auto-poll) and operator-facing error detail — not missing endpoints.

### Backend — remaining

| Ticket item | Makes sense? | Notes |
|---|---|---|
| Retry logic for failed stamps | **Yes** | Automation currently fails the whole workflow on a single stamp error (`automation.service.ts`). Pending proofs never auto-resolve without manual poll in Diagnostics. |
| Automate proof status fetching | **Yes** | `proof_status: pending` rows accumulate (manual stamps + automation). A backend scheduler is the right place; mirrors existing `startAutomationScheduler()` in `index.ts`. |
| Integration tests against Integritas sandbox | **Yes** | No tests exist today (`npm run check` is typecheck + audit only). Sandbox tests behind an env flag keep CI green without secrets. |

### Frontend — remaining

| Ticket item | Makes sense? | Notes |
|---|---|---|
| Reusable settings/config components | **Yes, small scope** | `IntegritasRuntimeConfig` and `MinimaRuntimeConfig` duplicate layout (`config-card`, runtime fields, save row). Extract a thin primitive; keep feature-specific fields in feature folders. |
| Use UID to check hash has arrived on-chain message | **Yes** | `pollProofStatus` already maps `onchain` → proof payload (`proofPayloadFromStatusItem`). UI only shows raw `proof_status`; operators need a clear “pending on-chain / ready / failed” message tied to UID. |
| Redirect to cloud Portal for usage monitoring | **Yes, defer details** | No usage API in codebase. A configurable external link (`INTEGRITAS_PORTAL_URL`) from Integritas config UI is enough for V1; do not build usage dashboards locally. |

### Future — defer

| Capability | Recommendation |
|---|---|
| Separate file-upload attestation API | **Already covered** by `POST /api/integritas/stamp-file`. Revisit only if Integritas upstream adds a distinct upload contract. |
| Display API usage and usage limits | **Defer** until Integritas exposes a stable usage endpoint for Pi operators. |
| Integritas as connector (not API key) | **Defer** — architectural change; out of scope for this plan. |

---

## Canonical API routes

All implementation in this plan builds on these existing paths (registered in `integritas.routes.ts`, mounted at `/api/integritas` in `app.ts`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/config` | Runtime config: `baseUrl`, `requestId`, `hasApiKey`, `apiKeySource` |
| `POST` | `/api-key` | Save and validate API key (admin) |
| `DELETE` | `/api-key` | Clear stored key (admin) |
| `POST` | `/hash` | SHA3-256 hash of canonical bytes |
| `POST` | `/stamp` | Submit hash → proof UID |
| `POST` | `/stamp-file` | Hash file, stamp, create history row |
| `GET` | `/history` | List proof records |
| `POST` | `/history/delete-selected` | Delete selected records |
| `POST` | `/history/export-selected` | Export proof payloads JSON |
| `POST` | `/history/:id/poll` | Poll upstream status for one record |
| `POST` | `/history/:id/verify` | Verify stored proof payload |
| `POST` | `/status` | Bulk poll by UID list |
| `POST` | `/verify` | Verify canonical bytes + proof payload |
| `POST` | `/verify-proof-file` | Verify uploaded proof JSON file |

**Related (not under `/api/integritas`):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/status/overview` | Service health including Integritas upstream probe |
| `POST` | `/api/setup/integritas/verify` | Validate API key during first-run setup |

**CLI:** `integritas-pi integritas history` → `GET /api/integritas/history`.

**New routes:** Only add a route if a capability cannot be expressed through the table above. The background proof poller is a **scheduler**, not a new HTTP endpoint — it reuses `pollProofStatus` + `updateProofStatus` like `POST /history/:id/poll`.

---

## Target architecture (KISS + separation of concerns)

```txt
Browser / CLI
  → /api/integritas/* (routes: HTTP only)
  → integritas.service.ts (Integritas HTTP client + hash helpers)
  → integritas.repository.ts (SQLite integritas_proofs)
  → settings/secrets.service.ts (API key only)

Schedulers (index.ts startup)
  → automation.service.ts (data fetch + optional stamp)
  → integritas-poll.scheduler.ts (NEW: pending proof status only)

Automation must NOT embed poll logic.
Integritas service must NOT know about Express req/res.
Frontend must NOT call integritas.technology directly.
```

**Principles for this work:**

1. **One Integritas client** — all upstream fetch, timeout, retry, and error normalization live in `integritas.service.ts`.
2. **Schedulers are thin** — query DB → call service → update DB; no business rules in `index.ts`.
3. **Idempotent status updates** — polling `ready` or `failed` rows is a no-op.
4. **No new abstractions** — no generic “connector framework”, no job queue library, no frontend state manager.
5. **Fail safe** — missing API key skips poll scheduler; sandbox tests skip without env.

---

## Current state snapshot

### Backend (`backend/src/features/integritas/`)

- **Routes:** see [Canonical API routes](#canonical-api-routes) above.
- **Service:** `requestProofUid`, `pollProofStatus`, `verifyProof`, `proofPayloadFromStatusItem`, file hashing.
- **Persistence:** `integritas_proofs` with `proof_status` (`pending` | `ready` | `failed`).
- **Automation:** creates pending proof records; does not poll them.
- **Auth:** all routes behind `requireAuth`; api-key mutations require `admin`.

### Frontend (`frontend/src/features/integritas/`)

- **Integritas page:** stamp file, verify proof file, configure API key modal.
- **Diagnostics page:** proof history table with manual poll/verify/export/delete.
- **Dashboard:** activity feed from proof history.
- **Setup wizard:** optional Integritas API key step.

### Gaps

1. No background proof polling.
2. No retry on transient upstream or stamp failures.
3. Integritas `fetch` calls lack timeout (status overview uses `fetchJsonWithTimeout`).
4. No integration tests.
5. Duplicated runtime config UI between Minima and Integritas.
6. No operator-facing on-chain status copy or portal link.

---

## Implementation plan

### Phase 1 — Harden Integritas HTTP client (backend)

**Goal:** Centralize upstream reliability before adding schedulers or retries that depend on it.

**Changes in `integritas.service.ts`:**

1. Add `integritasFetch(path, options)` wrapper:
   - Uses `fetchJsonWithTimeout` pattern (default 15s).
   - Normalizes errors into `{ ok: false, status, error, errorCode?, responseBody }`.
   - `errorCode` enum (minimal): `upstream_unavailable`, `rate_limited`, `unauthorized`, `stamp_failed`, `status_failed`, `verify_failed`.

2. **Rate limits:** if `status === 429`, set `errorCode: rate_limited`; surface `Retry-After` header in response body metadata when present.

3. **Transient retry (HTTP layer only):** retry up to 2 times with backoff (1s, 3s) for `429`, `502`, `503`, and network/abort errors. Do not retry `401`/`403`/`400`.

4. Refactor `requestProofUid`, `pollProofStatus`, `verifyProof` to use the wrapper.

**Files:** `integritas.service.ts`, `integritas.types.ts`, optionally `shared/http.ts` if a shared timeout fetch helper fits without over-abstracting.

**Verification:** manual stamp + poll against real/sandbox API; confirm 401 still returns immediately.

---

### Phase 2 — Automate proof status fetching (backend)

**Goal:** Pending proofs become `ready` or `failed` without manual Diagnostics polling.

**New:** `backend/src/features/integritas/integritas-poll.service.ts`

```txt
startIntegritasProofPoller()
  every 30s (env: INTEGRITAS_POLL_INTERVAL_SECONDS, default 30)
  if no API key → skip
  list proof records where proof_status = 'pending' AND proof_uid IS NOT NULL
  batch uids (max 50 per Integritas status call)
  pollProofStatus → updateProofStatus per record
  log errors; do not crash scheduler
```

**Repository additions** (`integritas.repository.ts`):

- `listPendingProofRecords(limit?: number)`
- Optional: `listPendingProofUids()` if batching stays in service.

**Startup:** call `startIntegritasProofPoller()` from `backend/src/index.ts` after migrations (same pattern as automation).

**SOC:** poll service imports repository + integritas.service only; routes stay manual-trigger wrappers around the same `pollProofStatus` + `updateProofStatus` path used by the scheduler (extract `refreshProofRecord(id)` in service to avoid duplication).

**Files:** `integritas-poll.service.ts`, `integritas.repository.ts`, `integritas.service.ts` (shared refresh helper), `index.ts`, `env.ts`, `.env.example`.

**Verification:** stamp file → wait → record becomes `ready` without clicking Poll in UI.

---

### Phase 3 — Retry logic for failed stamps and polls (backend)

**Goal:** Distinguish **transient** failures (retry) from **terminal** failures (mark failed, stop).

Two failure modes to handle:

| Mode | Where | Retry strategy |
|---|---|---|
| **Stamp failed** (no UID) | `POST /stamp`, `POST /stamp-file`, automation | Automation: bounded re-stamp on next workflow run if `last_error` was transient. Manual routes: return error to client (HTTP retry already in Phase 1). |
| **Poll failed or still pending** | `POST /history/:id/poll`, background poller | Poller keeps trying until `onchain` or explicit Integritas error; optional `proof_poll_attempts` column. |

**Minimal schema change** (only if needed for stamp retries):

```sql
-- integritas_proofs: optional columns
stamp_attempts INTEGER NOT NULL DEFAULT 1
last_stamp_error TEXT
```

**Automation retry (KISS):** On stamp failure, if `errorCode` is transient (`upstream_unavailable`, `rate_limited`), save `last_hash` as today but leave `last_proof_id` null and store error on workflow — next scheduled run retries stamp. If `unauthorized`, do not retry until key fixed.

**Do not** build a separate retry queue table in V1.

**Files:** `automation.service.ts`, `integritas.repository.ts`, `database.ts`, `integritas.service.ts`.

**Verification:** simulate 503 (mock) or sandbox rate limit; confirm workflow recovers on next run.

---

### Phase 4 — Integration tests (sandbox)

**Goal:** Catch contract drift against Integritas sandbox without blocking default CI.

**Approach:**

1. Add `backend` test runner (e.g. `node:test` — already Node-native, no new framework).
2. `backend/src/features/integritas/integritas.integration.test.ts`:
   - `describe.skip` or `if (!process.env.INTEGRITAS_SANDBOX_API_KEY) return`
   - Exercise service layer (same code paths as `POST /stamp`, `POST /status`, `POST /verify`): validate key → stamp known hash → poll until `onchain` or timeout (60s) → optional verify if payload ready.
3. Script: `npm --prefix backend run test:integritas` (document in README).
4. Root `npm run check` **does not** run integration tests (no secrets in CI).

**Files:** `backend/package.json`, test file, `.env.example`, `README.md`.

---

### Phase 5 — Frontend polish (small, SOC-safe)

**Goal:** Better operator UX without duplicating backend logic.

#### 5a. Reusable config primitive

Extract `frontend/src/components/RuntimeConfigPanel.tsx`:

- Props: `title`, `fields: { label, value }[]`, `children` (inputs + buttons).
- Refactor `IntegritasRuntimeConfig` and `MinimaRuntimeConfig` to use it.
- Optionally reuse in setup wizard Integritas step.

#### 5b. On-chain status messaging

In `IntegritasHistoryTable` (and Dashboard activity labels):

- `pending` + UID → “Submitted — waiting for on-chain confirmation”
- `ready` → “On-chain — proof payload ready”
- `failed` + `proof_error` → show error
- Optional: show last poll time from `updated_at`

Backend already stores `status_response`; frontend can parse `onchain` if exposed on serialized records (add camelCase mapper in API response if still snake_case).

#### 5c. Portal link

- `env.integritasPortalUrl` (optional, e.g. `https://portal.integritas.technology`)
- Expose in `GET /api/integritas/config` as `portalUrl`
- `IntegritasRuntimeConfig`: “View usage in Integritas Portal” external link when URL set

**Files:** `RuntimeConfigPanel.tsx`, `IntegritasRuntimeConfig.tsx`, `MinimaRuntimeConfig.tsx`, `IntegritasHistoryTable.tsx`, `DashboardPage.tsx`, `integritas.routes.ts`, `env.ts`.

---

### Phase 6 — Documentation and changelog

Update when phases ship:

- `README.md` — complete route list (including `stamp-file`, history actions), poll scheduler, env vars, test command.
- `CHANGELOG.md` — under `[Unreleased]`.
- `SECURITY.md` — only if retry/poll changes exposure (unlikely).
- `AGENTS.md` — note proof poller startup if agent guidance should mention it.

---

## Suggested implementation order

```txt
Phase 1 (HTTP hardening)
  → Phase 2 (proof poller)     ← highest user-visible value
  → Phase 3 (retry policy)
  → Phase 4 (sandbox tests)    ← lock contract before more changes
  → Phase 5 (frontend polish)
  → Phase 6 (docs)
```

Phases 1–2 can be one PR; Phase 3–4 a second; Phase 5 a third.

---

## Env configuration (new)

| Variable | Default | Purpose |
|---|---|---|
| `INTEGRITAS_POLL_INTERVAL_SECONDS` | `30` | Background pending-proof poll interval |
| `INTEGRITAS_REQUEST_TIMEOUT_MS` | `15000` | Upstream fetch timeout |
| `INTEGRITAS_PORTAL_URL` | empty | External portal link for usage monitoring |
| `INTEGRITAS_SANDBOX_API_KEY` | empty | Integration tests only (local/CI secret) |

---

## Verification checklist

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual:

1. Save API key → `GET /api/status/overview` shows integritas ok.
2. Stamp file → Diagnostics shows `pending` → auto becomes `ready` within poll interval.
3. Automation workflow with stamp enabled → proof row linked in data reads.
4. Invalid key → stamp returns clear `unauthorized` error, no retry loop.

With sandbox key:

```bash
INTEGRITAS_SANDBOX_API_KEY=... npm --prefix backend run test:integritas
```

---

## Out of scope (this plan)

- New HTTP routes unless a capability cannot fit the [canonical route table](#canonical-api-routes).
- Usage/limit dashboards (no API).
- OAuth / connector auth model.
- CLI auth for `integritas history` (existing `401` limitation).
- Generic job queue, Redis, or worker process.
- Changing automation to stamp only on hash change (separate product decision per AGENTS.md).

---

## File touch summary

| Area | Files |
|---|---|
| HTTP client | `integritas.service.ts`, `integritas.types.ts` |
| Poller | `integritas-poll.service.ts`, `integritas.repository.ts`, `index.ts`, `env.ts` |
| Retry | `automation.service.ts`, `database.ts` |
| Tests | `integritas.integration.test.ts`, `backend/package.json` |
| Frontend | `RuntimeConfigPanel.tsx`, `IntegritasRuntimeConfig.tsx`, `MinimaRuntimeConfig.tsx`, `IntegritasHistoryTable.tsx` |
| Docs | `README.md`, `CHANGELOG.md`, `.env.example` |

---

## Risk notes

- **External API contract** remains the main risk; sandbox integration tests (Phase 4) are the mitigation.
- **Polling frequency** must respect Integritas rate limits; batch UIDs, use Phase 1 backoff, keep default interval ≥ 30s.
- **API key validation** currently performs a real stamp with a zero hash; document that behavior in SECURITY.md if not already — validation consumes quota.
