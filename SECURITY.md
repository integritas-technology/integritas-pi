# Security Notes And Risk Register

This project is a learning prototype. It is not production-ready and should only be run on a trusted local network while these risks are understood and actively managed.

This file is the **general** risk register for the whole app. Auth-specific threat model, controls, and Phase 1 checklist live in `docs/plans/auth-security.md` (implementation: `docs/plans/auth-implementation.md`). Open QA hardening: `docs/qa/auth-gaps.md`. Docs index: `docs/README.md`.

## Scope And Responsibility

**In scope (application):**
- API authentication and session security (Phase 1 implemented)
- Secrets handling within the backend (encrypted settings, hashed sessions)
- Input validation and safe proxying to Integritas / Minima
- Read-only host file access with path traversal controls

**Out of scope (operator / environment):**
- OS hardening, firewall, SSH, physical device security
- Network topology (router, VPN, cellular)
- Full-disk encryption and device attestation

We document recommended setup in README; we cannot enforce it on the device.

## Current Security Posture

- Admin authentication is implemented: password + TOTP login, stateful HttpOnly session cookies, protected `/api/*` routes.
- The frontend is reachable on the LAN through `http://<pi-ip>:8080`.
- Backend APIs are reachable through the frontend Nginx `/api` proxy.
- The backend stores local settings in SQLite under `/data/integritas-pi.db`.
- Integritas API keys entered in the UI are encrypted before storage with AES-256-GCM using `APP_SECRET`.
- The backend mounts `/var/run/docker.sock` for prototype container monitoring and allowlisted Minima container restart.
- The backend can read the configured host file directory through `/host-files:ro`.
- Minima RPC is bound to `127.0.0.1` on the host by default, but is reachable by backend over the Docker network.

**Auth (Phase 1 — implemented):** Admin login with password + TOTP, stateful sessions (hashed in SQLite), protected `/api/*` routes, login/setup rate limiting, audit log for secret changes. See `docs/plans/auth-security.md`. Default HTTP LAN deploy uses `COOKIE_SECURE=false`; use HTTPS + `COOKIE_SECURE=true` on untrusted networks.

## High Priority Risks

### Unauthenticated LAN Access (mitigated, residual HTTP risk)

Risk: On a trusted home LAN with default HTTP deploy, session cookies are not marked `Secure` and can be observed on the network.

Impact: Session theft on untrusted networks; unauthorized admin access if credentials or cookies are intercepted.

Controls (V1):

- Login required for all `/api/*` routes except health, setup, and login.
- HttpOnly + `SameSite=Strict` session cookies; token hashes stored in SQLite.
- TOTP required at setup and login.
- Login/setup rate limiting and generic login errors.

Residual gap: Use HTTPS and `COOKIE_SECURE=true` before internet or untrusted network exposure. CSRF tokens are a follow-up (`SameSite=Strict` is the V1 baseline).

Status: Mitigated for trusted LAN; see `docs/qa/auth-gaps.md` for gaps.

### Docker Socket Mount

Risk: The backend mounts `/var/run/docker.sock` to read container status/resource usage and to restart the Minima container via `POST /api/minima/restart` (admin-only). Docker socket access is highly sensitive.

Impact: If the backend is compromised, an attacker could read container metadata or restart/stop containers allowed by the Docker API and socket group permissions.

Current Controls:

- Docker write use is narrow: only `restartComposeService("minima")` is implemented (no generic container control API).
- `POST /api/minima/restart` requires an admin session and records an audit event.

Plan:

- Replace direct Docker socket access with a narrow sidecar or socket proxy with an explicit allowlist (read stats + restart minima only).
- Consider cAdvisor or host-exported metrics for read-only monitoring.
- Make Docker control optional and disabled by default in production.

Status: Open. Accepted only for prototype operator convenience.

### Seed Phrase Import (admin)

Risk: `POST /api/wallet/import` accepts a 24-word BIP-39 seed phrase in the JSON request body and calls the Minima `restore` RPC. The phrase travels over the existing HTTP connection.

