# Update-agent launch: remaining open items

**Status:** Open items only — distilled from the now-deleted `docs/plans/update-agent/archive/` (superseded design/build plans, all fully done; see git history if the original detail is ever needed).

VPS pull-model deploy wiring (clone, cron, nginx, prod rollout) is tracked separately and still actively maintained in [manifest-deploy-pull-model.md](../plans/manifest-deploy-pull-model.md) — not repeated here.

- **Real signing key**: generate the production Ed25519 keypair (`npm run release:generate-signing-key`, not a throwaway test key) and register the private key as GH secret `MANIFEST_SIGNING_KEY`. Status unverifiable from the repo by design (private key is never committed) — confirm before the first real (non-test) release tag.
- **Branch-based dry run**: cut a disposable `v0.0.0-test.*` tag and confirm the full CI → signed manifest → `update-agent` pipeline end-to-end (build, sign, apply, health-check, rollback-on-failure) before trusting it against a real Pi.
- **Real-Pi verification**: trigger a real update through the `/update` UI on real hardware (outside `DEV_MODE`) and confirm both the success path and rollback-on-failure behave as designed.
- **Branch protection on `main`**: confirmed still off (`gh api repos/integritas-technology/integritas-pi/branches/main/protection` → 404). Deferred pending an actual PR-based team workflow; revisit once that's in regular use.
- **`docs/qa/gaps.md` "Last verified" note**: confirmed stale (dated 2026-06-29, predates the update-agent work landing). Re-verify and bump once the above settles.
