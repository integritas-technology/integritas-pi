# Manifest Deploy: Private-Repo Pull Model

**Status:** In progress — code changes landed, `integritas-manifests` repo + GitHub App auth set up, VPS-side setup not started.
**Created:** 2026-07-09

**Related:** [update-service-launch.md](./update-service-launch.md) §1, [update-service.md](./update-service.md)

---

## Context

The QA VPS's SSH (port 22) is firewalled to allowlisted dev-team IPs only. GitHub-hosted Actions runners get a fresh IP from a huge shared pool every run, so the original push-based deploy step (`appleboy/scp-action` in `release.yml`) times out at the TCP level — it can never reach the VPS. Widening the firewall to GitHub's IP ranges was ruled out (too broad, shared, rotating). Self-hosted runners and paid Enterprise-Cloud static-IP runners were both considered and rejected for now (runner = persistent-machine code-exec risk; Enterprise Cloud = disproportionate org-wide cost for one deploy step).

Decision: switch to a **pull-based** model. CI pushes the signed manifest to a small **private GitHub repo** over HTTPS (no SSH, no inbound firewall change needed). A cron job on the VPS periodically pulls that repo and serves the manifest folder directly via nginx. Signature verification in `update-agent` remains the actual trust boundary regardless of transport, so this is not a security downgrade from the SSH-push design — it trades a silent-failure risk (no CI-visible failure signal unless separately monitored) for removing the firewall blocker entirely.

While editing `release.yml` for this, the "find previous release tag" bug was also fixed: it previously picked the previous tag by raw version-sort with no filter for test/pre-release tags, so a leftover test tag could get picked as "previous release" and silently cause real changes to be missed by the `changes` diff.

**App-namespaced folder layout:** `integritas-manifests` is structured as `<app>/<env>/manifest.json`+`.sig` (e.g. `integritas-pi/qa/manifest.json`), not `<env>/manifest.json`, on the chance this update-agent mechanism gets reused by another app later. This costs one extra path segment in the CI push step and the nginx alias now, and avoids a folder-restructure/migration if a second app ever needs the same repo. Nothing beyond the path changes — `update-agent` has no concept of a manifest filename or repo layout; it only ever fetches whatever full URL is in its own `MANIFEST_URL`, so this is purely a CI/nginx-side decision, not a design constraint on `update-agent` itself. No further generalization (shared tooling, per-app manifest schema, multi-app awareness in `update-agent`) is being done now — YAGNI beyond this one cheap structural hedge.

**CI → `integritas-manifests` auth is a GitHub App, not a deploy key or PAT.** The original plan (Step 2 below, as originally written) called for a write-access SSH deploy key on `integritas-manifests`. The `integritas-technology` org disables write-access deploy keys org-wide (confirmed directly in the GitHub UI, and matches GitHub's own published guidance steering orgs toward Apps — deploy keys have no expiry and can't be passphrase-protected, so a compromised CI secret grants standing, hard-to-revoke write access). Switched to a GitHub App (`integritas-pi-manifest-deploy`) instead: installed only on `integritas-manifests` with `Contents: Read and write`, CI generates a short-lived (1 hour) installation token per run via the official `actions/create-github-app-token` action, rather than using any long-lived static secret.

**Test-tag dry runs push to `integritas-manifests`' `dev` branch, not `main`.** `release.yml` checks the pushed git tag: anything matching `*-test.*` (the existing dry-run tag convention, e.g. `v0.0.0-test.1`) pushes to `dev`; real release tags push to `main`. Keeps ad-hoc CI testing out of the manifest repo's real history. **`dev` must exist in `integritas-manifests` before running a dry run** — create it once via the GitHub UI (branch dropdown → create `dev` from `main`); `actions/checkout`'s `ref:` only checks out existing branches, it doesn't create them.

## Already done