Impact: If the LAN connection is observed (e.g., on an untrusted network), the seed phrase can be captured and the wallet compromised. A successful restore replaces the node's current wallet and cannot be undone without a separate backup.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Phrase is never logged — audit event `wallet.import` records only that an import occurred, with no phrase in the detail field.
- Phrase is not returned in the response body.
- Input is validated server-side (minimum 12 words) before calling Minima RPC.
- Minima RPC call uses a 30 s timeout to allow node processing time.

**Required before field deployment:** Enable HTTPS and set `COOKIE_SECURE=true` on any network where seed phrase import will be used. Never import a seed phrase over an untrusted or monitored network.

Status: Documented. HTTPS required before field deployment.

> **Megammr resync interaction:** The Minima `restore` command used by `/api/wallet/import` triggers a node restart, which may overlap with active or auto-triggered Megammr resyncs. If a malicious or misconfigured Megammr host is set at the time of a resync, the resulting chain state could force the node to re-derive keys in an unexpected state. Operators should verify the Megammr host URL before importing a wallet and before enabling `MINIMA_AUTO_RESYNC`. This is a known prototype risk — investigate before production use.

### Wallet debug clears (admin, non-production)

Risk: `POST /api/wallet/debug/clear-wallet-accounts` and `POST /api/wallet/debug/clear-wallet-history` delete labeled account mappings and SQLite send history. Misuse on a shared dev stack could remove operator labels or local audit context (not on-chain funds).

Impact: Loss of labeled account metadata and send history rows in SQLite. Does not delete Minima wallet keys or on-chain balances.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Endpoints return **403** when `NODE_ENV=production`.
- Frontend debug buttons render only when `import.meta.env.DEV` is true.
- Audit events `wallet.debug.clear_accounts` and `wallet.debug.clear_history` record deletions.

Status: Accepted for local/dev iteration only. Not available in production builds.

### API Key Management

Risk: Saving or clearing the Integritas API key is a high-impact mutation.

Impact: Service disruption, billing/quota misuse, incorrect stamping under attacker-controlled credentials.

Controls (V1):

- `POST/DELETE /api/integritas/api-key` require an admin session.
- Keys validated upstream before save; never returned to the frontend.
- Audit events recorded on save/delete.

Status: Mitigated.

### `APP_SECRET` Dependency

Risk: The encrypted Integritas API key can only be decrypted with the same `APP_SECRET`. If `APP_SECRET` is lost or changed, stored secrets are unrecoverable. If `APP_SECRET` leaks, encrypted database secrets can be decrypted.

Impact: Loss of access to saved API key or compromise of stored secrets.

Plan:

- Preserve `APP_SECRET` during updates.
- Restrict permissions on `/opt/integritas-pi/.env`.
- Add backup/restore documentation.
- Consider integrating OS keyring, TPM, age/sops, or user-provided passphrase for stronger production secret handling.

Status: Partially mitigated by installer preservation. Production design open.

## Medium Priority Risks

### HTTP Only UI

Risk: The app is served over plain HTTP.

Impact: LAN attackers can observe or modify traffic, including canonical document bytes and the API key when it is submitted through the UI.

Plan:

- Add HTTPS option for local network use.
- Consider Caddy or Traefik reverse proxy with local certificates.
- At minimum, warn users not to submit secrets over untrusted networks.

Status: Open. Target: HTTPS + `COOKIE_SECURE=true` for field deployments; HTTP acceptable on trusted home LAN only until then.

### File Browser Metadata Exposure

Risk: Backend lists files and directories from the configured host path. Mount is read-only, but filenames, directory names, sizes, and structure may be sensitive.

Impact: Local data disclosure to anyone who can access the UI.

Plan:

- Keep `HOST_FILES_DIR` as narrow as possible.
- Add auth before use outside trusted local development.
- Add per-user allowlists or explicit directory selection later.
- Avoid mounting `/home/pi` in production unless required.

Status: Partially mitigated by read-only mount and path traversal checks. Auth will gate `/api/files/*` (see `docs/plans/auth-security.md`).

### Path Traversal And Symlink Escape

Risk: File browser endpoints could be abused to access files outside the allowed directory.

