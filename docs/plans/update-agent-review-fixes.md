# Update Agent Review Fixes

**Status:** In progress — all critical, high, and medium code items (#1–6, #8) fixed; #9–13 minor items remain. #7 moved to real-Pi testing (see below), not a code fix.
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

- [x] **5. Manifest replay/downgrade protection.** Added a `createdAt` (ISO timestamp) field to the manifest, stamped at build time and checked against a persisted last-applied value:
  - `scripts/release/build-manifest.mjs` now stamps `createdAt: new Date().toISOString()` on every build (the validation loop skips it — it's not a service digest).
  - New `update-agent/src/manifest/manifest-state.ts`: reads/writes `last-applied-manifest.json` on a new dedicated host bind mount, `UPDATE_AGENT_STATE_DIR` (`./update-agent-state` by default, mounted at `/state`) — added to `docker-compose.yml`, `.env.example`, `README.md`, and `env.ts` (`stateDirInContainer`).
  - `manifest.service.ts`: `Manifest` type and `isManifest()` guard now require `createdAt`; `fetchVerifiedManifest()` rejects any manifest **strictly older** than the last-applied timestamp (equal is allowed — that's just the current, already-applied manifest being re-fetched on a routine status check, not a replay).
  - `apply.service.ts`: records the manifest's `createdAt` as applied only if **no** service update failed — a partial failure must stay retryable against the same manifest, since recording it as "applied" would make a later retry look like a downgrade.
  - Fixed a real bug this surfaced: `status.service.ts` iterated `Object.keys(manifest)` to map manifest keys to compose services — with `createdAt` added to the manifest shape, that loop would have tried to treat `"createdAt"` as a service key too. Replaced with a fixed `MANIFEST_SERVICE_KEYS` tuple exported from `manifest.service.ts`.
  - Verified locally: generated a throwaway Ed25519 keypair, built+signed a test manifest, served it over local HTTP, and exercised `fetchVerifiedManifest`/`recordAppliedManifest` directly — confirmed first fetch succeeds, re-fetching the same applied manifest still succeeds, and a manifest older than the recorded last-applied timestamp is correctly rejected.

  (`scripts/release/build-manifest.mjs`, `update-agent/src/manifest/manifest.service.ts`, `update-agent/src/manifest/manifest-state.ts`, `update-agent/src/status/status.service.ts`, `update-agent/src/update/apply.service.ts`, `update-agent/src/config/env.ts`, `docker-compose.yml`, `.env.example`, `README.md`)
- [x] **6. Stale candidate container blocks retries.** Added `removeContainerByName()` to `docker.service.ts` (force-removes any container matching a name, tolerant of no match) and call it in `updateService()` right before creating the candidate, clearing any `<service>-update-candidate` left behind by a crash mid-update. Minima's flow doesn't use a candidate-name pattern (it creates directly under the real service name after removing the old container), so it isn't affected by this bug and needed no change. Verified live against a real Docker socket: a running stray container and a stopped/never-started stray container were both correctly force-removed, and calling it with no match present was a safe no-op. (`update-agent/src/docker/docker.service.ts`, `update-agent/src/update/service-update.ts`)
- [x] **8. Auth check timeout.** Added `signal: AbortSignal.timeout(5000)` to the forwarded `GET /api/auth/me` fetch, matching the existing minima health probe pattern — a timed-out fetch throws and is caught by the existing `catch` block, returning `502` as before. Verified live: pointed `requireAdmin` at a backend that never responds, confirmed the request now returns `502 Auth check failed` after ~5s instead of hanging indefinitely. (`update-agent/src/auth/auth.middleware.ts`)

## Deferred to real-Pi testing

Not a code fix — can only be checked on real hardware. Moved here so this doc's checkboxes reflect code work only; tracked for real in [update-service.md](./update-service.md)'s Part 7 / "How to test" stage 3.

- **7. Verify minima data-dir file ownership on real hardware.** update-agent runs as uid 1000 (`USER node`); if the minima image writes as root, the backup/restore copy in `minima-update.ts` fails with `EACCES` (safe — the update is just refused — but the feature never actually works). Needs checking against the real `minimaglobal/minima` image on a real Pi.

## Minor

- [ ] **9. Logging.** `/apply` replaces the running product silently. Log each service update start/result so `docker logs update-agent` tells the story after an incident.
- [ ] **10. Pull timeout configurable.** 300s hardcoded in `dockerRequestStream` is optimistic for a Pi on slow broadband — make it an env var alongside the health-check timeouts.
- [ ] **11. `.sig` URL building.** `${manifestUrl}.sig` breaks if the URL ever gains a query string — add a comment or build the URL properly.
- [ ] **12. Error detail leakage.** Raw `error.message` (Docker API bodies, internal paths) goes to the browser. Admin-only audience, but prefer generic message + logged detail.
- [ ] **13. Installer vs. update-agent reconciliation.** Any later `docker compose up -d` (e.g. re-running the installer) recreates containers from the compose file and silently reverts digest-pinned updates. Decide the story (installer pins digests? update-agent is the only updater?) before field use — coordinate with part 6/7 of [update-service.md](./update-service.md).

---

## Suggested order

1 and 2 first (feature-breaking), then 3 and 4 (safety/UX), then 5, 6, 8 (hardening — 7 deferred to real-Pi testing, see above), 9–13 opportunistically. Item 1 forces the design decision (stop-first vs. recreate dance) that item 4's async rework builds on — do them in that order.

## Explicitly out of scope

- Anything already out of scope for update-service V1 (zero-downtime, auto-updates, canary).
- Replacing the docker.sock mount with a socket proxy (tracked as an accepted risk in `SECURITY.md`).
