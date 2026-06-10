# Integritas Integration Plan

| | |
|---|---|
| **Status** | **In progress** |
| **Done** | Backend Phases 1–3 (HTTP client, poller, retry policy) |
| **Next** | Phase 5 frontend UX |
| **Deferred** | Sandbox tests → [qa/README.md](../qa/README.md) |

Backend Integritas proof API integration, proof lifecycle automation, and related frontend polish for `integritas-pi`.

Companion docs: [README.md](../README.md) (docs index), [project README.md](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: [auth-implementation.md](./auth-implementation.md). QA: [qa/README.md](../qa/README.md).

**External API (authoritative):** Use the official Integritas docs when implementing or changing upstream calls — not ticket placeholders.

- API hub: [integritas.technology API Documentation](https://docs.integritas.technology/docs/technical-docs/api-docs/)
- **v1 (this project):** [Overview (v1)](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/) — base URL `https://integritas.technology/core`, API-key auth via `x-api-key` and `x-request-id` headers.

---

## External Integritas API reference (v1)

`integritas-pi` proxies Integritas **v1** only. v2 exists for full-file stamping shortcuts; defer unless explicitly requested.

### Stamping flow (per official docs)

```txt
1. Hash data     → POST /v1/file/hash          (optional; we hash locally instead)
2. Get UID       → POST /v1/timestamp/post     (submit SHA3-256 hash)
3. Get proof     → POST /v1/timestamp/status   (poll UID until onchain: true)
4. Verify        → POST /v1/verify/post-lite   (proof JSON; see note below)
```

[Get proof](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/get-proof/) documents that `onchain: false` means the transaction is still pending — retry after a short wait (docs cite up to ~3 minutes). Phase 2 background polling aligns with this contract.

### v1 endpoint index

| Upstream path | Official doc | Used in `integritas-pi` | Local proxy / caller |
|---|---|---|---|
| `POST /v1/file/hash` | [Send File and Get Hash](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/send-file-hash/) | **Not called** — we SHA3-256 hash locally (`POST /api/integritas/hash`, `stamp-file`) | — |
| `POST /v1/timestamp/post` | [Send Hash and Get UID](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/send-hash-uid/) | **Yes** — `requestProofUid()` | `POST /api/integritas/stamp`, `stamp-file`, automation |
| `POST /v1/timestamp/status` | [Get Proof](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/get-proof/) | **Yes** — `pollProofStatus()` | `POST /api/integritas/history/:id/poll`, `POST /status` |
| `POST /v1/verify/post` | [Verify Data (Using Source Data)](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/verify-data/) | **No** | — |
| `POST /v1/verify/post-lite` | [Verify Hashed Data (Using Only Proof File)](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/verify-hash/) | **Yes (variant)** — see note | `POST /api/integritas/verify`, `verify-proof-file`, `history/:id/verify` |
| `GET /v1/web/check/health` | *(health probe; not in v1 quick reference table)* | **Yes** — status overview | `GET /api/status/overview` |

**Verify path note:** Official v1 docs describe `POST /v1/verify/post-lite` with `multipart/form-data` (`jsonproof` file upload). This repo calls `POST /v1/verify/post-lite-pdf` with a JSON proof array body and `x-report-required: true`. Treat the running upstream behaviour as source of truth; if verification fails after API changes, re-check [Verify Hashed Data](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/verify-hash/) and the v1 response schema linked from the [v1 overview](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/).

**API keys:** Obtain from [integritas.technology](https://integritas.technology/) (also stated in the [v1 overview](https://docs.integritas.technology/docs/technical-docs/api-docs/v1/)).

When adding new Integritas capabilities, start from the [API hub](https://docs.integritas.technology/docs/technical-docs/api-docs/), confirm the v1 page, then add a narrow backend action — do not expose a generic upstream proxy (see `AGENTS.md`).

---

## Verdict

The **core Integritas backend integration is largely done**. Stamping, hashing, status polling, verification, API key management, SQLite history, automation stamping, and manual UI flows all exist under `backend/src/features/integritas/` with a matching frontend feature folder.

What remains for **feature work** is **targeted frontend UX** on the Integritas page and config modal (Phase 5). **Sandbox integration tests** and broader **auth/security QA** are deferred to [qa/README.md](../qa/README.md). Future ticket items (usage dashboards in-app, OAuth connector) stay out of scope.

**API naming:** The ticket used placeholder route names with no fixed schema. **This plan uses the routes already in the repo** as the canonical API. All new work extends those endpoints and services in place — no renames, no compatibility aliases.

---

## Capability checklist (mapped to current routes)

The ticket checklist is treated as a **capability list**, not a route spec. Status below references the real paths under `/api/integritas/*`.

### Backend — done or partial

| Capability | Status | Route(s) / location |
|---|---|---|
| Integritas external API reviewed | **Done** | v1 upstream paths per [External Integritas API reference](#external-integritas-api-reference-v1); implemented in `integritas.service.ts` and `status.routes.ts`. |
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
| Error handling (rate limits, unavailability, proof failure) | **Done (Phase 1)** | `integritasFetch`: timeouts, transient retry, `errorCode` on API failures, `retryAfter` when upstream sends `429`. Poll route exceptions still → `502`; terminal proof errors → `proof_status: failed`. |

**Summary:** Backend Integritas integration (Phases 1–3) is complete on the current routes. Remaining product gap is operator-facing UX on the Integritas page (Phase 5).

### Backend — remaining

| Ticket item | Status | Notes |
|---|---|---|
| Retry logic for failed stamps | **Done (Phase 3)** | Transient automation stamp failures defer to next run; pending proofs time out via `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES`. |
| Automate proof status fetching | **Done (Phase 2)** | Background poller in `integritas-poll.service.ts`. |
| Integration tests against Integritas sandbox | **Deferred → QA** | See [qa/README.md § Workstream B](../qa/README.md#workstream-b--integritas-sandbox-integration-tests). Not blocking Phase 5. |

### Frontend — remaining (not started)

Sanity check (current repo): **none of these are implemented yet.** `IntegritasPage` still shows raw JSON via `FileDropBox` / `JsonPreview` after stamp; `IntegritasRuntimeConfig` has no portal link; no dedicated stamp-result modal.

| Ticket item | Status | What it means (aligned) |
|---|---|---|
| Reusable settings/config components | **Not started** | **Not** a Phase 5 goal to extract a generic `RuntimeConfigPanel` abstraction. When building Integritas UI, **prefer existing primitives** (`Card`, `Modal`, `StatusBadge`, `FileDropBox`, `Page`, existing config-card styles) so the GUI stays consistent and avoids bloat. Only introduce a new shared component when the same pattern is clearly needed again. |
| Use UID to check the hash has arrived on-chain message | **Not started** | **Integritas page only**, after the user uploads a file and stamps it (`POST /api/integritas/stamp-file`). Today the drop box offers a “View results” link that expands **raw JSON**. Replace or supplement that with a **user-friendly stamp result** (e.g. proof UID, hash, “submitted — waiting for on-chain confirmation” vs ready/failed) — ideally in a **modal**, not a raw payload dump. Backend poller may update status in DB later; initial message is from the stamp response; optional follow-up poll/message can reflect `onchain` when implemented. **Out of scope for V1:** rewriting Diagnostics history table or Dashboard activity as the primary target. |
| Redirect to cloud Portal for usage monitoring | **Not started** | Add an **external link** in the **Integritas config modal** (`IntegritasRuntimeConfig`) to the Integritas cloud user portal so operators can check API usage. No in-app usage dashboard. URL via `INTEGRITAS_PORTAL_URL` (exposed on `GET /api/integritas/config` as `portalUrl`) with a sensible default to [integritas.technology](https://integritas.technology/) if unset. |

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

1. ~~No background proof polling.~~ **Done (Phase 2).**
2. ~~No retry on transient upstream or stamp failures (automation stamp path).~~ **Done (Phase 3).**
3. ~~Integritas upstream calls lack timeout/retry taxonomy.~~ **Done (Phase 1).**
4. No integration tests — **deferred to [qa/README.md](../qa/README.md)**.
5. Integritas page stamp result is raw JSON, not a friendly on-chain status message.
6. No portal link in Integritas config modal.
7. Frontend does not auto-refresh proof status after background poll (reload or manual action required).

---

## Implementation plan

### Phase 1 — Harden Integritas HTTP client (backend) — **complete**

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

### Phase 2 — Automate proof status fetching (backend) — **complete**

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

### Phase 3 — Retry logic for failed stamps and polls (backend) — **complete**

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

### Phase 4 — Integration tests (sandbox) — **deferred to QA**

**Status:** Not scheduled during feature implementation. Moved to [qa/README.md § Workstream B](../qa/README.md#workstream-b--integritas-sandbox-integration-tests).

**Goal (when QA runs):** Catch Integritas API contract drift using a sandbox key without blocking default CI.

**Outline:** `node:test` + `INTEGRITAS_SANDBOX_API_KEY` → stamp → poll → optional verify; `npm --prefix backend run test:integritas`; not part of `npm run check`.

---

### Phase 5 — Integritas page UX (frontend)

**Goal:** Clear post-stamp feedback on the Integritas page and a portal link in config — without new abstractions or in-app usage dashboards.

**Guiding principle (reuse, not framework):** Compose from existing `frontend/src/components/` and styles (`Card`, `Modal`, `StatusBadge`, `FileDropBox`, `config-card`, etc.). Do not prioritize extracting a generic runtime-config framework unless duplication becomes painful.

#### 5a. Friendly stamp result after file upload (on-chain message)

**Where:** `IntegritasPage` + `StampFilePanel` / `FileDropBox` flow after `stampFile()` succeeds.

**Current behaviour:** `FileDropBox` shows `JsonPreview` with label “View results” — raw API JSON.

**Target behaviour:**

1. On successful stamp, open a **modal** (reuse `Modal`) with operator-readable copy, for example:
   - **Submitted:** “Proof requested. UID: … Hash: … Waiting for on-chain confirmation (usually within a few minutes).”
   - Map from `stamp-file` response: `record.proof_uid`, `record.hash`, `record.proof_status` (`pending` initially).
2. Replace or demote the raw JSON toggle — keep “View technical details” collapsed optional if useful for support.
3. **Optional V1.1:** After modal open, light client poll of `POST /api/integritas/history/:id/poll` or refresh history row until `ready`/`failed`, then update modal message (“Hash confirmed on-chain” / error). Not required if copy sets expectation to check Diagnostics later.

**Backend:** Prefer human-readable fields on existing stamp response; add `statusLabel` / `onchain` on history API only if the UI cannot derive message from `proof_status` + UID.

**Not in scope:** Diagnostics `IntegritasHistoryTable` redesign (may still show `proof_status` string as today).

#### 5b. Portal link in Integritas config modal

**Where:** `IntegritasRuntimeConfig` inside the “Configure Integritas” modal on `IntegritasPage`.

**Target behaviour:**

- External link, e.g. “View API usage in Integritas portal” → opens in new tab.
- `INTEGRITAS_PORTAL_URL` in env (default `https://integritas.technology/` or documented portal URL).
- Expose as `portalUrl` on `GET /api/integritas/config`.

**Not in scope:** Fetching or displaying usage limits inside the Pi UI.

#### 5c. Reuse checklist (lightweight)

When implementing 5a–5b:

- Reuse `Modal`, `StatusBadge`, existing button/card classes.
- Do **not** block Phase 5 on refactoring `MinimaRuntimeConfig` or setup wizard unless a natural shared snippet emerges.

**Files (expected):** `IntegritasPage.tsx`, `StampFilePanel.tsx` and/or new `StampResultModal.tsx`, `IntegritasRuntimeConfig.tsx`, `integritasTypes.ts`, `app/types.ts`, `integritas.routes.ts`, `env.ts`, `.env.example`, `README.md`.

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
Done:
  Phase 1 (HTTP hardening)
  Phase 2 (proof poller)
  Phase 3 (retry policy)

Next (feature work):
  Phase 5 (Integritas page UX)
  Phase 6 (docs for shipped behavior)

Deferred to QA phase (see qa/README.md):
  Phase 4 (sandbox integration tests)
  Auth security hardening + auth automated tests
```

Phase 5 can proceed without Phase 4.

---

## Env configuration (new)

| Variable | Default | Purpose |
|---|---|---|
| `INTEGRITAS_POLL_INTERVAL_SECONDS` | `30` | Background pending-proof poll interval |
| `INTEGRITAS_REQUEST_TIMEOUT_MS` | `15000` | Upstream fetch timeout |
| `INTEGRITAS_PORTAL_URL` | empty | External portal link for usage monitoring |
| `INTEGRITAS_SANDBOX_API_KEY` | empty | QA sandbox tests only (see [qa/README.md](../qa/README.md)) |

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

Sandbox integration tests: deferred to QA — see [qa/README.md](../qa/README.md).

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

- **External API contract** remains the main risk; sandbox integration tests in [qa/README.md](../qa/README.md) are the mitigation when QA runs.
- **Polling frequency** must respect Integritas rate limits; batch UIDs, use Phase 1 backoff, keep default interval ≥ 30s.
- **API key validation** currently performs a real stamp with a zero hash; document that behavior in SECURITY.md if not already — validation consumes quota.