Impact: Sensitive host file disclosure.

Current Controls:

- Uses `path.resolve` to block `../` traversal.
- Uses `fs.realpath` to block symlink escape outside `/host-files`.
- Host mount is read-only.

Plan:

- Add tests for traversal, symlink escape, encoded paths, and permission errors.
- Consider hiding symlinks entirely.

Status: Mitigated for prototype, needs tests.

### Minima RPC Exposure

Risk: Minima RPC can perform sensitive node operations depending on enabled commands. It is bound to `127.0.0.1` on the host by default but reachable from backend over Docker networking.

Impact: If backend is compromised, attacker can call Minima RPC from inside the Docker network.

Plan:

- Keep host RPC bind as `127.0.0.1` by default.
- Add backend allowlist for any future Minima commands exposed through UI.
- Add auth before exposing Minima actions.
- Review Minima RPC auth/options before production.

Status: Partially mitigated by host-local bind and no arbitrary command proxy.

Current Controls:

- Backend exposes narrow allowlisted Minima actions instead of a generic Minima command proxy.
- The Megammr resync action always calls the configured Minima RPC endpoint over the Docker network and only passes the saved Megammr host value.
- The wallet balance action only calls the Minima `balance` command and returns its response through the backend.

### Minima auto-resync (optional)

Risk: When `MINIMA_AUTO_RESYNC=true`, the backend health poller can trigger Megammr resync without an operator click if the chain appears stalled (block age above `MINIMA_STALL_BLOCK_AGE_SECONDS` while the node is running). Minima may respond that a container restart is required afterward.

Impact: Unexpected resync traffic, temporary Minima RPC unavailability (same as manual resync), and possible operator surprise on a production Pi.

Current Controls:

- **Disabled by default** (`MINIMA_AUTO_RESYNC=false`).
- Cooldown between auto-resync attempts (`MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES`, default 30).
- Poller logs stall detection and auto-resync actions; `GET /api/minima/status` exposes `monitoring.stallDetected`, `lastAutoResyncAt`, and related fields.
- Manual resync remains available in the UI; auto-resync reuses the same allowlisted `resyncMegammr()` path.

Status: Documented prototype tradeoff. Review before enabling on production nodes.

### Minima container restart (admin)

Risk: `POST /api/minima/restart` restarts the Minima Docker container. RPC and wallet operations are unavailable until the container is healthy again.

Impact: Brief node outage; if abused, repeated restarts could disrupt stamping/wallet workflows on the Pi.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Audit event `minima.container.restart` with container id.
- UI confirms before restart; status polling pauses during restart.

Status: Documented prototype tradeoff.

### Minima peer management (admin add)

Risk: `POST /api/minima/peers/add` calls the allowlisted Minima RPC `peers action:addpeers peerslist:<host:port>`.

Impact: Misconfigured peer addresses could affect P2P connectivity; comma-separated input is validated for basic `host:port` shape only.

Current Controls:

- Admin session required.
- Audit event `minima.peers.add` with the submitted peerslist (not secrets).
- `GET /api/minima/peers` is read-only and available to any authenticated session.

Status: Documented prototype tradeoff.

### Data Source URL Fetching

Risk: Saved data source URLs and optional health status URLs are fetched by the backend. In this prototype, an admin can configure URLs that cause the backend to make outbound or Docker-network HTTP requests.

Impact: Misconfigured or malicious URLs could probe internal services, create repeated outbound traffic, or expose upstream response details in the UI.

Current Controls:

- URLs must be saved on a data source before the health poll endpoint will fetch them.
- Data-source mutation routes require admin role.
- Health status polling is narrow and read-only, and the frontend polls saved health URLs once per minute.

Plan:

- Add URL allowlists or network egress policy for production.
- Consider per-source health polling controls and rate limits.

Status: Accepted prototype risk.

### Public Data Source Webhooks

Risk: Webhook data sources expose generated public receive URLs under `/api/data-source-webhooks/:token` so external systems can POST JSON without a browser session.

Impact: Anyone with a webhook URL can submit JSON to that source, update its latest preview/hash, and create read-history rows.

Current Controls:

