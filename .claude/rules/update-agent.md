# Update Agent Work

Read these first:

- `update-agent/src/app.ts` for route registration.
- `update-agent/src/config/env.ts` for environment configuration.
- `update-agent/src/docker/docker.service.ts` for the Docker Engine API primitives (same raw `node:http`-over-socket pattern as `backend/src/features/status/docker.control.ts`, not `dockerode`).

Update Agent is a separate service/container from the product `backend`/`frontend`, with its own `package.json`, `Dockerfile`, and `docker.sock` mount. It applies signed, digest-pinned updates to `frontend`, `backend`, and `minima` — it does not implement any product feature.

Update Agent rules:

- Keep the code surface minimal: no endpoints beyond `GET /status`, `POST /apply`, and its one static page. No dependencies beyond `express`.
- Never add a generic Docker command proxy — only the specific pull/create/start/stop/remove/inspect calls the update flow needs.
- Auth: forward the caller's session cookie to `backend`'s `GET /api/auth/me` and require `role === "admin"`. Do not share `backend`'s SQLite session store directly.
- Manifests must be signature-verified (Ed25519, embedded public key) before any digest is trusted. Never fetch-and-apply an unverified manifest.
- `update-agent` is built and pushed by CI and its digest is carried in the manifest (`updateAgent` field), but it is **not** in `MANIFEST_SERVICE_KEYS` (`["frontend", "backend"]`) and has no self-update path — the manifest digest is only used by `install.sh` at install time. See `docs/notes/update-agent-self-update.md` for why self-update is deferred rather than a quick extension of the existing per-service update flow.
- The update UI is served by `update-agent` itself (not `frontend`) so it stays usable even if `frontend`'s own deploy is broken; `frontend`'s nginx only proxies `/update` to it, on the same origin/cert.
- Stateless services (`frontend`, `backend`) update by starting a new container alongside the old one, health-checking, then swapping. `minima` cannot run two instances against one data directory, so it backs up the data directory, stops the old container first, then swaps — with restore-on-failure.
- `frontend`/`backend` are `build:`-based in `docker-compose.yml`, not pinned to a digest — this is a known, accepted V1 gap: re-running `install.sh` or a bare `docker compose up -d --build` rebuilds them from source and silently reverts whatever `update-agent` last applied. Don't "fix" this by having `update-agent` rewrite `docker-compose.yml`/write an override file unless the user explicitly asks for that — it was a deliberate scope decision, not an oversight.
- Manifests carry a signed `createdAt` timestamp; `update-agent` persists the last-applied timestamp (`UPDATE_AGENT_STATE_DIR`) and rejects any manifest strictly older than it, guarding against replay/downgrade.
- `update-agent` polls the manifest on its own schedule (`STATUS_POLL_INTERVAL_MS`) and caches the result; the product frontend polls this cache (`GET /status/summary`) to show an "Update" notice in the sidebar.
