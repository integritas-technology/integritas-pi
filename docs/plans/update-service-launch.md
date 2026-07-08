# Update Service Launch Checklist

**Status:** Not started
**Created:** 2026-07-08
**Goal:** Everything left before the update service (`update-agent`) can be trusted on a real Pi. This is testing and audit work, not new features — all code-level items from `update-agent-review-fixes.md` are done.

**Related:** [update-service.md](./update-service.md), [update-agent-review-fixes.md](./update-agent-review-fixes.md)

---

## 1. VPS deploy wiring (`update-service.md` Part 6)

**QA first:** wired up against the QA VPS/secrets before ever touching prod. Step-by-step guide lives in Notion (moved out of the repo — no infra hostnames/paths in version control).

- [ ] Create `/srv/update-manifests/qa/`, outside the Next.js app's project directory (not `next build`/PM2-managed, so redeploys can't wipe it).
- [ ] Create the dedicated low-privilege QA VPS deploy user (`qa-manifest-deploy`), owning only that folder.
- [ ] Add an nginx `location /update-manifest/` block serving that folder directly (nginx already sits in front of PM2 — no Next.js route needed).
- [ ] Register `QA_VPS_DEPLOY_HOST`/`QA_VPS_DEPLOY_USER`/`QA_VPS_DEPLOY_KEY`/`QA_VPS_DEPLOY_PATH` GH secrets.
- [ ] Replace the `release.yml` "Deploy manifest (placeholder)" step with the real `scp` step, pointed at the QA secrets.
- [ ] Set QA `update-agent`'s `MANIFEST_URL` to the QA manifest path.
- [ ] Verify via a disposable-tag dry run (§3) that the manifest actually lands on the QA VPS and is fetchable.
- [ ] **Repeat for prod** once QA is verified end-to-end: same steps against the production VPS/app, prod-scoped secret names (`VPS_DEPLOY_HOST`/`VPS_DEPLOY_USER`/`VPS_DEPLOY_KEY`), confirm the production `MANIFEST_URL`.
- [ ] **`manifest.source.json`'s `minima-node` digest is currently a placeholder** (`sha256:000...000`, added just to unblock `build-manifest.mjs`'s validation during the QA dry run) — replace with the real digest of the trusted `minimaglobal/minima` image/tag before this nears `main`/prod. Ties into the open question below.

## 2. Signing key generation (one-time, real)

- [ ] Generate the real Ed25519 signing keypair via `npm run release:generate-signing-key` (`scripts/release/generate-signing-key.mjs`, not a throwaway test key). Writes the public key to `update-agent/manifest-public-key.pem` and prints the private key to stdout only.
- [ ] Register the printed private key as GH secret `MANIFEST_SIGNING_KEY`.
- [ ] Commit `update-agent/manifest-public-key.pem`.
- [ ] **Code change:** update `update-agent` to read the public key from the committed `manifest-public-key.pem` file (`readFileSync` at a fixed path, baked into the Dockerfile via `COPY`) instead of `process.env.MANIFEST_PUBLIC_KEY` — remove `manifestPublicKey` from `update-agent/src/config/env.ts:5` and drop `MANIFEST_PUBLIC_KEY` from `docker-compose.yml`/`.env.example`. Do this **before** generating the real key above, so the real key is registered against the final code path, not the old env-var one.
- [ ] Decide `manifest.source.json`'s real location/shape if it should differ from the current repo-root placeholder (tracked as an open question in `update-service.md`).

### Config sourcing decision: `MANIFEST_URL` vs `MANIFEST_PUBLIC_KEY`

`MANIFEST_URL` stays a plain runtime env var (`update-agent/src/config/env.ts:4`, `process.env.MANIFEST_URL ?? ""`, passed through `docker-compose.yml`) — no secrecy concern, and overridability is a feature (self-hosters point it elsewhere).

`MANIFEST_PUBLIC_KEY` is moving off runtime env entirely, onto the committed file `update-agent/manifest-public-key.pem` baked into the image at build time (see code-change item above). It's not a secret — the public key's job is to verify signatures, not create them, so committing it is safe even in an open-source repo — but it must not be runtime-overridable: if it stayed a plain env var, anyone who could influence the deploy environment (compromised host, malicious compose override, bad fork config) could swap in their own keypair and get `update-agent` to accept a manifest signed by an attacker-controlled key, defeating signature verification. A file baked into the image at build time removes that override surface entirely.

## 3. Branch-based dry run (no VPS, no real tag)