- Webhook receive URLs include a generated UUID token stored in the data source config.
- Webhook URLs are per source and are not generic command execution endpoints.
- Webhook sources accept JSON only through the existing Express JSON parser.
- Admin authentication is still required to create, edit, list, or delete webhook sources.

Plan:

- Add optional webhook secret headers/signatures and rate limiting before production use.
- Add per-source enable/disable controls and event retention limits if webhook volume grows.

Status: Accepted prototype risk.

### Integritas Request Proxy

Risk: Backend proxies stamp/status/verify calls to Integritas using a stored API key.

Impact: API quota/billing misuse, stamping untrusted data, leaking operational details in errors.

Plan:

- Add auth and authorization.
- Add rate limiting.
- Add request size limits per endpoint.
- Add audit logs for stamping and verification.
- Persist stamp records with document id, hash, proof UID, status, proof, canonicalization, and errors.

Status: Open.

### SQLite File Permissions

Risk: SQLite data directory must be writable by backend uid `1000`. Incorrect permissions can crash backend. Overly broad permissions can expose encrypted settings and future app data.

Impact: Availability issue or local data exposure.

Current Controls:

- Installer creates data directory and sets owner to `1000:1000`.
- Installer sets directory mode `700`.

Plan:

- Add startup diagnostics with clear error messages.
- Consider migration command and backup documentation.

Status: Partially mitigated.

### Dependency And Image Supply Chain

Risk: Docker images and npm packages are pulled from external registries. Tags such as `minimaglobal/minima:dev` are mutable.

Impact: Unexpected updates, compromised dependencies, reproducibility issues.

Plan:

- Pin image digests for production.
- Avoid `:dev` tags outside prototyping.
- Add automated `npm audit` and image vulnerability scanning.
- Review native dependency `better-sqlite3` updates.

Status: Open.

### One-Line Curl Installer

Risk: `curl | sudo bash` executes remote code as root.

Impact: If GitHub, DNS, TLS trust, or repository contents are compromised, host compromise is possible.

Plan:

- Publish checksums or signed releases.
- Support downloading and inspecting installer before running.
- Consider package repository, deb package, or signed install bundle.
- Keep installer minimal and auditable.

Status: Open. Accepted for prototype UX exploration.

## Low Priority Or Future Risks

### Lack Of Rate Limiting

Risk: Endpoints can be called repeatedly.

Impact: Local DoS, Integritas quota consumption, log noise.

Plan: Login/setup rate limits implemented; broader per-IP limits on stamp and automation endpoints after.

Status: Partially mitigated — login/setup only.

### Error Response Detail

Risk: Backend may return upstream error bodies and detailed internal status.

Impact: Information disclosure.

Plan: Split developer diagnostics from user-facing errors. Hide sensitive upstream details by default.

Status: Open.

### Logging Sensitive Data

Risk: Request logging currently logs method and URL. Future changes could accidentally log secrets or proof payloads.

Impact: Secret leakage into Docker logs.

Plan: Keep logs metadata-only. Never log API keys, request bodies, canonical bytes, or proof payloads unless explicitly redacted.

Status: Partially mitigated.

### Missing Security Tests

Risk: Security-sensitive behavior is manually verified.

Impact: Regressions may go unnoticed.

Plan: Add automated tests for file traversal, auth once added, Integritas key storage, encryption/decryption, and API error handling.

Status: Open. Auth test cases and gaps: `docs/qa/auth-gaps.md` (model: `docs/plans/auth-security.md`).

## Development Security Plan

1. ~~Add authentication and admin authorization.~~ Done (Phase 1).
2. Replace direct Docker socket mount with a safer monitoring path.
3. Add HTTPS or a documented trusted-network-only mode.
4. Add rate limiting and audit logs.
5. Persist Integritas proof records in SQLite with schema migrations.
6. Add automated tests for security-sensitive endpoints.
7. Pin Docker images and add dependency/image scanning.
8. Design production-grade secret management for API keys.

## Reporting Security Issues

This is currently a private learning prototype. For now, document discovered issues in this file and fix them before expanding deployment beyond a trusted local network.
