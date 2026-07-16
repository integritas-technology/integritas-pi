# Future: update-agent self-update support

**Status:** Not started. Deferred deliberately — noted during the version-display discussion so it isn't forgotten.

Right now `update-agent` isn't in the manifest and has no self-update path, by original design (`docs/plans/update-agent/archive/update-service.md`: "Self-update: resolved by scope — update-agent is deliberately not in the manifest... no self-update path in V1").

The user wants to eventually have `update-agent` itself be built, pushed, tracked in the manifest, and updated like `frontend`/`backend`.

Why this is harder than frontend/backend updates: `update-agent` is the process that supervises updates (pulls new images, health-checks them, swaps containers, rolls back on failure). Having it update itself means the supervisor has to replace itself mid-supervision — there's no external process watching over *that* swap the way `update-agent` watches over `frontend`/`backend`'s swap. Needs real design thought (e.g. a tiny separate watchdog, or a self-swap dance with careful ordering) before implementation, not a quick extension of the existing per-service update flow.

Not scoped or started. Revisit as its own focused discussion.
