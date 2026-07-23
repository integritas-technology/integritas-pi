# Minima Restart/Resync Status Plan

**Status:** Not started
**Created:** 2026-07-22
**Goal:** Stop the Minima container restart/resync flow from surfacing raw technical errors or a misleading "Error" state elsewhere in the app, by tracking "an operation is in progress" as durable backend state instead of page-local React state.

## Context

Triggering a Minima container restart or megammr resync from the Minima page currently produces two confusing symptoms:

1. Raw technical error text leaks through — e.g. "This operation was aborted" — when `resyncMegammr()`'s 30s RPC timeout fires. Only the `/status` route's error path runs messages through `normalizeMinimaRpcError()` (→ "Minima RPC is temporarily unreachable"); `/restart`, `/peers/add`, `/peers`, `/balance`, `/megammrsync/resync` don't.
2. The Dashboard's "Node status" tile independently polls `/api/status` (fed by a separate backend poller, `pollMinimaHealth()`, every 60s) and shows "Error" during a real restart window — technically true (RPC is briefly unreachable) but reads as broken, then flips to "Running" with no "it's back" signal. This is disconnected from the page-local `resyncing`/`restarting` React state already built into `MinimaPage.tsx` (which only exists while that page is mounted and is destroyed on navigation — though the backend operation itself is never cancelled by navigating away, since SPA route changes don't abort in-flight `fetch()` calls).

Root cause: the "an operation is in progress, expect brief RPC unavailability" signal only exists as local frontend state on one page. Per this repo's architecture rule (shared behavior belongs in the backend, not duplicated per-frontend-page), it needs to live server-side so any consumer — the Dashboard tile, a freshly-mounted Minima page after navigating back — can show "Restarting" instead of a raw error, regardless of which page is open.

This plan does both agreed pieces: friendlier error messages everywhere, and a durable backend-side operation flag. The existing page-local `refreshing`/LoadingDots mechanism (built earlier) stays as-is — it's the fast, correct, in-page feedback; this is additive for everyone else.

## Backend changes

**`backend/src/features/minima/minima.types.ts`** — extend the state union:
```ts
export type MinimaNodeState = "running" | "stopped" | "error" | "restarting";
```

**`backend/src/features/minima/minima-monitoring.ts`** — unify `lastNodeState`'s type with `MinimaNodeState` (currently an independently-declared duplicate union) by importing it instead of re-declaring, and add operation tracking using the same in-memory module-state pattern already used for `snapshot` (no SQLite):
```ts
import type { MinimaNodeState, MinimaNodeStatus } from "./minima.types.js";
// MinimaMonitoringSnapshot.lastNodeState: MinimaNodeState | "unknown"

export type MinimaOperationType = "restart" | "resync";
const MINIMA_OPERATION_MAX_WINDOW_MS = 120_000;
let currentOperation: { type: MinimaOperationType; startedAt: number } | null = null;

export function beginMinimaOperation(type: MinimaOperationType) { currentOperation = { type, startedAt: Date.now() }; }
export function endMinimaOperation() { currentOperation = null; }
export function isMinimaOperationInProgress(): boolean {
  if (!currentOperation) return false;
  if (Date.now() - currentOperation.startedAt > MINIMA_OPERATION_MAX_WINDOW_MS) { currentOperation = null; return false; }
  return true;
}
```

**`backend/src/features/minima/minima.service.ts`**:
- Import `beginMinimaOperation`, `endMinimaOperation`, `isMinimaOperationInProgress` from `./minima-monitoring.js`.
- Add an override helper near `deriveNodeState` (~line 35):
  ```ts
  function applyOperationOverride(state: MinimaNodeState): MinimaNodeState {
    if (state === "running") { endMinimaOperation(); return state; }
    return isMinimaOperationInProgress() ? "restarting" : state;
  }
  ```
  Overriding both `"stopped"` and `"error"` (not just error) matters: during a real restart, Docker's own state can transiently read non-`"running"`, which currently maps to `"stopped"` — the override needs to catch that too.
- Apply it at both places `state` is computed in `getMinimaNodeStatus()`:
  - `"failed" in rpcResult` branch (~line 66): `const state = applyOperationOverride(containerStats && containerStats.state !== "running" ? "stopped" : "error");`
  - success branch (~line 122): `const state = applyOperationOverride(deriveNodeState(containerStats, rpcReachable, parsed.rpcOk));`