See "Branch testing strategy" below for the approach. Goal: exercise the exact CI + update-agent logic end-to-end without touching `main` or the production manifest.

- [ ] Cut a disposable branch + `vtest*` tag, confirm `release.yml` builds/pushes `frontend`/`backend` to GHCR and produces a signed `manifest.json`/`manifest.json.sig` artifact.
- [ ] Point a local/dev `update-agent` at that manifest (via the uploaded artifact or a throwaway static file server) and confirm the update UI shows "Update available" and applies it against a real compose stack.
- [ ] Force a failing health check (bad digest / broken `CMD`) and confirm rollback behavior for both a stateless swap (frontend/backend) and Minima's backup/restore path.
- [ ] Delete the test images from GHCR and the test tag when done (see cleanup note below).

## 4. Real-Pi hardware verification

- [ ] **Minima data-dir ownership** (review item #7): confirm whether the real `minimaglobal/minima` image writes its data as root; if so, `update-agent` (uid 1000) can't back it up and the safety net silently never engages. Check via `docker exec minima ls -la /data` (or equivalent) on a real Pi.
- [ ] **End-to-end real update**: trigger a real update through the `/update` UI on a real (or spare/test) Pi, confirm the swap and health-check gating behave as designed outside of a dev machine.
- [ ] **Rollback on real hardware**: intentionally point at a broken image/digest, confirm the old container is restored and the Pi is left in a working state.

## 5. Housekeeping / governance

- [ ] Branch protection on `main` (required reviews, required status checks, no direct pushes) — deferred until a `dev` branch exists and the team's PR flow is actually in use.
- [ ] Re-verify `docs/qa/gaps.md`'s "Last verified" note once the above lands — it predates the update-agent work and doesn't yet list any update-agent-specific gaps.

---

## Branch testing strategy

**Problem:** `release.yml` only triggers on a `v*` tag push, and `build-manifest.mjs`/the deploy step assume a real release. We want to exercise the same CI path without risking a collision with a real version tag or touching the production manifest/VPS.

**Recommended approach — disposable pre-release tag on a throwaway branch:**

1. Branch off `main` (or whatever branch has the change under test): `git checkout -b test/update-flow-dryrun`.
2. Tag with a pre-release-style version that sorts and reads clearly as non-production, e.g. `v0.0.0-test.1`. `release.yml`'s tag filter (`v*`) matches this, so no workflow changes needed. Because image tags use `${{ github.ref_name }}`, this produces `ghcr.io/<org>/integritas-pi-frontend:v0.0.0-test.1` — a distinct tag from any real release, no risk of overwriting `v0.12.0` etc.
3. Push the tag (not the branch — `release.yml` doesn't trigger on branch pushes): `git push origin v0.0.0-test.1`.
4. CI builds/pushes the test images to GHCR and produces a signed `manifest.json` + `manifest.json.sig`. Since the VPS deploy step is still a placeholder, nothing gets published anywhere public — grab the manifest from the run's uploaded artifact instead.
5. Feed that manifest to a local/dev `update-agent` two ways, pick whichever's more convenient at the time:
   - **Static file server**: `python3 -m http.server` (or similar) serving the downloaded artifact folder, `MANIFEST_URL` pointed at it from the dev compose stack.
   - **Direct edit**: since the manifest is just signed JSON, you already have a faster local loop (documented in `update-service.md`'s "How to test" step 2) that doesn't need CI at all for logic-only checks — reserve the real tag/CI dry run for validating the *pipeline*, not the update logic itself (that's already covered by step 2's local script loop).
6. Cleanup after the dry run: delete the `v0.0.0-test.*` tag (local + remote) and the pushed GHCR image versions (Settings → Packages, or `gh api -X DELETE` on the version) so they don't accumulate or get mistaken for a real release later.

**Why not a real config/environment split:** a separate `RELEASE_CHANNEL` or duplicate workflow adds permanent surface for a one-off need. A throwaway tag is a single `git tag`/`git push`/cleanup, exercises the *exact* production code path (no "test mode" branching to keep in sync), and leaves nothing behind once the tag and packages are deleted.

**What this does and doesn't cover:**
- Covers: CI build/push/sign pipeline, GHCR digest resolution, manifest signature round-trip, update-agent's real apply/health-check/rollback logic against real pulled images.
- Doesn't cover: the VPS deploy step (still a placeholder — that's item 1 above) or anything about the production manifest URL/hosting.
