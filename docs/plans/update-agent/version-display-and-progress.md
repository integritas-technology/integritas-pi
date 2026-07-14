# Version display + pull progress bar

**Status:** Not started.
**Created:** 2026-07-14
**Related:** [update-notification-flow.md](./update-notification-flow.md), [minima-node-update-support.md](../../notes/minima-node-update-support.md), [update-agent-self-update.md](../../notes/update-agent-self-update.md) (deferred, out of scope here)

## Problem

Right now there's no "app version" concept anywhere — only per-service Docker digests, which are meaningless to a user. The update card just says "a new version is ready," with no version numbers shown before or after.

Separately, the update flow shows a static spinner during an update — no real progress, even though Docker's pull API already streams real per-layer download progress that `update-agent` currently discards.

## Part 1: Version display

### Design

- **Source of truth**: the git tag (`github.ref_name`) at CI build time — one value for the whole app, not per-service. Naturally covers real releases, `-test.*`, and `-dev.*` tags with no extra logic.
- **Manifest** gains a `version` field alongside `frontend`/`backend`/`createdAt`.
- **"Current version"** is not derived by comparing service digests — it's whatever version `update-agent` last **successfully applied**, tracked as its own persisted fact (extends the existing `manifest-state.ts`, which already persists `createdAt` for replay/downgrade protection the same way). Avoids ever having to reason about a "mixed state" where frontend/backend are on different digests — frontend/backend independently rebuilding only when changed is purely a CI optimization, invisible to the version concept.
- **"Available version"** is the latest verified manifest's `version` field (already fetched today).
- UI shows `v{current}` normally, `v{current} → v{available}` when they differ.

### Steps

1. `scripts/release/build-manifest.mjs`: add `version: process.env.GITHUB_REF_NAME` (or equivalent) to the manifest object.
2. `.github/workflows/release.yml`: pass `GITHUB_REF_NAME` (already implicitly available as `github.ref_name`) into the "Build manifest" step's env.
3. `update-agent/src/manifest/manifest.service.ts`: add `version: string` to the `Manifest` type and `isManifest()` validation.
4. `update-agent/src/manifest/manifest-state.ts`: extend the persisted state file to also store `version` (not just `createdAt`); add a `getLastAppliedVersion()` read alongside the existing timestamp read.
5. `update-agent/src/update/apply.service.ts`: pass `manifest.version` into `recordAppliedManifest(...)` alongside `createdAt`.
6. Expose both current + available version somewhere the frontend can read — likely extend `/status/summary`'s cached snapshot (`status-poller.ts`) to include `{ currentVersion, availableVersion }`.
7. Frontend: render the version string(s) in the update card (and probably somewhere visible even when up to date, e.g. the sidebar note or settings page — needs a spot decided during implementation).

## Part 2: Pull progress bar

### Design

Docker's `POST /images/create` (image pull) streams newline-delimited JSON progress events, each layer reporting its own `current`/`total` byte counts as it downloads. `update-agent`'s `dockerRequestStream` (`update-agent/src/docker/docker.client.ts`) already receives this stream today but buffers it entirely and only inspects it after the stream ends, discarding all progress data.

Multiple layers download concurrently; progress collapses to one signal by summing bytes across all layers seen so far (`sum(current)` / `sum(total)`), same approach `docker pull`'s own CLI output uses.

### Steps

1. `docker.client.ts`: `dockerRequestStream` parses each line as it arrives (`response.on("data")`, split on newlines as chunks come in) instead of buffering to `response.on("end")`. Accepts an optional `onProgress(line)` callback invoked per parsed JSON line.
2. `docker.service.ts`: `pullImageByDigest` accepts an optional progress callback, forwards it to `dockerRequestStream`.
3. New module (e.g. `update-agent/src/docker/pull-progress.ts`): tracks a `Map<layerId, { current, total }>` for the in-flight pull, exposes a summed snapshot; reset at the start of each service's pull.
4. `service-update.ts`: passes a callback into `pullImageByDigest` that updates the tracker.
5. `apply.job.ts`: `ApplyJobStatus`'s `"running"` variant gains an optional `progress: { service: string; bytesDownloaded: number; bytesTotal: number }` field, read from the tracker.
6. `apply.routes.ts`'s `GET /apply` needs no change — already returns `getApplyJobStatus()` as-is, new field carries through automatically.
7. `update-agent/public/app.js`: render a real `<progress>` element (or percentage) during the `"running"` poll state, using the summed bytes; falls back to the current spinner if no progress data is available yet (e.g. before the first progress event arrives, or for non-pull steps like health-checking).

## Open questions / decide during implementation

- Where exactly the version string is displayed when the app is already up to date (not just inside the update-available card).
- Exact wire shape for progress (percentage vs. raw bytes vs. both) — bytes are more honest (percentage can look stuck near 100% while checksums/extraction finish), worth showing both if simple.

## Out of scope

- `update-agent` self-updating itself (tracked separately: [update-agent-self-update.md](../../notes/update-agent-self-update.md)).
- Minima version display/tracking (Minima is fully excluded from update-agent per [minima-node-update-support.md](../../notes/minima-node-update-support.md)).