- `resyncMegammr()` (~line 166-170) and `restartMinimaContainer()` (~line 191-193): wrap with begin/clear-on-throw-only (success rides out until RPC recovery or the 120s expiry, since real instability happens *after* the call returns):
  ```ts
  export async function resyncMegammr() {
    const { megammrHost } = getMinimaConfig();
    const command = `megammrsync action:resync host:${megammrHost}`;
    beginMinimaOperation("resync");
    try {
      return await runMinimaPathCommand(command, 30000);
    } catch (error) {
      endMinimaOperation();
      throw error;
    }
  }

  export async function restartMinimaContainer() {
    beginMinimaOperation("restart");
    try {
      return await restartComposeService("minima");
    } catch (error) {
      endMinimaOperation();
      throw error;
    }
  }
  ```
  (Confirmed `restartComposeService` in `docker.control.ts` returns immediately after issuing the Docker restart POST, well before the container is actually healthy — so "clear only on throw" is correct.)
  Bonus: `pollMinimaHealth()`'s auto-resync path also calls `resyncMegammr()`, so auto-resync gets the same "Restarting" treatment everywhere for free.

**`backend/src/features/minima/minima.routes.ts`** — import `normalizeMinimaRpcError` from `./minima.errors.js` and apply it in the catch blocks that currently use the raw message, for `/peers`, `/peers/add`, `/restart`, `/balance`, `/megammrsync/resync` (leave `/config`, `/config POST`, and `/status` untouched — config errors aren't RPC/network errors, and `/status`'s catch is already effectively dead code since `getMinimaNodeStatus()` no longer throws past its own internal guards). Pattern:
```ts
const message = normalizeMinimaRpcError(error instanceof Error ? error.message : "Unknown error");
```

## Frontend changes

- **`frontend/src/app/types.ts`**: `MinimaNodeState = "running" | "stopped" | "error" | "restarting"`.
- **`frontend/src/features/status/statusTypes.ts`**: `DeviceNodeState = "running" | "stopped" | "error" | "restarting" | "unknown"`.
- **`frontend/src/features/minima/minimaFormat.ts`** `formatNodeState()`: add `if (state === "restarting") return "Restarting";` before the final `"Error"` fallback. (`nodeStateIsHealthy()` needs no change.)
- **`frontend/src/pages/DashboardPage.tsx`** `nodeStateValueClass()` (~line 266): add `if (state === 'restarting') return 'text-blue-600';` before the `'unknown'` check — blue matches this app's existing "info/in-progress" color (`ToastProvider`'s info tone also uses `bg-blue-600`), keeping it visually distinct from the amber error catch-all. The tile label (`node.state.charAt(0).toUpperCase() + ...`) needs no change — auto-capitalizes to "Restarting".

No other frontend files need changes — confirmed via grep that `MinimaHealthCard.tsx`/`MinimaContainerCard.tsx`/`MinimaPage.tsx` only branch on their own local `refreshing`/`busy`/`resyncing`/`restarting` state, not on `MinimaNodeState` directly; that page-local mechanism from earlier this session is left untouched.

## Explicitly out of scope

- `MinimaSyncStatus`/`deriveSyncStatus` — unrelated to this complaint (the Dashboard doesn't show sync status; the Minima page's sync card is already covered by the local `refreshing` mechanism).
- CLI (`bin/integritas-pi`).
- No new polling — Dashboard's existing 30s `/api/status` interval is sufficient once the backend reports the right state.

## Verification

1. `npm run check`, `npm --prefix backend run build`, `npm --prefix frontend run build`.
2. Rebuild and redeploy the already-running local compose stack (`docker compose build backend frontend && docker compose up -d`), then against `https://localhost:8080`:
   - Trigger a restart from the Minima page, immediately navigate to Dashboard — "Node status" should read "Restarting" (blue), not "Error" (amber), during the window, then flip to "Running" within one 30s poll cycle once healthy.
   - Trigger a resync; if the 30s timeout reproduces, confirm the toast now reads "Minima RPC is temporarily unreachable" instead of the raw abort message.
   - While a restart/resync is in flight, open a fresh tab/reload the Minima page — it should show "Restarting" calmly on first paint, not a raw error flash.
   - Directly `docker stop` the minima container (no UI-triggered operation) and confirm it still correctly shows "Stopped"/"Error" — the override must only fire when `beginMinimaOperation()` was actually called.
