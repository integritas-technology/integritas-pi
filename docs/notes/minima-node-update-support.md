# Future: Minima node update support

**Status:** Not started. All minima update/backup/restore code has been removed from `update-agent` — add it back from scratch when this is picked up, rather than reworking placeholders.

`minimaglobal/minima:dev` is a multi-arch image — a different digest per CPU architecture (amd64/arm64/armv7). `update-agent`'s update flow compares one pinned digest per service; a single digest can't correctly represent "up to date" across a Pi fleet with mixed architectures.

This surfaced as two real bugs from carrying placeholder minima support: a fake manifest digest that `update-agent` tried to pull and update (`pull access denied`), and a backup-directory permission error from wiring meant to support a code path that was never actually reachable. Decided to fully remove the feature rather than keep dead/placeholder code around.

Removed:
- `update-agent/src/update/minima-update.ts` (backup/restore + health-checked swap logic).
- `minima-node` from `MANIFEST_SERVICE_KEYS`/`Manifest` type (`update-agent/src/manifest/manifest.service.ts`) and from `manifest.source.json`/`build-manifest.mjs`.
- `MINIMA_BACKUP_DIR`, `MINIMA_DATA_DIR_IN_CONTAINER`, `MINIMA_BACKUP_DIR_IN_CONTAINER`, `MINIMA_STATUS_URL` (the update-agent copy) from `docker-compose.yml`'s `update-agent` service, `.env.example`, and `install.sh`.
- `update-agent`'s `depends_on: minima`.

Minima version vetting stays fully manual/out-of-band, same as originally scoped in the archived `update-service.md` plan.

To support Minima updates later: solve the multi-arch digest problem first (e.g. pin the manifest-list digest instead of a per-arch one, and confirm `update-agent`'s Docker comparison logic works against it on both arm64 and armv7 Pis, or track per-architecture digests and have `update-agent` know its own arch) — then re-add backup/restore, manifest key, and compose wiring following the same shape `minima-update.ts` had (recoverable from git history if useful as a reference).
