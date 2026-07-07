# Update Agent Review Fixes

**Status:** In progress — both critical items and both high items (#3 real HEALTHCHECKs, #4 async /apply) fixed; medium/minor items remain
**Created:** 2026-07-07
**Goal:** Address the findings from the update-agent code review so the update flow actually works on real hardware and the safety guarantees (health checks, rollback) are real, not just documented.

**Related:** [update-service.md](./update-service.md)

---

## Critical — updates fail without these

- [x] **1. Frontend update: host port conflict.** Fixed via create-without-ports → health-check → stop old → recreate-with-ports. `createBodyFromInspect` now takes an `includePortBindings` flag (default `false`); `updateService` creates and health-checks the candidate with no port bindings, then — only for services that publish host ports — stops/removes the old container, recreates the candidate with `PortBindings`, and starts it. If that final port-bound start fails, it best-effort restores the old container from its inspect data instead of leaving the service down. Old container keeps serving during the entire pull/start/health-check window; the only unavoidable gap is the brief stop-old → recreate-with-ports swap itself. (`update-agent/src/update/service-update.ts`, `createBodyFromInspect` in `docker.service.ts`)
- [x] **2. Minima rollback is broken.** Fixed all three issues in `update-agent/src/update/minima-update.ts`:
  - Backup/restore now goes through a new `clearDirContents()` helper that only removes a directory's *children* (via `readdir` + per-entry `rm`), never the directory/mount point itself — no more `EBUSY` on the bind mount root.
  - Backup now lands on a new dedicated host bind mount, `MINIMA_BACKUP_DIR` (`./minima-backup` by default, mounted at `/minima-backup` in `update-agent`), separate from the live `/minima-data` mount — not a sibling path inside the container's ephemeral layer. Added to `docker-compose.yml`, `.env.example`, `README.md`, and `env.ts` (`minimaBackupDirInContainer`).
  - Flow reordered: stop old container → backup (now-quiescent) data dir → create/start new → health-check. Backup is never taken while Minima is still writing.
  - Stop/remove of the old container now happen *before* any backup is taken (not inside the try), so there's no window where a stop/remove failure leaves us mid-flow with nothing to restore — if they fail, the function just aborts before touching the data dir or creating anything new.

  (`update-agent/src/update/minima-update.ts`, `update-agent/src/config/env.ts`, `docker-compose.yml`, `.env.example`, `README.md`)

## High — the safety story is weaker than documented

- [x] **3. No `HEALTHCHECK` exists for frontend/backend.** Added real `HEALTHCHECK`s:
  - `backend/Dockerfile`: `node -e "fetch('http://127.0.0.1:3000/api/health')..."` (no `curl`/`wget` in the `node:20-bookworm-slim` base image, so a plain Node script hits the existing public `/api/health` route).
  - `frontend/Dockerfile`: `curl -kfs https://127.0.0.1/` (nginx:alpine has `curl`; `-k` because it's the self-signed cert).
  - Both `--interval=15s --timeout=5s --start-period=10s --retries=3`. `isContainerHealthy`/`waitForHealthy` in `docker.service.ts` already preferred `State.Health.Status` over the "is running" fallback — no code change needed there, just the Dockerfile directives to make a real `Health` block exist.
  - Bumped `UPDATE_HEALTH_CHECK_TIMEOUT_MS` default 30000 → 60000 (`env.ts`, `docker-compose.yml`, `.env.example`, `README.md`): the old 30s default assumed "is it running" (near-instant); against a real `start-period=10s, interval=15s` schedule the first real health result can land ~25s in, which was too tight a margin.
  - Verified locally: built both images, ran the full compose stack, confirmed `docker inspect --format '{{.State.Health.Status}}'` reports `healthy` for both after `start-period`, with each check completing in well under a second — negligible overhead for a Pi.

  (`backend/Dockerfile`, `frontend/Dockerfile`, `update-agent/src/config/env.ts`, `docker-compose.yml`, `.env.example`, `README.md`)
- [x] **4. Synchronous `/apply` can't survive its own update.** Reworked to async:
  - New `apply.job.ts` holds in-memory job state (`idle` / `running` / `succeeded` + results / `failed` + error) and `startApplyJob()`, which kicks off `applyUpdates()` in the background without awaiting it.
  - `apply.routes.ts`: `POST /apply` now starts the job and returns `202` immediately (or `409` if one's already running) — no longer blocks on the update itself. `GET /apply` returns the current job status for polling.
  - `public/app.js`: `applyUpdate()` now POSTs to start, then polls `GET /apply` every 3s until the job leaves `running`. Poll *failures* (e.g. the exact moment frontend's nginx restarts mid-swap) are tolerated up to 10 consecutive misses before giving up, since a successful frontend update necessarily kills the in-flight poll connection too.
  - Verified locally (bypassing Docker/manifest, which are out of scope for this change): built the compiled routes, ran them standalone, confirmed `POST /apply` returns in ~50ms regardless of job duration, a concurrent `POST` while running returns `409`, and polling `GET /apply` correctly transitions `running` → `succeeded`/`failed` with the right payload.

  (`update-agent/src/update/apply.job.ts`, `update-agent/src/update/apply.routes.ts`, `update-agent/public/app.js`)

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
