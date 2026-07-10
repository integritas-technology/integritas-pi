# Fix: false "Update Now" on first install

**Status:** Done. Verified end-to-end on real Pi hardware via QA manifest (v0.0.0-test.2).
**Created:** 2026-07-10
**Related:** [update-service.md](./update-service.md)

## Problem

`install.sh` builds `frontend`/`backend` from source (`docker compose up -d --build`, using `docker-compose.yml`'s `build:` blocks). This produces a local image reference (e.g. a compose-assigned tag), never a `ghcr.io@sha256:...` digest.

`update-agent` compares the running container's image string directly against the manifest's digest string (`update-agent/src/status/status.service.ts:30`). A locally built image can never string-match a registry digest, regardless of whether the underlying code is the same, older, or newer. Result: every fresh install shows "Update Now" immediately, always — a false positive, not a real staleness signal.

## Fix

Stop building `frontend`/`backend` from source in `install.sh`. Pull the exact images the current signed manifest points to, so the installed digest matches the manifest digest from the first boot.

`minima` is unaffected — it's already a fixed external image (`minimaglobal/minima:dev` in `docker-compose.yml`), not built from source, so it's out of scope here.

### Steps (all done)

1. `install.sh`: fetch the signed manifest via `MANIFEST_URL` (new default: `https://integritas.technology/update-manifest/manifest.json`, overridable), verify with `openssl pkeyutl` against the committed `update-agent/manifest-public-key.pem` — no new host dependency, `openssl` was already installed.
2. Extract `frontend`/`backend` digests from the verified manifest with `grep`/`sed` (no `jq` added, per "no new tools").
3. Written into `$APP_DIR/.env` as `FRONTEND_IMAGE`/`BACKEND_IMAGE`.
4. `docker-compose.yml`: `frontend`/`backend` `build:` blocks replaced with `image: ${FRONTEND_IMAGE}` / `image: ${BACKEND_IMAGE}`.
5. `install.sh`'s `start_app()`: `docker compose pull frontend backend && docker compose up -d` (dropped `--build`).

No change needed in `update-agent` itself — confirmed correct as-is; it already compares live container digest vs. manifest digest on every check.

### Unplanned fix found during testing

CI (`release.yml`) built `frontend`/`backend` only for the runner's native `linux/amd64` — invisible previously because `install.sh` built from source on-device. Once install pulled pre-built images, a real Pi (`aarch64`) failed with "no matching manifest for linux/arm64/v8". Fixed by adding `docker/setup-qemu-action` + `platforms: linux/arm64,linux/arm/v7` to both build steps, covering all Pi variants `install.sh` already claims to support (64-bit and 32-bit).

## Dev/test builds

No separate "dev mode" needed. Test builds (e.g. `v0.0.0-test.1`) go through the same tag → CI → signed manifest path as real releases (`v0.12.0`, etc.) — same manifest shape, same signature verification. Switching between testing a test build and a real release is just pointing `MANIFEST_URL` at the manifest for that tag.

## Out of scope

- `minima-node` image sourcing/update path — already fixed/external, not built from source, no false-positive risk today.
- Any change to `update-agent`'s comparison logic — it's correct as-is; the bug is entirely in how `install.sh` provisions images.
