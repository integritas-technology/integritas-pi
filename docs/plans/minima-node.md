# Minima Node Integration Plan

| | |
|---|---|
| **Status** | **Complete** (Phases 1–3 shipped; live RPC integration tests remain in QA) |
| **Done** | Phases 1–3 — status DTO, Minima Core UX, health poller, restart, peers, parser unit tests |
| **Next** | QA — live Minima RPC integration tests behind `MINIMA_INTEGRATION_TEST=1` |
| **Deferred** | Live RPC integration tests → QA workstream |

Backend service for the local Minima node (Docker container + HTTP RPC), exposing node status, health metrics, and operational controls to the browser UI.

Companion docs: [README.md](../README.md) (docs index), [project README.md](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: [integritas-integration.md](./integritas-integration.md). QA: [qa/README.md](../qa/README.md).

**External interface (authoritative):** Minima node RPC over HTTP on port 9005 — path-encoded commands, not query parameters. See [AGENTS.md](../../AGENTS.md) Minima rules and [Minima run-a-node docs](https://github.com/minima-global/docs/tree/main/content/docs/run-a-node).

---

## Verdict

**Phases 1–3 are shipped.** Operators get normalized status, Minima Core UX (summary cards, node health, container stats, config modal with peers), backend health poller with optional auto-resync, admin restart/peers APIs, parser unit tests, and UI resync that chains container restart when Minima requires it.

**Remaining work is QA**, not feature build — see [minima-gaps.md](../qa/minima-gaps.md).

**API naming:** The ticket used placeholder paths (`/api/node/*`). **This plan uses `/api/minima/*`** — the routes already registered in `minima.routes.ts` and documented in `README.md`. No renames, no compatibility aliases.

**Nav vs API:** The sidebar nav id is `node` (label “Minima Core”); the API namespace is `minima`. That is intentional and unchanged.

---

## Shipped capabilities (audit 2026-06-11)

| Area | Status | Implementation |
|---|---|---|
| Normalized status API | **Done** | `GET /api/minima/status` → `getMinimaNodeStatus()`; HTTP 200 + `state` / `sync` / `health` / `container` / `storage` / `monitoring` |
| Overview Minima check | **Done** | `status.routes.ts` uses `getMinimaNodeStatus()` |
| Frontend poll (30s) | **Done** | `useMinimaStatusRefresh`; pauses during resync/restart/busy |
| Backend health poller | **Done** | `minima-poll.service.ts`; stall + optional `MINIMA_AUTO_RESYNC` |
| Restart / peers API | **Done** | `POST /restart`, `GET /peers`, `POST /peers/add` (admin + audit on mutations) |
| Parser unit tests | **Done** | `minima.parse.test.ts`; `npm run test` |
| Minima Core UX | **Done** | `MinimaSummaryGrid`, `MinimaHealthCard`, `MinimaContainerCard`, settings modal (Integritas-style layout) |
| Resync UX | **Done** | Toast + auto-restart when Minima requires; transient RPC errors suppressed |
| Wallet | **Done** | `WalletPage.tsx` → `GET /api/minima/balance` |

### Not shipped / deferred → [minima-gaps.md](../qa/minima-gaps.md)

| Item | Notes |
|---|---|
| Live RPC integration tests | `MINIMA_INTEGRATION_TEST=1` — QA |
| Admin gate on resync/config | Open decision; **not** implemented (restart/peers are admin-gated) |
| Poller auto-restart after resync | UI resync chains restart; backend poller does not |
| AppShell overview refresh | One-shot pill; optional polish |
| Minima CLI | Out of scope V1 |
| Peer remove | No Minima RPC documented |
| Prometheus / metrics export | Out of scope |

---

## Canonical API routes

All routes mount at `/api/minima` in `app.ts`. All require `requireAuth`. **Admin-gated:** `POST /restart`, `POST /peers/add`. **Any authenticated user:** config, status, peers read, balance, resync (see [Open decisions](#open-decisions)).

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/config` | Megammr host + source (`database` \| `default`) | **Done** |
| `POST` | `/config` | Save Megammr host | **Done** |
| `GET` | `/status` | Normalized node status | **Done** |
| `GET` | `/balance` | Wallet balance via `balance` RPC | **Done** |
| `POST` | `/megammrsync/resync` | Trigger Megammr resync | **Done** |
| `GET` | `/peers` | Peer list from Minima RPC | **Done** |
| `POST` | `/peers/add` | Add peers (`peers action:addpeers`) | **Done** (admin) |
| `POST` | `/restart` | Restart Minima Docker container | **Done** (admin) |

**Related (not under `/api/minima`):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/status/overview` | Aggregate service health + Docker CPU/memory for all compose services |
| `GET` | `/api/health` | Backend liveness (public) |

**New routes:** Prefer extending `GET /api/minima/status` before adding endpoints. Phase 3 may add `POST /api/minima/restart`. A separate `GET /api/minima/health` is optional if status payload grows too large — default is **one endpoint** with nested `health` for KISS.

**CLI:** No Minima-specific CLI commands in V1. Operators use the browser UI or curl with session cookie.

---

## Minima RPC reference (for implementation)

Communication is HTTP GET to the RPC base URL with the command percent-encoded in the path:

```txt
http://minima:9005/status
http://minima:9005/balance
http://minima:9005/peers
http://minima:9005/megammrsync%20action%3Aresync%20host%3Amegammr.minima.global%3A9001
```

Typical response envelope:

```json
{
  "command": "status",
  "status": true,
  "pending": false,
  "response": {
    "chain": { "block": "932067", "…": "…" }
  }
}
```

**Allowlist (current + Phase 1):**

| Command | Purpose | Exposed via |
|---|---|---|
| `status` | Chain block, sync state, node metadata | `GET /api/minima/status` |
| `peers` | Peer list / count | `GET /api/minima/peers`; also parsed in status when needed |
| `balance` | Wallet balance | `GET /api/minima/balance` |
| `megammrsync action:resync host:<host>` | Archive resync | `POST /api/minima/megammrsync/resync` |

Do **not** add a generic `POST /api/minima/command` proxy. Each new capability gets its own narrow service function and route (per `AGENTS.md` and `SECURITY.md`).

---

## Target architecture (KISS + separation of concerns)

```txt
Browser
  → /api/minima/* (routes: HTTP only)
  → minima.service.ts (orchestration: status, health, resync, config)
  → minima.rpc.ts (HTTP to Minima — path commands, timeouts)
  → minima.parse.ts (raw RPC JSON → typed DTOs)
  → minima.docker.ts (read minima container state/stats via status/docker helpers)
  → settings (Megammr host via settings.repository)

Schedulers (index.ts startup, Phase 2 only)
  → minima-poll.service.ts (health snapshot, stall detection, optional auto-resync)

status feature (existing)
  → docker.service.ts (container list/stats)
  → docker.control.ts (allowlisted restart — writable socket)
  → status.routes.ts (overview calls getMinimaNodeStatus())
```

**Principles:**

1. **One RPC client** — all Minima HTTP calls go through `minima.rpc.ts` (`runMinimaPathCommand` moved/refactored there).
2. **Parse once** — `minima.parse.ts` maps vendor JSON to stable DTOs; routes never parse `body.response.chain` inline.
3. **Docker read vs write** — stats via read paths; restart via `docker.control.ts` (admin). Socket mount is writable for restart (see `SECURITY.md`).
4. **No frontend RPC** — browser calls backend only (`credentials: "include"`).
5. **Fail safe** — RPC down → structured `state: "error"` with message; never leak secrets.
6. **No new abstractions** — no generic node framework, no job queue; copy `integritas-poll.service.ts` pattern if backend polling is needed.

---

## Current state snapshot (2026-06-11)

### Backend (`backend/src/features/minima/`)

| File | Role |
|---|---|
| `minima.rpc.ts` | Path-encoded HTTP RPC |
| `minima.parse.ts` | Status/peers/block/resync parsing |
| `minima.parse.test.ts` | Unit tests |
| `minima.errors.ts` | Operator-friendly RPC transport errors |
| `minima.docker.ts` | Minima container stats from Docker |
| `minima.service.ts` | `getMinimaNodeStatus`, resync, restart, peers, config |
| `minima.monitoring.ts` | Stall snapshot for poller + status DTO |
| `minima-poll.service.ts` | Health poller + optional auto-resync |
| `minima.routes.ts` | HTTP routes |
| `minima.types.ts` | `MinimaNodeStatus` DTO |

### Cross-cutting

- `status/docker.control.ts` — `restartComposeService("minima")`
- `status/status.routes.ts` — overview uses `getMinimaNodeStatus()`
- `index.ts` — `startMinimaHealthPoller()` after migrations

### Frontend (`frontend/src/features/minima/`)

`MinimaPage`, `MinimaSummaryGrid`, `MinimaHealthCard`, `MinimaContainerCard`, `MinimaRuntimeConfig`, `minimaApi`, `useMinimaStatusRefresh`, `mergeMinimaStatus`, `minimaResync`, `minimaStatusDisplay`, `minimaFormat`.

### Git history (feature branch)

| Commit | Summary |
|---|---|
| `1468177` | Minima integration plan |
| `d37da21` | Phase 1 — normalized status API + UI |
| `789859e` / `e73ddc4` | UI/health cards, polling |
| `230c139` | Resync/sync parsing fixes |
| `a58ab96` | Phase 2 — health poller + auto-resync |
| `0935bd6` | Local storage — chain + container disk |
| `f035b25` | Phase 3 — restart, peers API, parser tests |
| `4ff542d` / `13c041f` | Config modal layout, peer UX, error handling |

### Open gaps → [minima-gaps.md](../qa/minima-gaps.md)

---

## API shape (Phase 1)

**Recommended:** Extend `GET /api/minima/status` with a normalized envelope. Keep raw RPC under `rpc.raw` for QA/debug.

```ts
type MinimaNodeStatus = {
  checkedAt: string;                    // ISO UTC
  state: "running" | "stopped" | "error";
  container: {
    state: string;                      // Docker State e.g. "running"
    status: string;                     // Docker Status string
    cpuPercent: number | null;
    memory: { usage: string | null; limit: string | null } | null;
  } | null;
  rpc: {
    ok: boolean;
    error?: string;
    raw?: unknown;                      // optional; omit in production UI
  };
  sync: {
    synced: boolean | null;
    status: "active" | "stale" | "syncing" | "unavailable";
    block: number | null;
    blockTime: string | null;
    blockAgeSeconds: number | null;
  };
  health: { peerCount: number | null; peersKnown: number | null };
  node: { memoryRam: string | null; memoryDisk: string | null };
  storage: {
    dataPath: string;
    containerDisk: string | null;
    chainDataDisk: string | null;       // Minima RPC memory.disk
  };
  config: { megammrHost: string; megammrHostSource: "database" | "default" };
  monitoring: {
    stallDetected: boolean;
    stallThresholdSeconds: number;
    autoResyncEnabled: boolean;
    lastPollerCheckAt: string | null;
    lastStallDetectedAt: string | null;
    lastAutoResyncAt: string | null;
    lastAutoResyncResult: string | null;
  };
};
```

**State derivation:**

| `state` | When |
|---|---|
| `stopped` | Docker container state is not `running` |
| `error` | Container running but RPC unreachable, or RPC `status: false`, or unparseable critical fields |
| `running` | Container running and RPC `status: true` |

**Optional split:** If the payload becomes too large, extract `health` to `GET /api/minima/health` returning `{ peerCount, block, blockAgeSeconds, checkedAt }`. Default Phase 1 keeps one endpoint.

---

## Implementation plan

### Phase 1 — Structured status + Minima Core UX — **complete**

**Goal:** Operators see node state, sync, block, peers, and container resources without reading raw JSON. Smallest useful slice; no backend poller, no auto-resync.

#### Backend

1. **Add `minima.rpc.ts`** — move `runMinimaPathCommand` + `getMinimaStatus` HTTP fetch here.
2. **Add `minima.parse.ts`** — `parseStatusResponse(body)`, `parsePeersResponse(body)` with defensive nulls.
3. **Add `minima.docker.ts`** — `getMinimaContainerStats()` wrapping `dockerServiceResources()` filtered to service `minima` (import from `status/docker.service.ts`, do not duplicate Docker socket logic).
4. **Extend `minima.service.ts`** — `getMinimaNodeStatus()` composes docker + RPC + config. Container disk comes from Docker stats (`disk.rootFs`); backend does not mount Minima data dir.
5. **Update `minima.routes.ts`** — `GET /status` returns normalized DTO; HTTP 200 when check succeeded (even if `state: "error"`); reserve 502 for transport/handler failures only.
6. **Optional:** Refactor `status.routes.ts` overview to call `getMinimaNodeStatus()` for consistent Minima health (small DRY win; not required for Phase 1 ship).

**Files:** `minima.rpc.ts`, `minima.parse.ts`, `minima.docker.ts`, `minima.service.ts`, `minima.routes.ts`, `frontend/src/app/types.ts`, `CHANGELOG.md`, `README.md` (API example).

**Env:** None required. Frontend poll interval can be a constant (30s) initially.

#### Frontend

1. **Types** — `MinimaNodeStatus` in `app/types.ts` (replace/extend `MinimaStatus`).
2. **`features/minima/minimaApi.ts`** — `getMinimaNodeStatus()` via shared `api.ts` fetch helper.
3. **`useMinimaStatusRefresh` hook** — poll while `MinimaPage` mounted (30s); mirror `DataSourcesPage` / `useIntegritasHistoryAutoRefresh` patterns.
4. **`MinimaPage.tsx`** — stat cards: state pill, block + age, peer count, CPU/memory; collapsible “RPC debug” with `JsonPreview` optional.
5. **Resync errors** — `useToast` for transient failures (keep inline errors for config validation).
6. **Reuse** — `Card`, `StatusBadge`, `Modal`, `Pill`; no new design system.

**Files:** `MinimaPage.tsx`, `features/minima/*`, `app/types.ts`.

**Verification:**

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Manual: Minima page shows block/peer stats; stop `minima` container → `state: stopped`; resync still works; wallet page unaffected.

---

### Phase 2 — Backend health poller + auto-resync — **complete**

**Goal:** Detect chain stall and optionally trigger Megammr resync without operator action.

**New:** `backend/src/features/minima/minima-poll.service.ts`

```txt
startMinimaHealthPoller()
  every N seconds (env: MINIMA_HEALTH_POLL_INTERVAL_SECONDS, default 60)
  call getMinimaNodeStatus() → update in-memory snapshot
  if auto-resync enabled and stall detected → resyncMegammr() with cooldown
  log actions; never crash scheduler
```

**Stall detection (defaults — tune in QA):**

| Rule | Default |
|---|---|
| Stall | `blockAgeSeconds > 300` while `state === "running"` |
| Cooldown | No auto-resync within 30 minutes of last attempt |
| Enabled | `MINIMA_AUTO_RESYNC=false` by default |

**Phase 2a (recommended first):** Poller + snapshot + expose `lastAutoResyncAt` / `stallDetected` on status DTO — **log only, no auto-action**.

**Phase 2b:** Enable auto-resync behind `MINIMA_AUTO_RESYNC=true`.

**Files:** `minima-poll.service.ts`, `index.ts`, `env.ts`, `.env.example`, `SECURITY.md`, `CHANGELOG.md`.

**SOC:** Poller imports service only; resync reuses `resyncMegammr()` — no duplicate RPC strings.

---

### Phase 3 — Restart, peers, tests — **complete**

| Item | Approach |
|---|---|
| `POST /api/minima/restart` | `status/docker.control.ts` — `POST /containers/{id}/restart`; `requireRole('admin')`; returns `{ state: "restarting" }`; audit log |
| Peer management | `GET /api/minima/peers`, `POST /api/minima/peers/add` (admin) — allowlisted `peers` / `peers action:addpeers` |
| Tests | `backend/src/features/minima/minima.parse.test.ts` (`npm run test`); live RPC integration behind `MINIMA_INTEGRATION_TEST=1` deferred to QA |

Docker socket mount is writable (restart requires POST). Documented in `SECURITY.md`.

---

## Frontend UX target (Minima Core page)

Align with `mock/MinimaEdgeWorkbench.tsx` Node section — implemented incrementally in Phase 1:

| UI element | Data source |
|---|---|
| State pill (Running / Stopped / Error) | `status.state` |
| Current block | `status.sync.block` |
| Last block age | `status.sync.blockAgeSeconds` (humanized) |
| Active peers | `status.health.peerCount` (`network.connected`) |
| Configured peers | `GET /api/minima/peers` in settings modal |
| CPU / memory | `status.container.cpuPercent`, `status.container.memory` |
| Megammr resync | existing action card |
| Configure Megammr host | existing modal |
| Restart node | `POST /api/minima/restart` — Container card button (admin, confirm) |
| Peer list / add | `GET /api/minima/peers`, `POST /api/minima/peers/add` |

**App shell (optional polish):** Refresh overview pills on interval or when entering Minima page — low priority; can follow Phase 1.

---

## Open decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | One vs two status endpoints | **One** `GET /api/minima/status` with nested `health` |
| 2 | Phase 1 polling owner | **Frontend** interval on Minima page; backend poller in Phase 2 |
| 3 | Admin gate on config/resync | **Recommended** for resync; **not implemented** — restart/peers are admin-gated; track in [minima-gaps.md](../qa/minima-gaps.md) |
| 4 | Block failure definition | **Stale block age** while container running; confirm threshold with ops |
| 5 | Raw RPC in API response | Include `rpc.raw` for QA; hide behind collapsible UI section |
| 6 | `502` vs `200` when node unhealthy | **`200` + `state: "error"`** for expected unhealthy; `502` for handler/upstream transport failure |

---

## Verification checklist (Phase 1 exit)

- [x] `GET /api/minima/status` returns normalized DTO with `state`, `sync`, `health`, `container`
- [x] Minima Core page shows structured stats (not only raw JSON)
- [x] Page refreshes status on interval while mounted
- [x] Resync failures surface via toast
- [ ] Stopped Minima container → `state: stopped` in API and UI (manual audit)
- [x] `npm run check` passes (typecheck; pre-existing npm audit advisory unrelated)
- [x] `CHANGELOG.md` updated under `[Unreleased]`
- [x] `README.md` API section updated if response shape changes materially

---

## Changelog & docs

When shipping each phase:

- Add operator-facing notes to `CHANGELOG.md` (`[Unreleased]`).
- Update `README.md` Minima API example if response shape changes.
- Update `SECURITY.md` when adding Docker write (restart) or auto-resync.
- Plan marked **Complete** in `docs/README.md`; QA gaps in [minima-gaps.md](../qa/minima-gaps.md) and [qa/README.md](../qa/README.md#workstream-e--minima-node-qa).

---

## Ticket checklist (tracking copy)

Use this as the living checkbox list aligned to this plan:

**Backend**

- [x] Define local daemon interface (HTTP RPC, path-encoded)
- [x] `GET /api/minima/status` — normalized Running/Stopped/Error, sync, storage (Phase 1)
- [x] Health metrics — peer count, block age (Phase 1, nested in status)
- [x] Resync (`POST /api/minima/megammrsync/resync`)
- [x] Automate resync on block stall (Phase 2, `MINIMA_AUTO_RESYNC=true`, cooldown-gated)
- [x] Health polling loop — frontend Phase 1 (30s on Minima page); backend Phase 2 (`MINIMA_HEALTH_POLL_INTERVAL_SECONDS`)
- [x] Graceful RPC/container failure handling (structured states in Phase 1)

**Frontend**

- [x] Structured sync/health on Minima Core page (Phase 1)
- [x] Current/last block + age (Phase 1)
- [x] Live resource stats (Phase 1)
- [x] Reuse Modal; Toast for resync (Phase 1)

**Future**

- [x] `POST /api/minima/restart` (Phase 3)
- [x] Manage peer connections — list + add peers (Phase 3)
- [x] Unit tests for `minima.parse.ts` (Phase 3)
- [ ] Live Minima RPC integration tests (QA)
