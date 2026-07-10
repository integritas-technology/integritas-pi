# Update notification flow: polling, navbar badge, redirect

**Status:** Not started.
**Created:** 2026-07-10
**Related:** [manifest-public-key-unused-file.md](./manifest-public-key-unused-file.md), archived [update-service.md](./archive/update-service.md) (original design; `/status`, `/apply`, health-check/rollback, and the update-agent static UI + nginx `/update` proxy already exist and work standalone per that plan)

## Current state (confirmed in code)

- `update-agent` has a working `GET /status` (verifies manifest, compares live container digests) and `POST /apply` + `GET /apply` (start/poll an update job), both gated by `requireAdmin` (forwards session cookie to product `backend`'s `/api/auth/me`, requires `role === "admin"`).
- `update-agent` has its own static single-page UI (`update-agent/public/`) served through the product `frontend`'s nginx at `/update` (`location /update/ { proxy_pass http://update-agent:8081/; }`).
- Nothing polls `/status` automatically — it's request-only, no scheduler in `update-agent/src`.
- The product `frontend` (`frontend/src`) has zero awareness of `update-agent` — no navbar badge, no link to `/update`.
- `update-agent/manifest-public-key.pem` is committed but unused; `MANIFEST_PUBLIC_KEY` env var is the actual source of truth. Tracked separately in [manifest-public-key-unused-file.md](./manifest-public-key-unused-file.md) — do that fix as part of this work since we're touching update-agent's manifest handling anyway, but keep it a separate commit/entry.

## Scope

1. `update-agent` periodically checks the manifest on its own (not just on-demand), caching the last result in memory.
2. Product `frontend` navbar shows a badge when an update is available, admin-only, linking to `/update` (no auto-redirect).
3. `/update` (existing update-agent UI) is where the user watches progress and triggers the update — no new page needed here.
4. On success, user ends up back in the app on the new version. On failure, old containers keep running (already handled by existing rollback logic in `apply.job.ts`).

## Design

### 1. Polling inside update-agent

- New `src/status/status-poller.ts`: `setInterval` wrapping `getUpdateStatus()`, caches `{ manifest, services, checkedAt }` in memory (module-level variable, no new persistence — matches existing `manifest-state.ts`'s minimal-state approach).
- Interval controlled by a new env var, e.g. `STATUS_POLL_INTERVAL_MS` (default something like 86400000 for prod/1 day; override to e.g. 300000–600000 for QA/testing — no code branching on environment, just a different `.env` value).
- `GET /status` changes from "always fetch live" to "return cached result, refresh in background if stale" — or simplest: keep `GET /status` doing a live fetch (cheap, already works, no behavior change/regression risk) and add the poller purely to detect and cache "is an update available" for the frontend badge check. Decide exact split during implementation; default to minimal change unless testing surfaces a reason not to.
- Skip starting the poller if `MANIFEST_URL`/`MANIFEST_PUBLIC_KEY` aren't configured (same guard `fetchVerifiedManifest` already has) — log once, don't crash-loop.

### 2. Frontend navbar badge

- Add `update` to `NavId` union (`frontend/src/app/types.ts`) and an entry in `frontend/src/app/nav.ts` — `NavItem` already supports an optional `badge` field, `AppShell.tsx` desktop nav already renders it (mobile nav doesn't yet — add that too).
- New hook `frontend/src/features/update/useUpdateStatusRefresh.ts`, same shape as `useMinimaStatusRefresh.ts` (interval + fetch + `enabled` flag). Only enabled for admin users (existing role check, wherever current user role is already available — likely already in context/hook used elsewhere for admin-gated UI).
- Calls update-agent's existing `GET /status` through the nginx proxy path (likely needs a `/update/status` fetch path, or check whether `backend` should proxy it instead — verify existing proxy path handles this cleanly before deciding).
- On `upToDate: false` for any service, show badge (e.g. "1" or a dot) on the nav item; clicking it navigates to `/update` (existing update-agent UI takes over from there).

### 3. Redirect after successful update

- Already handled: `update-agent/public/app.js` (per archived plan) already does "success auto-redirect" back to the app. Confirm this still works — no new code expected here, just a verification step during testing.

### 4. manifest-public-key.pem fix (folded in)

- `update-agent/src/config/env.ts`: read the PEM from `update-agent/manifest-public-key.pem` (bundled into the image, same as today) instead of `MANIFEST_PUBLIC_KEY` env var.
- Remove `MANIFEST_PUBLIC_KEY` from `.env.example`, `docker-compose.yml`, and root `install.sh` if referenced.

## Steps

1. `update-agent`: add polling loop + cache (`status-poller.ts`), new `STATUS_POLL_INTERVAL_MS` env var, wire into `src/index.ts` startup.
2. `update-agent`: switch to reading `manifest-public-key.pem` directly, drop `MANIFEST_PUBLIC_KEY`.
3. Frontend: add `update` nav item + badge rendering (mobile nav parity), new polling hook, admin-only gating.
4. Wire nginx/proxy path so the frontend can reach update-agent's `/status` for the badge check (confirm exact path — may already work via `/update/status` given existing proxy block).
5. `.env.example`, `docker-compose.yml`, `install.sh`: add `STATUS_POLL_INTERVAL_MS`, remove `MANIFEST_PUBLIC_KEY`.
6. Test on real Pi: confirm badge appears when QA manifest is bumped, click-through to `/update` works, update completes, redirect back to app lands on new version with badge gone.
7. CHANGELOG entry once done.

## Out of scope

- Auto-redirect without a click (explicitly decided against — badge/link only).
- Non-admin visibility of update status.
- Any change to `/apply`'s update/rollback/health-check logic — already built and working.
- Staged/canary rollout, zero-downtime updates — unchanged from original plan's exclusions.