- QA VPS: dedicated low-privilege deploy user (`qa-manifest-deploy`) + SSH access set up.
- GH repo secrets for the old SSH-push path registered (`QA_VPS_DEPLOY_HOST/USER/KEY/PATH`, `MANIFEST_SIGNING_KEY`). These need to be re-scoped/replaced for the new pull model — see below.
- `release.yml`: tag-sort bug fixed (excludes pre-release-shaped tags from "previous release" lookup).
- `release.yml`: deploy step rewritten — checks out the private `integritas-manifests` repo and pushes the manifest into `integritas-pi/qa/` over HTTPS instead of `scp`-ing over SSH.
- GitHub App `integritas-pi-manifest-deploy` created (org-level), `Contents: Read and write` permission, installed on `integritas-manifests` only. App ID and private key (`.pem`) obtained.
- `MANIFEST_APP_ID` and `MANIFEST_APP_PRIVATE_KEY` GH secrets registered on `integritas-pi`.
- `release.yml`: manifest deploy step updated to generate a short-lived installation token via `actions/create-github-app-token@v2` and use it for the `integritas-manifests` checkout, instead of an SSH deploy key.
- Docs updated (`update-service-launch.md` §1, `update-service.md`, `CHANGELOG.md`) to describe the new design.
- Private GitHub repo `integritas-manifests` created on the org, with `integritas-pi/qa/` and `integritas-pi/prod/` subfolders (`.gitkeep` placeholders — no manifest files needed yet, the first real CI push creates them).

## Not yet done

All of the below are external/infra steps — nothing here is committed code, and none of it has been executed yet. This new workflow code is untested until at least the first is done.

- Create a `dev` branch in `integritas-manifests` (from `main`, empty is fine) — required before any test-tag dry run, since the deploy step's checkout targets `dev` for test tags and will fail if it doesn't exist yet.
- On the QA VPS: clone `integritas-manifests` to `/srv/update-manifests/repo/` (outside the Next.js app's project directory — not `next build`/PM2-managed, so redeploys can't wipe it) using a **read-only** credential (e.g. a fine-grained PAT scoped to just that repo, or a second GitHub App install with read-only permission), separate from CI's write access.
- Add a small pull script (`git -C /srv/update-manifests/repo pull --ff-only`), logged (journald/syslog or a logfile) so pull failures are locally visible — mitigates the pull model's silent-failure trade-off.
- Add a cron job under `qa-manifest-deploy` running that script every 5–15 minutes.
- Add an nginx `location /update-manifest/` block aliasing to `/srv/update-manifests/repo/integritas-pi/qa/` (the leaf subfolder — never the repo root, so `.git/` stays unreachable over HTTP; both `location` and `alias` paths end in `/`, same rule verified previously).
- Confirm the `release.yml` deploy step runs clean against real secrets (code is written, untested against real infra).
- Set QA `update-agent`'s `MANIFEST_URL` to the QA manifest endpoint.
- Verify via a disposable-tag dry run: manifest lands in `integritas-manifests` (commit shows up), VPS cron pulls it, nginx serves it, and a traversal attempt (e.g. `.git/config`) fails.
- Repeat for prod once QA is verified end-to-end: `integritas-pi/prod/` folder in the manifest repo, prod-scoped VPS clone/cron/nginx, confirm the production `MANIFEST_URL`.

**Already done, not pending:** the old `QA_VPS_DEPLOY_HOST`/`QA_VPS_DEPLOY_USER`/`QA_VPS_DEPLOY_KEY`/`QA_VPS_DEPLOY_PATH` GH secrets have already been deleted from `integritas-pi` — they were unused dead weight left over from the original SSH-push design.

## Files touched (code)

- `.github/workflows/release.yml` — replaced deploy step, fixed tag-sort filter.
- `docs/plans/update-service-launch.md` — rewrote §1, checked off completed items, added blocker note.
- `docs/plans/update-service.md` — updated the stale one-line manifest-serving description.
- `CHANGELOG.md` — `[Unreleased]` entries.
- New external repo `integritas-manifests` (not part of this git repo — created on GitHub, no local file changes).
- VPS-side script/cron/nginx config — infra changes made by hand, not committed code.

## Verification plan

- `release.yml` YAML is valid (no syntax errors) — sanity-check via `gh workflow view` or a local YAML lint.
- Disposable-tag dry run (same pattern as the existing "Branch testing strategy" in `update-service-launch.md`): cut a test tag, confirm the new "Deploy manifest" step pushes `integritas-pi/qa/manifest.json`+`.sig` into `integritas-manifests` (check the repo's commit history).
- On the VPS: manually run the pull script once, confirm it fast-forwards and the files land in `/srv/update-manifests/repo/integritas-pi/qa/`; confirm cron is actually scheduled (`crontab -l` under `qa-manifest-deploy`).
- `curl` the nginx endpoint (`https://<qa-host>/update-manifest/manifest.json`) and confirm it returns the pushed manifest; confirm a traversal attempt (e.g. `.git/config`) does not return repo internals.
- Clean up the test tag/images per the existing cleanup note once verified.
- Docs updated and completed items reflect reality.
