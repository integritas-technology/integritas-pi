# Update Service Plan

**Status:** Not started
**Created:** 2026-07-06
**Goal:** V1 manual "Update Now" flow for `frontend`, `backend`, and a pinned `minima-node` digest, driven by a signed manifest built in CI and applied by a new `update-agent` container.

**Related:** [security-checklist.md](./security-checklist.md)

---

## Design summary (agreed)

- 4 containers total: `frontend`, `backend`, `minima`, `update-agent`. No 5th container.
- `update-agent` is its own service (own small HTTP API + one static status page), separate from the product `backend`/`frontend` code.
- Manifest: signed JSON, `{ "frontend": "sha256:...", "backend": "sha256:...", "minima-node": "sha256:..." }`.
- Signing keypair generated once, manually. Private key lives only in GitHub Actions Secrets. Public key committed to the repo and baked into `update-agent`'s image.
- `minima-node`'s digest is a normal manifest entry, manually maintained in a repo source file (e.g. `manifest.source.json`) that CI reads; CI fills in `frontend`/`backend` digests from what it just built and leaves `minima-node` untouched, then signs. Bumping the trusted Minima version later is a one-line PR to that file.
- Manifest served from the existing Next.js VPS app, deployed by CI via a dedicated low-privilege VPS user scoped to one folder.
- `update-agent` has its own `docker.sock` mount. Product `backend`'s existing socket use is untouched.
- `update-agent`'s UI is reached through the **existing product `frontend` nginx**, same cert, same port (`${FRONTEND_PORT:-8080}/update`) — one added `location` block, same pattern as the existing `/api` → `backend` block. Same origin means no extra browser cert approval.
- Only 2 images kept on disk per service (current + previous).
- No reverse proxy / zero-downtime — short downtime during update is accepted for V1.

### Why `update-agent` doesn't terminate its own TLS

A separate port is a separate browser origin even with an identical cert file — it would still prompt a second self-signed approval. To avoid that, `update-agent` must be reached through the same origin as the main app, i.e. through `frontend`'s nginx.

### Why `frontend`'s nginx doesn't go down during a `frontend` update

Every service update in this plan follows: start the new container → confirm its health check → only then stop the old one. Applied to `frontend` itself, the old container (nginx included) keeps serving `/update` until the new one is confirmed healthy. The only gap is the container swap itself (milliseconds), not the update duration — same short-downtime tradeoff already accepted elsewhere in this plan.

### docker.sock exposure

Not mapping `docker.sock` to a host port only stops remote/network attackers — it doesn't reduce what the mount grants to whatever process holds it. Any code in a container with that mount can launch a privileged/host-mounted container and gain host root. The real risk is a compromise of `update-agent` itself (its manifest parsing or HTTP handling), not network reachability of the socket.

Mitigation is shrinking `update-agent`'s own attack surface, not network placement:
- No general dependency surface beyond pulling images, verifying signatures, and a tiny status API.
- No endpoints beyond `/status` and `/apply` (plus its one static page).
- Treat "`update-agent` compromised → Pi compromised" as an accepted risk, documented in `SECURITY.md`.
- Deliberately **not** merged with nginx/TLS-termination duties — keeping the `docker.sock` holder and the public-facing routing layer as separate processes means a bug in one doesn't hand you the other.

---

## Parts

### 1) GitHub Actions flow (workflow structure)

- [x] `dev` branch workflow: run `npm run check` on PR into `dev`. No build/push. (`.github/workflows/check-dev.yml`)
- [x] `main` branch workflow: same checks on PR into `dev` → `main`. No build/push. (`.github/workflows/check-main.yml`)
- [x] Tag-triggered release workflow (`v*` tag push only): job structure in place (`.github/workflows/release.yml`); build/sign/deploy step contents are part 2.
- [x] Path filters so a tag release only rebuilds `frontend`/`backend` images whose folder changed since the last release tag. (`changes` job in `release.yml`, diffs against previous `v*` tag)
- [ ] Branch protection on `main`: required reviews, required status checks, no direct pushes (manual one-time repo setting). Deferred — no `dev` branch yet, still in active development.
- [x] Version bump command: standard `major.minor.patch` via `npm version <major|minor|patch>` at repo root — already the existing convention (`v0.12.0` etc.), nothing new needed.

