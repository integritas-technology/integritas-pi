# Device Status Plan

| | |
|---|---|
| **Status** | **Complete** |
| **Done** | Phase 1 — device info service + `GET /api/status` + graceful shutdown; Phase 2 — dashboard device status card |
| **Next** | — |
| **Deferred** | Wallet presence in status, health polling scheduler, per-step setup status |

_Expose device identity and system health to the dashboard and other backend services. Acts as the base status layer for all modules running on the Pi._

Companion docs: [docs index](../README.md), [project README](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: [minima-node.md](./minima-node.md). QA: [qa/README.md](../qa/README.md).

**External interface:** Node.js built-in `os` module (no network calls for device info).

---

## Verdict

Much of the scaffolding already exists. `GET /api/health` (liveness), `GET /api/setup/status` (setup boolean), and `GET /api/status/overview` (per-service diagnostic detail + Docker resource stats) are all shipped. What is missing is a device-identity layer (hostname, uptime, OS, stable device ID) and a root `GET /api/status` summary endpoint that the dashboard can poll cheaply. Graceful shutdown and unit tests are also absent.

**Naming / scope notes:** The ticket's `/api/setup-status` maps to the existing public `GET /api/setup/status` — no new route. The ticket's `/api/status` is a new root handler on the existing `statusRouter` (distinct from the existing `/api/status/overview`). "Wallet presence" is deferred from the status endpoint to avoid async Minima RPC latency on every status call; the Wallet page already handles this independently.

---

## Shipped capabilities

_Update during/after implementation._

| Area | Status | Implementation |
|---|---|---|
| `GET /api/health` liveness | **Done** | `health.routes.ts` — public, returns `{ status, service }` |
| `GET /api/setup/status` | **Done** | `setup.routes.ts` — public, returns `{ setupComplete }` |
| `GET /api/status/overview` multi-service detail | **Done** | `status.routes.ts` — auth-protected, returns services array + Docker container resources + disk |
| Docker container CPU / memory / disk stats | **Done** | `docker.service.ts` — used by overview |
| Startup lifecycle (migrations, schedulers) | **Done** | `index.ts` |
| Device info service (hostname, uptime, OS, device ID) | **Done** | `device.service.ts` — `ensureDeviceId()` + `getDeviceInfo()` |
| `GET /api/status` device summary endpoint | **Done** | `status.routes.ts` — auth-protected, returns `device`, `app`, `node` |
| Host-level memory / load stats (os module) | **Done** | `device.service.ts` — `os.totalmem()`, `os.freemem()`, `os.loadavg()` |
| Graceful shutdown (SIGTERM / SIGINT) | **Done** | `index.ts` — stops all schedulers, closes SQLite |
| Unit tests for device service and status routes | **Deferred → QA** | — |

### Not shipped / deferred → [qa-gaps.md](../qa/device-status-gaps.md)

| Item | Notes |
|---|---|
| Wallet presence in `GET /api/status` | Requires async Minima RPC call; adds latency; Wallet page handles this independently. Revisit if dashboard explicitly needs it. |
| Health polling scheduler | On-demand fetch is adequate for now; Minima poller already runs at 60s. Revisit if overview latency becomes a problem. |
| Per-step setup status | Setup completes atomically (no per-step persistent state). Current `setupComplete` boolean is the right contract. |
| Unit tests for device service and status routes | Deferred to QA stage. |
| Integration tests for `GET /api/health` | Deferred to QA stage. |

---

## Canonical API routes

All routes require `requireAuth` unless noted.

| Method | Path | Purpose | Status | Auth |
|---|---|---|---|---|
| `GET` | `/api/status` | Device summary (identity + app + node state + host health) | **Not started** | requireAuth |
| `GET` | `/api/status/overview` | Per-service diagnostic detail + Docker container resources | **Done** | requireAuth |

**Already done (public, outside this feature namespace):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend liveness (public) |
| `GET` | `/api/setup/status` | Setup completion flag (public) |

**CLI:** None in V1.

---

## Target architecture (KISS + separation of concerns)

```txt
Browser / Dashboard
  → GET /api/status (status.routes.ts)
  → device.service.ts   (hostname, uptime, os info, device ID from settings)
  → setup.service.ts    (isSetupComplete — already exists)
  → minima-poll cache   (last known node state, no extra RPC call)

index.ts
  → ensureDeviceId()    (generate + persist device ID on first startup)
  → SIGTERM/SIGINT      (stop schedulers, close gracefully)
```

**Principles:**

1. `GET /api/status` must be fast — use `os` module (synchronous) + cached state only; no upstream network calls.
2. Keep device identity stable: generate a UUID once on startup, persist in the `settings` table.
3. Extend existing `status` feature folder; no new top-level feature.
4. Graceful shutdown is a startup concern — add to `index.ts` next to existing scheduler starts.

---

## Current state snapshot

_Date: 2026-06-12_

### Backend (`backend/src/features/status/`)

| File | Role |
|---|---|
| `status.routes.ts` | `GET /api/status/overview` — multi-service detail; **extend with `GET /`** |
| `docker.service.ts` | Docker socket helpers (container list, stats, disk usage) |
| `docker.control.ts` | Service restart via Docker API |

### Backend (`backend/src/`)

| File | Role |
|---|---|
| `index.ts` | App entry: migrations → schedulers → listen; **add `ensureDeviceId()` + shutdown handler** |

### New files to add

| File | Role |
|---|---|
| `backend/src/features/status/device.service.ts` | `getDeviceInfo()` and `ensureDeviceId()` |
| `docs/qa/device-status-gaps.md` | Deferred items |

### Cross-cutting

No new schedulers. No new DB tables (uses existing `settings` table for `device_id`). No frontend changes in Phase 1.

### Open gaps → [device-status-gaps.md](../qa/device-status-gaps.md)

---

## API shape

**`GET /api/status`** response:

```ts
type DeviceStatus = {
  checkedAt: string;           // ISO timestamp
  device: {
    id: string;                // UUID, stable across restarts (stored in settings)
    hostname: string;          // os.hostname()
    platform: string;          // os.platform()
    arch: string;              // os.arch()
    uptimeSeconds: number;     // os.uptime()
    memory: {
      totalBytes: number;
      freeBytes: number;
      usedBytes: number;
    };
    loadAvg: [number, number, number]; // 1m, 5m, 15m — os.loadavg()
  };
  app: {
    running: true;             // always true (if backend responds, it's running)
    setupComplete: boolean;    // from isSetupComplete()
    integritasConfigured: boolean; // from getIntegritasApiKey()
  };
  node: {
    state: "running" | "stopped" | "error" | "unknown"; // from last Minima poller check
    lastCheckedAt: string | null;
  };
};
```

**Minima node state derivation for `GET /api/status`:**

| Value | When |
|---|---|
| `"running"` | Last poller check: Minima container up and RPC ok |
| `"stopped"` | Last poller check: container not running |
| `"error"` | Last poller check: container up but RPC unreachable/failing |
| `"unknown"` | Poller has not run yet since startup |

The status endpoint reads the last recorded poller state (in-memory via `minima-monitoring.ts`) — no fresh RPC call.

---

## Implementation plan

### Phase 1 — Device info service + `GET /api/status` — **not started**

**Goal:** Expose a fast, cheap device summary endpoint the dashboard can call on load without triggering Minima RPC or Docker socket queries.

#### Backend

1. Create `backend/src/features/status/device.service.ts`:
   - `ensureDeviceId()`: read `device_id` from `settings`; if absent, generate `crypto.randomUUID()` and persist it.
   - `getDeviceInfo()`: return `{ id, hostname, platform, arch, uptimeSeconds, memory, loadAvg }` using Node.js `os` module.

2. Update `backend/src/index.ts`:
   - Call `ensureDeviceId()` after `runMigrations()` (settings table is available).
   - Add SIGTERM/SIGINT handler: clear scheduler intervals, close the DB connection, exit cleanly.

3. Update `backend/src/features/status/status.routes.ts`:
   - Add `statusRouter.get("/", ...)` handler.
   - Call `getDeviceInfo()`, `isSetupComplete()`, `getIntegritasApiKey()`, and `getLastMinimaPollerState()` (see step 4).
   - Respond with `DeviceStatus` shape.

4. Update `backend/src/features/minima/minima-monitoring.ts`:
   - Export `getLastMinimaPollerState(): { state: "running" | "stopped" | "error" | "unknown"; lastCheckedAt: string | null }`.
   - The monitoring module already holds `lastPollerCheckAt` and stall data in-memory — add a `lastNodeState` variable updated by `recordPollerCheck()`.

**Files:**
- `backend/src/features/status/device.service.ts` (new)
- `backend/src/features/status/status.routes.ts` (extend)
- `backend/src/features/minima/minima-monitoring.ts` (add `lastNodeState` to snapshot + getter)
- `backend/src/features/minima/minima-poll.service.ts` (pass `status.state` into `recordPollerCheck`)
- `backend/src/index.ts` (ensureDeviceId call + shutdown handler)

**Env:** None. All data comes from `os` module, `settings` table, and in-memory poller state.

**Verification:**

```bash
npm run check
npm --prefix backend run build
```

Manual: `curl -s http://localhost:3000/api/status | python3 -m json.tool` — expect `device`, `app`, `node` fields present. `setupComplete` reflects actual DB state. `node.state` is `"unknown"` before poller runs, then updates.

---

### Phase 2 — Frontend dashboard widget — **not started**

**Goal:** Wire `GET /api/status` into the dashboard so device info and status pills are visible on load.

1. Add `frontend/src/features/status/statusApi.ts` — thin fetch wrapper for `GET /api/status`.
2. Add `frontend/src/features/status/statusTypes.ts` — `DeviceStatus` type mirroring the backend shape.
3. Update `DashboardPage.tsx`:
   - Fetch device status on mount.
   - Show a small card with hostname, uptime, node state pill, and setup state.
   - Use existing `Pill` / `StatusBadge` / `Card` components — no new UI primitives.

**Files:**
- `frontend/src/features/status/statusApi.ts` (new)
- `frontend/src/features/status/statusTypes.ts` (new)
- `frontend/src/pages/DashboardPage.tsx` (extend)

**Verification:** Dev server + browser. Dashboard card shows hostname and node state pill without errors.

---

## Open decisions

| # | Decision | Recommendation / outcome |
|---|---|---|
| 1 | Wallet presence in `GET /api/status` | Defer from Phase 1. The Wallet page handles this; adding Minima RPC to the status call adds latency and a failure mode. Revisit if dashboard explicitly needs it. |
| 2 | `GET /api/status` auth-protected or public? | Keep auth-protected (consistent with `/api/status/overview`). Health check `/api/health` is the public liveness probe. |
| 3 | Device ID source | Generate UUID on first startup, persist in `settings` table as `device_id`. Stable across reboots. |
| 4 | Host CPU/memory approach | Use `os.loadavg()` + `os.totalmem()` / `os.freemem()` — synchronous, no new deps. |
| 5 | SIGTERM handler scope | Stop automation scheduler, Integritas poller, Minima poller intervals. Close SQLite (`db.close()`). Then `process.exit(0)`. |

---

## Verification checklist (phase exit)

### Phase 1

- [ ] `GET /api/status` returns 200 with `device`, `app`, `node` keys after login
- [ ] `device.id` is stable across backend restarts
- [ ] `node.state` transitions from `"unknown"` to `"running"` / `"error"` after first Minima poller tick
- [ ] `app.setupComplete` reflects actual DB state
- [ ] SIGTERM shuts down cleanly (no uncaught error, Docker stop doesn't hang)
- [ ] `npm run check` passes
- [ ] `npm --prefix backend run build` passes
- [ ] `CHANGELOG.md` updated under `[Unreleased]`

### Phase 2

- [ ] Dashboard card visible after login
- [ ] No JS errors in browser console
- [ ] `npm --prefix frontend run build` passes

---

## Changelog & docs

When shipping each phase:

- Add operator-facing notes to `CHANGELOG.md` (`[Unreleased]`).
- Update `README.md` if the new endpoint changes operator-facing API expectations.
- No `SECURITY.md` changes expected — device info (hostname, uptime, OS) is internal to the authenticated session.
- Mark plan **Complete** in `docs/README.md` when all phases ship; move deferred items to `docs/qa/device-status-gaps.md`.

---

## Ticket checklist (tracking copy)

**Backend**

- [x] `device.service.ts` — `ensureDeviceId()` + `getDeviceInfo()`
- [x] `status.routes.ts` — add `GET /` handler
- [x] `minima-monitoring.ts` — add `lastNodeState` to snapshot + export `getLastMinimaPollerState()`
- [x] `minima-poll.service.ts` — pass `status.state` to `recordPollerCheck`
- [x] `index.ts` — `ensureDeviceId()` call + SIGTERM/SIGINT handler

**Frontend**

- [x] `statusApi.ts` + `statusTypes.ts`
- [x] `DashboardPage.tsx` — device status card

**Future / QA**

- [ ] Wallet presence in status (deferred)
- [ ] Health polling cache/scheduler (deferred)
- [ ] Per-step setup status (deferred — out of scope given atomic setup)
- [ ] Unit tests for `device.service.ts` and `status.routes.ts` (deferred to QA)
- [ ] Integration tests for `GET /api/health` (deferred to QA)
