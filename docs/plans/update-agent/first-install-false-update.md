# Fix: false "Update Now" on first install

**Status:** Planned, not started.
**Created:** 2026-07-10
**Related:** [update-service.md](./update-service.md)

## Problem

`install.sh` builds `frontend`/`backend` from source (`docker compose up -d --build`, using `docker-compose.yml`'s `build:` blocks). This produces a local image reference (e.g. a compose-assigned tag), never a `ghcr.io@sha256:...` digest.

`update-agent` compares the running container's image string directly against the manifest's digest string (`update-agent/src/status/status.service.ts:30`). A locally built image can never string-match a registry digest, regardless of whether the underlying code is the same, older, or newer. Result: every fresh install shows "Update Now" immediately, always — a false positive, not a real staleness signal.

## Fix

Stop building `frontend`/`backend` from source in `install.sh`. Pull the exact images the current signed manifest points to, so the installed digest matches the manifest digest from the first boot.

`minima` is unaffected — it's already a fixed external image (`minimaglobal/minima:dev` in `docker-compose.yml`), not built from source, so it's out of scope here.

### Steps

1. `install.sh`: fetch the signed manifest using the existing `MANIFEST_URL` / `MANIFEST_PUBLIC_KEY` env vars (same ones `update-agent` already uses) and verify its signature.
2. Extract the `frontend` and `backend` digests from the verified manifest.
3. Write them into `$APP_DIR/.env` as image refs, e.g.:
   ```
   FRONTEND_IMAGE=ghcr.io/<org>/integritas-pi-frontend@sha256:...
   BACKEND_IMAGE=ghcr.io/<org>/integritas-pi-backend@sha256:...
   ```
4. `docker-compose.yml`: replace `frontend`/`backend`'s `build:` blocks with `image: ${FRONTEND_IMAGE}` / `image: ${BACKEND_IMAGE}`.
5. `install.sh`'s `start_app()`: `docker compose pull && docker compose up -d` (drop `--build`).

No change needed in `update-agent` itself — it already compares live container digest vs. manifest digest on every check; once the installed digest matches, it reports "up to date" with no extra state to write or maintain.

## Dev/test builds

No separate "dev mode" needed. Test builds (e.g. `v0.0.0-test.1`) go through the same tag → CI → signed manifest path as real releases (`v0.12.0`, etc.) — same manifest shape, same signature verification. Switching between testing a test build and a real release is just pointing `MANIFEST_URL` at the manifest for that tag.

## Out of scope

- `minima-node` image sourcing/update path — already fixed/external, not built from source, no false-positive risk today.
- Any change to `update-agent`'s comparison logic — it's correct as-is; the bug is entirely in how `install.sh` provisions images.