### 2) GitHub Actions scripts (the release job itself)

- [ ] Build step: `docker build` for changed services, push to `ghcr.io/<org>/...` by digest.
- [ ] Manifest build step: read `manifest.source.json`, overwrite `frontend`/`backend` digests with freshly pushed digests, leave `minima-node` as-is.
- [ ] Sign step: sign the resulting manifest with the private key from GitHub Actions Secrets; key never written to a file that survives the job.
- [ ] Deploy step: push signed manifest (+ signature) to the VPS Next.js app via the dedicated low-privilege deploy user.
- [ ] One-time setup: generate the signing keypair, register the private key as a GH secret, commit the public key into the repo/`update-agent`.
- [ ] Decide the signature format/tool up front (e.g. minisign vs. plain Ed25519 + node `crypto`) so CI and `update-agent`'s verifier agree.

### 3) update-agent service

- [ ] New top-level service folder `update-agent/` (sibling to `backend`/`frontend`), own `package.json`/`Dockerfile`.
- [ ] Small HTTP service: `GET /status`, `POST /apply`, plus the static page from part 4. No other endpoints.
- [ ] Fetch manifest from VPS, verify signature against the embedded public key.
- [ ] Compare manifest digests vs. running container image digests (own `docker.sock`, same raw HTTP-over-socket pattern as `backend/src/features/status/docker.control.ts`).
- [ ] Per-service update flow: pull by digest → start new container → health check → success: stop+remove old, keep only 2 images; failure: stop new, leave old running.
- [ ] Minima-node path: back up data dir → stop old → start new → health check → on failure restore backup + restart old. Manually-approved digest only.
- [ ] Auth: reuse existing session auth so only logged-in admins can trigger/view updates — decide whether `update-agent` validates the same session cookie/`APP_SECRET` as `backend` or needs its own check (open question).
- [ ] Release channel (`stable`/`beta`) read from local config/env — no gradual rollout logic in V1.
- [ ] Self-update: decide ordering so `update-agent` isn't stopping itself mid-update.
- [ ] Keep this service's code surface minimal (see docker.sock exposure above).

### 4) update-agent's single-page UI

- [ ] Plain static HTML + small vanilla JS — no React/build step.
- [ ] Served by `update-agent` itself over plain HTTP (TLS is terminated once, upstream, by `frontend`'s nginx): banner "Update available → Update Now", status page "Updating... please wait", success auto-redirect, failure shows rollback message then redirect.
- [ ] Talks only to `update-agent`'s own `/status` and `/apply` — never calls product `backend`.
- [ ] Reached by the browser at `https://pi-ip:8080/update` — same origin/cert as the main app, no extra approval.

### 5) Docker Compose wiring

- [ ] Add `update-agent` service: own build context, own `docker.sock` mount + `group_add: DOCKER_GID`, `expose` only (no host port), same `integritas` network.
- [ ] `frontend/nginx.conf`: add `location /update` proxying to `update-agent` (mirrors existing `location /api` → `backend`).
- [ ] Env vars: manifest URL, release channel, public key path/embedded, health check timeouts — follow existing `.env.example` conventions.
- [ ] `.env.example` + README updates for any new required vars.

### 6) Cleanup / hardening pass

- [ ] `SECURITY.md`: signing key handling; `update-agent`'s `docker.sock` access as host-root-equivalent regardless of network exposure (accepted risk, mitigated by minimal code surface, not by network placement).
- [ ] `AGENTS.md`: new "Update Agent" section once the shape settles.
- [ ] `CHANGELOG.md` entries under `[Unreleased]` as each part lands.
- [ ] `docs/README.md` — add this plan to the "Active plans" table.
- [ ] End-to-end manual test on a real Pi: trigger update, confirm rollback on an intentionally-broken health check.

---

## Open questions (revisit at part 3)

- Exact auth story for `update-agent`'s endpoints (shared session vs. separate minimal check).
- Exact signature scheme/tool (minisign vs. raw Ed25519).
- Where `manifest.source.json` (or equivalent) lives and its exact shape.

## Explicitly out of scope for V1

- Fully automatic updates (no click).
- Zero-downtime / blue-green updates.
- Staged/canary rollout percentage logic.
- Any change to how `minima-node` releases are vetted — still fully manual/out-of-band.
