# Update Agent Review Fixes

**Status:** Not started
**Created:** 2026-07-07
**Goal:** Address the findings from the update-agent code review so the update flow actually works on real hardware and the safety guarantees (health checks, rollback) are real, not just documented.

**Related:** [update-service.md](./update-service.md)

---

## Critical — updates fail without these

- [ ] **1. Frontend update: host port conflict.** The candidate container copies `PortBindings` and starts while the old container still holds `${FRONTEND_PORT:-8080}` — Docker refuses with "port is already allocated", so `frontend` can never update. Decide and implement: stop-first path for frontend (accept a few seconds of downtime, like minima), or create-without-ports → health check → stop old → recreate-with-ports. (`update-agent/src/update/service-update.ts`, `createBodyFromInspect` in `docker.service.ts`)
- [ ] **2. Minima rollback is broken.** Three stacked issues in `update-agent/src/update/minima-update.ts`:
  - `rm()` targets the bind-mount point `/minima-data` itself → `EBUSY` mid-restore, after the data dir is emptied and before the old container is restarted. Clear directory *contents* instead, never the mount point.
  - Backup goes to `/minima-data.update-backup` — the container's ephemeral overlay layer, not the host. Multi-GB copy onto the SD card's container layer, lost if the container restarts. Back up to a host-mounted path.
  - Backup is taken while Minima is still running/writing → inconsistent snapshot. Reorder: stop → backup → swap.
  - Also: `stopContainer`/`removeContainer` of the old container sit outside the `try`, so failures there skip the restore entirely.

## High — the safety story is weaker than documented

- [ ] **3. No `HEALTHCHECK` exists for frontend/backend.** `isContainerHealthy` falls back to "is running", so promotion happens even if the new container can't serve. Add real `HEALTHCHECK`s (Dockerfile or compose) for `frontend` and `backend` so rollback-on-failed-health-check actually means something. (`frontend/Dockerfile`, `backend/Dockerfile` or `docker-compose.yml`)
- [ ] **4. Synchronous `/apply` can't survive its own update.** nginx's default 60s proxy timeout will 504 on slow Pi image pulls, and a successful frontend swap kills the in-flight `/apply` response — success reads as failure in the UI. Rework to async: `POST /apply` returns `202` immediately, UI polls a progress endpoint; update the static page's states accordingly. (`update-agent/src/update/apply.routes.ts`, `public/app.js`)

## Medium — hardening

- [ ] **5. Manifest replay/downgrade protection.** Any previously-signed manifest verifies forever — a stale cache or MITM can roll devices back to a vulnerable image. Add a `version` (or `createdAt`) field to the manifest, persist the last-applied value, reject anything not strictly newer. Touches CI (`scripts/release/build-manifest.mjs`, `manifest.source.json`) and the verifier (`update-agent/src/manifest/manifest.service.ts`).
- [ ] **6. Stale candidate container blocks retries.** A crash mid-update (power cut) leaves `<service>-update-candidate` behind; every later attempt 409s on the name. Remove any existing candidate by name before creating. (`update-agent/src/update/service-update.ts`)
- [ ] **7. Verify minima data-dir file ownership on real hardware.** update-agent runs as uid 1000 (`USER node`); if the minima image writes as root, backup fails with `EACCES` (safe, but the feature never works). Add to the "How to test" checklist in [update-service.md](./update-service.md).
- [ ] **8. Auth check timeout.** The forwarded `GET /api/auth/me` fetch has no timeout — a hung backend hangs every update-agent request. Add `AbortSignal.timeout(5000)` like the minima health probe. (`update-agent/src/auth/auth.middleware.ts`)

## Minor

- [ ] **9. Logging.** `/apply` replaces the running product silently. Log each service update start/result so `docker logs update-agent` tells the story after an incident.
- [ ] **10. Pull timeout configurable.** 300s hardcoded in `dockerRequestStream` is optimistic for a Pi on slow broadband — make it an env var alongside the health-check timeouts.
- [ ] **11. `.sig` URL building.** `${manifestUrl}.sig` breaks if the URL ever gains a query string — add a comment or build the URL properly.
- [ ] **12. Error detail leakage.** Raw `error.message` (Docker API bodies, internal paths) goes to the browser. Admin-only audience, but prefer generic message + logged detail.
- [ ] **13. Installer vs. update-agent reconciliation.** Any later `docker compose up -d` (e.g. re-running the installer) recreates containers from the compose file and silently reverts digest-pinned updates. Decide the story (installer pins digests? update-agent is the only updater?) before field use — coordinate with part 6/7 of [update-service.md](./update-service.md).

---

## Suggested order

1 and 2 first (feature-breaking), then 3 and 4 (safety/UX), then 5–8 (hardening), 9–13 opportunistically. Item 1 forces the design decision (stop-first vs. recreate dance) that item 4's async rework builds on — do them in that order.

## Explicitly out of scope

- Anything already out of scope for update-service V1 (zero-downtime, auto-updates, canary).
- Replacing the docker.sock mount with a socket proxy (tracked as an accepted risk in `SECURITY.md`).
