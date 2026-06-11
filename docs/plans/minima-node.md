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

The **Minima integration foundation is shipped**: HTTP RPC client, allowlisted commands, Megammr resync, wallet balance, and a basic Minima Core page. What remains is **structured status/health** (instead of raw JSON passthrough), **live operator UX** on the Minima page, and optionally **backend health monitoring** with stall detection.

**API naming:** The ticket used placeholder paths (`/api/node/*`). **This plan uses `/api/minima/*`** — the routes already registered in `minima.routes.ts` and documented in `README.md`. No renames, no compatibility aliases.

**Nav vs API:** The sidebar nav id is `node` (label “Minima Core”); the API namespace is `minima`. That is intentional and unchanged.

---

## Capability checklist (mapped to current routes)

The ticket checklist is a **capability list**, not a route spec.

### Backend — done or partial

| Capability | Status | Route(s) / location |
|---|---|---|
| Local daemon interface (HTTP RPC, path-encoded) | **Done** | `runMinimaPathCommand()` in `minima.service.ts`; `MINIMA_STATUS_URL` in `env.ts` / `docker-compose.yml` |
| Node status (reachability) | **Partial** | `GET /api/minima/status` — returns raw RPC wrapper (`ok`, `status`, `source`, `body`); not normalized Running/Stopped/Error + sync + storage |
| Node health (peers, block age) | **Not started** | No dedicated endpoint; data exists inside Minima `status` / `peers` RPC responses but is not parsed |
| Megammr resync | **Done** | `POST /api/minima/megammrsync/resync`; host from `GET/POST /api/minima/config` (SQLite `minima_megammr_host`) |
| Wallet balance | **Done** | `GET /api/minima/balance` (allowlisted `balance` command) |
| Crash / unavailable handling | **Partial** | RPC failures → `502`; `GET /api/status/overview` catches Minima errors; Docker `restart: unless-stopped` on `minima` service |
| Docker resource visibility | **Partial** | `GET /api/status/overview` → `resources.containers[]` includes `minima` CPU/memory; not exposed on Minima page; AppShell fetches once |

### Backend — remaining

