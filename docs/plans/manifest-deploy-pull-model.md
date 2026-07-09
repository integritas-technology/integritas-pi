# Manifest Deploy: Private-Repo Pull Model

**Status:** In progress — code changes landed, VPS/GitHub infra setup not started.
**Created:** 2026-07-09

**Related:** [update-service-launch.md](./update-service-launch.md) §1, [update-service.md](./update-service.md)

---

## Context

The QA VPS's SSH (port 22) is firewalled to allowlisted dev-team IPs only. GitHub-hosted Actions runners get a fresh IP from a huge shared pool every run, so the original push-based deploy step (`appleboy/scp-action` in `release.yml`) times out at the TCP level — it can never reach the VPS. Widening the firewall to GitHub's IP ranges was ruled out (too broad, shared, rotating). Self-hosted runners and paid Enterprise-Cloud static-IP runners were both considered and rejected for now (runner = persistent-machine code-exec risk; Enterprise Cloud = disproportionate org-wide cost for one deploy step).

Decision: switch to a **pull-based** model. CI pushes the signed manifest to a small **private GitHub repo** over HTTPS (no SSH, no inbound firewall change needed). A cron job on the VPS periodically pulls that repo and serves the manifest folder directly via nginx. Signature verification in `update-agent` remains the actual trust boundary regardless of transport, so this is not a security downgrade from the SSH-push design — it trades a silent-failure risk (no CI-visible failure signal unless separately monitored) for removing the firewall blocker entirely.

While editing `release.yml` for this, the "find previous release tag" bug was also fixed: it previously picked the previous tag by raw version-sort with no filter for test/pre-release tags, so a leftover test tag could get picked as "previous release" and silently cause real changes to be missed by the `changes` diff.

**App-namespaced folder layout:** `integritas-manifests` is structured as `<app>/<env>/manifest.json`+`.sig` (e.g. `integritas-pi/qa/manifest.json`), not `<env>/manifest.json`, on the chance this update-agent mechanism gets reused by another app later. This costs one extra path segment in the CI push step and the nginx alias now, and avoids a folder-restructure/migration if a second app ever needs the same repo. Nothing beyond the path changes — `update-agent` has no concept of a manifest filename or repo layout; it only ever fetches whatever full URL is in its own `MANIFEST_URL`, so this is purely a CI/nginx-side decision, not a design constraint on `update-agent` itself. No further generalization (shared tooling, per-app manifest schema, multi-app awareness in `update-agent`) is being done now — YAGNI beyond this one cheap structural hedge.

## Already done

- QA VPS: dedicated low-privilege deploy user (`qa-manifest-deploy`) + SSH access set up.
- GH repo secrets for the old SSH-push path registered (`QA_VPS_DEPLOY_HOST/USER/KEY/PATH`, `MANIFEST_SIGNING_KEY`). These need to be re-scoped/replaced for the new pull model — see below.
- `release.yml`: tag-sort bug fixed (excludes pre-release-shaped tags from "previous release" lookup).
- `release.yml`: deploy step rewritten — checks out the private `integritas-manifests` repo and pushes the manifest into `integritas-pi/qa/` over HTTPS instead of `scp`-ing over SSH.
- Docs updated (`update-service-launch.md` §1, `update-service.md`, `CHANGELOG.md`) to describe the new design.

## Not yet done

All of the below are external/infra steps — nothing here is committed code, and none of it has been executed yet. This new workflow code is untested until at least the first two are done.

- Create the private GitHub repo `integritas-manifests`, with `integritas-pi/qa/manifest.json`+`.sig` and `integritas-pi/prod/manifest.json`+`.sig` subfolders (app-namespaced layout — see "App-namespaced folder layout" above). Splitting into subfolders now (even though only QA is wired up yet) means the VPS-side nginx `alias` can point at a single leaf folder inside the clone and never expose the repo root or `.git/`.
- Register `MANIFEST_REPO_DEPLOY_KEY` GH secret — a write-scoped deploy key (or fine-grained PAT) CI uses to push to `integritas-manifests`. Simplest form: a deploy key with write access added directly to `integritas-manifests` (one repo only, no org-wide token).
- On the QA VPS: clone `integritas-manifests` to `/srv/update-manifests/repo/` (outside the Next.js app's project directory — not `next build`/PM2-managed, so redeploys can't wipe it) using a **read-only** deploy key, separate from CI's write key.
- Add a small pull script (`git -C /srv/update-manifests/repo pull --ff-only`), logged (journald/syslog or a logfile) so pull failures are locally visible — mitigates the pull model's silent-failure trade-off.
- Add a cron job under `qa-manifest-deploy` running that script every 5–15 minutes.
- Add an nginx `location /update-manifest/` block aliasing to `/srv/update-manifests/repo/integritas-pi/qa/` (the leaf subfolder — never the repo root, so `.git/` stays unreachable over HTTP; both `location` and `alias` paths end in `/`, same rule verified previously).
- Confirm the `release.yml` deploy step runs clean against real secrets (code is written, untested against real infra).
- Set QA `update-agent`'s `MANIFEST_URL` to the QA manifest endpoint.
- Verify via a disposable-tag dry run: manifest lands in `integritas-manifests` (commit shows up), VPS cron pulls it, nginx serves it, and a traversal attempt (e.g. `.git/config`) fails.
- Retire `QA_VPS_DEPLOY_HOST`/`QA_VPS_DEPLOY_USER`/`QA_VPS_DEPLOY_KEY`/`QA_VPS_DEPLOY_PATH` GH secrets once the new deploy step is confirmed working.
- Repeat for prod once QA is verified end-to-end: `integritas-pi/prod/` folder in the manifest repo, prod-scoped VPS clone/cron/nginx, confirm the production `MANIFEST_URL`.

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
