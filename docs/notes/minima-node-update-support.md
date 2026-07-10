# Future: Minima node update support

**Status:** Not started. Minima is excluded from `update-agent` entirely for now.

`minimaglobal/minima:dev` is a multi-arch image — a different digest per CPU architecture (amd64/arm64/armv7). `update-agent`'s update flow compares one pinned digest per service; a single digest can't correctly represent "up to date" across a Pi fleet with mixed architectures.

This surfaced as a real failure: `manifest.source.json` had a placeholder `minima-node` digest (`sha256:0000...`), which `update-agent` tried to pull and update, and failed (`pull access denied`, since it's not a real image).

Current state:
- `update-agent`'s `MANIFEST_SERVICE_KEYS` (`update-agent/src/manifest/manifest.service.ts`) only lists `frontend`/`backend` — minima is not checked, not shown in the update badge, and not touched by `/apply`.
- `manifest.source.json`'s `minima-node` field is `false` — an honest "not configured" marker, not a fake digest.
- Minima version vetting stays fully manual/out-of-band, same as originally scoped in the archived `update-service.md` plan.

To actually support Minima updates later, need to solve the multi-arch digest problem — e.g. resolve and pin the manifest-list digest (not a per-arch image digest) and confirm `update-agent`'s Docker comparison logic works against a manifest-list reference on both arm64 and armv7 Pis, or track per-architecture digests in the manifest and have `update-agent` know its own architecture.