| Ticket item | Status | Notes |
|---|---|---|
| Normalized status (Running/Stopped/Error, sync, storage) | **Phase 1** | Extend `GET /api/minima/status` DTO; combine Docker container state + parsed RPC |
| Health metrics (peer count, last block age) | **Phase 1** | Nested under status or `GET /api/minima/health` — see [API shape](#api-shape-phase-1) |
| Health polling loop (configurable interval) | **Phase 1 (frontend)** / **Phase 2 (backend)** | Frontend interval on Minima page first; backend poller only when auto-resync needs it |
| Automate resync on block failure | **Phase 2** | Requires stall definition, cooldown, feature flag; detect+log before auto-action |
| `POST` restart with permission check | **Done** | `POST /api/minima/restart`; `requireRole('admin')`; audit log |
| Manage peer connections | **Done** | `GET /api/minima/peers`, `POST /api/minima/peers/add` (add only; no remove RPC in Minima docs) |
| Unit / integration tests | **Deferred → QA** | Parser fixtures + optional live-RPC integration behind env flag |

### Frontend — done or partial

| Capability | Status | Location |
|---|---|---|
| Minima Core page | **Partial** | `MinimaPage.tsx` — config modal, resync, raw `JsonPreview` of status |
| Megammr config modal | **Done** | `MinimaRuntimeConfig.tsx` + `Modal` |
| Resync action | **Done** | `MinimaActionCards.tsx` |
| Wallet balance | **Done** | `WalletPage.tsx` → `GET /api/minima/balance` |
| Service status pill (header) | **Partial** | `AppShell.tsx` — one-shot `GET /api/status/overview`; label “Wallet ready” uses `minima` service ok |
| Structured sync / block display | **Not started** | Mock target: `mock/MinimaEdgeWorkbench.tsx` Node health section |
| Live resource stats | **Not started** | Overview has data; Minima page does not poll or display it |
| Toast for transient errors | **Partial** | Resync uses inline errors; Diagnostics pattern uses `useToast` |

### Future — defer

| Capability | Recommendation |
|---|---|
| `POST /api/minima/restart` | Docker container restart via socket; admin-only; document in `SECURITY.md` |
| Peer connection management | Allowlisted commands per action; no generic RPC proxy |
| Backend-side metrics export | Out of scope unless Minima Prometheus endpoint is explicitly required |

---

## Canonical API routes

All implementation builds on paths registered in `minima.routes.ts`, mounted at `/api/minima` in `app.ts`. All routes require `requireAuth` (no `admin` gate today on config/resync — see [Open decisions](#open-decisions)).

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/config` | Megammr host + source (`database` \| `default`) | **Done** |
| `POST` | `/config` | Save Megammr host | **Done** |
| `GET` | `/status` | Node status | **Partial** — normalize in Phase 1 |
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
| `peers` | Peer list / count (if not fully in `status`) | Phase 1 parser only; no generic proxy |
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
  → docker.service.ts (read-only Docker socket)
  → status.routes.ts (overview may call shared getMinimaNodeStatus() later)
```

**Principles:**

1. **One RPC client** — all Minima HTTP calls go through `minima.rpc.ts` (`runMinimaPathCommand` moved/refactored there).
2. **Parse once** — `minima.parse.ts` maps vendor JSON to stable DTOs; routes never parse `body.response.chain` inline.
3. **Docker read vs write** — status/health use read-only Docker inspect/stats. Restart is a separate Phase 3 module with admin auth.
4. **No frontend RPC** — browser calls backend only (`credentials: "include"`).
5. **Fail safe** — RPC down → structured `state: "error"` with message; never leak secrets.
6. **No new abstractions** — no generic node framework, no job queue; copy `integritas-poll.service.ts` pattern if backend polling is needed.

---

## Current state snapshot

### Backend (`backend/src/features/minima/`)

- **`minima.service.ts`:** `getMinimaStatus`, `getWalletBalance`, `resyncMegammr`, `getMinimaConfig`, `saveMinimaConfig`, internal `runMinimaPathCommand`.
- **`minima.routes.ts`:** Thin handlers; 502 on upstream failure.
- **`env.ts`:** `minimaStatusUrl` from `MINIMA_STATUS_URL` or `http://127.0.0.1:${MINIMA_RPC_PORT}/status`.
- **No parser, no docker helper, no poller** in this feature folder yet.
- **Auth:** All `/api/minima/*` behind `requireAuth`; config/resync are **not** `admin`-gated (differs from Integritas API key mutations).

### Cross-cutting (`backend/src/features/status/`)

- **`status.routes.ts`:** Probes `env.minimaStatusUrl`; treats `body.status === true` as healthy.
- **`docker.service.ts`:** `dockerServiceResources()` — CPU/memory for compose project `integritas-pi` containers including `minima`.

### Frontend

- **`MinimaPage.tsx`:** One-shot status fetch; resync; config modal; raw JSON preview.
- **`AppShell.tsx`:** One-shot overview for header pills.
- **`features/minima/`:** `MinimaActionCards`, `MinimaRuntimeConfig`.
- **`WalletPage.tsx`:** Balance display.
- **`mock/MinimaEdgeWorkbench.tsx`:** Aspirational UX (peer count, block age, CPU/memory, restart) — reference only, not production code.

### Gaps

1. Status API returns opaque RPC wrapper; operators must read raw JSON.
2. No parsed block height, block age, or peer count in API or UI.
3. Minima page does not poll; AppShell overview does not refresh.
4. Resource stats exist in overview but are not shown on Minima Core page.
5. No backend health loop or auto-resync.
6. No Docker restart control.
7. No automated tests for Minima parsing — deferred to QA.

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
    block: number | null;
    blockTime: string | null;           // ISO if parseable
    blockAgeSeconds: number | null;
  };
  health: {
    peerCount: number | null;
  };
  storage: {
    dataPath: string;                   // informational e.g. /home/minima/data (Minima container)
    containerDisk: string | null;       // from Docker container rootfs size (same as overview)
  };
  config: {
    megammrHost: string;
    megammrHostSource: "database" | "default";
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
| Peer connections | `status.health.peerCount` |
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
| 3 | Admin gate on config/resync | **Yes for resync** (`requireRole('admin')`); config change is lower risk — align with product |
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
- Mark this plan **Complete** in `docs/README.md` when Phase 1–2 product scope is done; move tests to `qa/README.md`.

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
