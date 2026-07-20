# update-agent as a built image + self-update

**Status:** Done. Both parts implemented and confirmed working end-to-end on a real Pi (version arrow + debug markers across frontend/backend/update-agent all correct after an update).
**Created:** 2026-07-15
**Related:** [update-agent-self-update.md](../../notes/update-agent-self-update.md) (the deferred note this plan resolves), archived [update-service.md](./archive/update-service.md) (original design — `update-agent` deliberately excluded from the manifest in V1)

## Problem

`update-agent` currently builds from source on the Pi (`docker-compose.yml`'s `build: { context: ./update-agent }`), unlike `frontend`/`backend` which are built once in CI and pulled as images. It's also not in the manifest, so it has no version tracking and no update path — bumping it means a manual reinstall/rebuild.

Goal: bring `update-agent` in line with `frontend`/`backend` (built in CI, pulled as a pinned-digest image, tracked in the manifest), and let it update itself through the same "Update Now" flow — without adding a permanent 5th container to the stack.

## Design

### Part A: build + track as an image

Same shape as `frontend`/`backend`, nothing new conceptually:

- CI builds and pushes `ghcr.io/.../integritas-pi-update-agent:<tag>`, same platforms (`linux/arm64`, `linux/arm/v7`).
- Manifest gains an `updateAgent` digest field alongside `frontend`/`backend`.
- `docker-compose.yml` switches update-agent from `build:` to `image:`.
- `update-agent` keeps its own manifest key, **not** added to `MANIFEST_SERVICE_KEYS` — that array drives the generic pull/health-check/swap loop in `service-update.ts`, which assumes an external actor (update-agent) is doing the swapping. update-agent updating itself needs different handling (Part B), so it gets its own code path instead of being folded into that loop.

### Part B: self-update, no standing watchdog

**Researched first** (see conversation — Watchtower is the closest real-world precedent for this exact problem; Portainer's answer is "don't automate it, do it manually"). Chosen approach: Watchtower's "ephemeral orchestrator" pattern, not a permanent 5th container.

Core rule: the **old** update-agent never kills itself. A **new**, freshly-started instance always does the work of retiring its predecessor — only after proving itself healthy. If the new instance never becomes healthy, the old one is simply never touched — no rollback logic needed, because nothing was destroyed.

Flow:
1. Running update-agent notices `manifest.updateAgent`'s digest differs from its own running image (checked after the normal frontend/backend update completes).
2. Pulls the new update-agent image.
3. Launches a **one-shot container** from that new image, using the existing `docker.sock` access, with a special command override (not the normal server entrypoint) — e.g. `node dist/self-update/orchestrator.js`. This is not a service in `docker-compose.yml` and never appears in `docker compose ps` at rest — it's spawned on demand and removes itself (`--rm`-equivalent) when done.
4. The orchestrator: starts a candidate container from the new image (reusing the create/start logic already in `service-update.ts`) → health-checks the candidate (reusing `waitForHealthy`) → on success: stops+removes the old update-agent, renames candidate into place → on failure: logs and exits, leaves the old container running untouched.
5. Visibility: extend the existing service status list (`status.service.ts`) with an `update-agent` entry using the same `upToDate` digest comparison already used for `frontend`/`backend`. If the self-update never runs or fails, this shows up in the same list the UI already renders — no separate "stuck" mechanism needed.

### Why not other options (for future reference, don't re-litigate)

- **Standing 5th watchdog container**: rejected — permanent complexity for something that happens rarely (update-agent's own code changes far less often than frontend/backend).
- **Old container updates itself directly, no orchestrator** (naive self-swap): rejected — relies on the brand-new, unproven container correctly detecting and retiring its own predecessor. If the new image is broken enough to never get that far, there's no safety net.
- **Fully manual (Portainer's answer)**: considered, rejected in favor of automatic — the convenience of one-click "Update Now" covering update-agent too outweighs the small added complexity, especially since the existing `-dev.*`/`-test.*` tag pipeline already acts as a canary/testing path before any image reaches a real release tag.

## Steps

1. `.github/workflows/release.yml`: add `update-agent` build/push step (mirrors frontend/backend), add to `changes` job's path filter and `build` job's outputs.
2. `scripts/release/build-manifest.mjs`: accept `UPDATE_AGENT_DIGEST` env, add `updateAgent` field + validation.
3. `update-agent/src/manifest/manifest.service.ts`: add `updateAgent: string` to `Manifest` type + `isManifest()`.
4. `docker-compose.yml`: update-agent switches from `build:` to `image:` (pinned/versioned like frontend/backend already are).
5. `update-agent/src/self-update/orchestrator.ts`: new one-shot entrypoint — start candidate → health-check → swap or bail, per Design above.
6. `update-agent/Dockerfile`: no structural change — same image, just invoked with a different `CMD` override for the orchestrator path.
7. Wire the trigger: after a normal apply job succeeds, if `manifest.updateAgent` differs from the running image, pull it and launch the orchestrator (new code in `apply.service.ts` or a new `self-update.service.ts`).
8. `status.service.ts`: add `update-agent` to the rendered service list using the same digest-comparison `upToDate` check as frontend/backend.
9. Test end-to-end on a real/test Pi using the existing `-dev.*`/`-test.*` tag pipeline before any real `v*` release touches update-agent.
10. CHANGELOG entry once done.

## Out of scope

- Zero-downtime self-update (same short-downtime tradeoff already accepted for frontend/backend).
- Percentage-based/staged canary rollout — the existing dev/test tag branches already serve this purpose at this fleet size.
- Any change to `minima-node`'s update handling (unrelated, out of scope per [minima-node-update-support.md](../../notes/minima-node-update-support.md)).
