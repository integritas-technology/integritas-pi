# Security Notes And Risk Register

This project is a learning prototype. It is not production-ready and should only be run on a trusted local network while these risks are understood and actively managed.

## Current Security Posture

- No authentication or authorization is implemented.
- The frontend is reachable on the LAN through `http://<pi-ip>:8080`.
- Backend APIs are reachable through the frontend Nginx `/api` proxy.
- The backend stores local settings in SQLite under `/data/integritas-pi.db`.
- Integritas API keys entered in the UI are encrypted before storage with AES-256-GCM using `APP_SECRET`.
- The backend mounts `/var/run/docker.sock:ro` for prototype resource monitoring.
- The backend can read the configured host file directory through `/host-files:ro`.
- Minima RPC is bound to `127.0.0.1` on the host by default, but is reachable by backend over the Docker network.

## High Priority Risks

### No Authentication

Risk: Anyone who can reach the web UI can use the app, browse allowed host files, save or clear the Integritas API key, request stamps, poll proofs, verify proofs, and read status information.

Impact: Unauthorized use of API quota, exposure of local filenames/metadata, configuration tampering, and operational visibility leakage.

Plan:

- Add login before exposing beyond trusted local development.
- Add session management with secure cookies.
- Add role-based access for admin actions such as API key management and Docker/system status.
- Add CSRF protection for state-changing routes.

Status: Open.

### Docker Socket Mount

Risk: The backend mounts `/var/run/docker.sock:ro` to read container status and resource usage. Docker socket access is highly sensitive. Read-only bind mount does not make the Docker API itself read-only in a strong security sense.

Impact: If backend is compromised, Docker API access could potentially expose container metadata or become a path toward host/container control depending on socket permissions and Docker API behavior.

Plan:

- Replace direct Docker socket access with a narrow metrics sidecar or explicit allowlisted status service.
- Consider cAdvisor, Docker socket proxy with strict endpoint allowlist, or host-exported metrics.
- Make resource monitoring optional and disabled by default in production.

Status: Open. Accepted only for prototype visibility.

### API Key Management From Unauthenticated UI

Risk: The UI allows saving and clearing the Integritas API key. Without authentication, any LAN user can replace or remove the key.

Impact: Service disruption, billing/quota misuse, incorrect stamping under attacker-controlled credentials.

Plan:

- Require admin authentication before API key write/delete.
- Add audit log entries for secret changes.
- Never return secret values to frontend.
- Add key validation before saving.

Status: Open.

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

Status: Open.

### File Browser Metadata Exposure

Risk: Backend lists files and directories from the configured host path. Mount is read-only, but filenames, directory names, sizes, and structure may be sensitive.

Impact: Local data disclosure to anyone who can access the UI.

Plan:

- Keep `HOST_FILES_DIR` as narrow as possible.
- Add auth before use outside trusted local development.
- Add per-user allowlists or explicit directory selection later.
- Avoid mounting `/home/pi` in production unless required.

Status: Partially mitigated by read-only mount and path traversal checks.

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

Plan: Add per-IP and per-session rate limits after auth/session design.

Status: Open.

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

Status: Open.

## Development Security Plan

1. Add authentication and admin authorization.
2. Replace direct Docker socket mount with a safer monitoring path.
3. Add HTTPS or a documented trusted-network-only mode.
4. Add rate limiting and audit logs.
5. Persist Integritas proof records in SQLite with schema migrations.
6. Add automated tests for security-sensitive endpoints.
7. Pin Docker images and add dependency/image scanning.
8. Design production-grade secret management for API keys.

## Reporting Security Issues

This is currently a private learning prototype. For now, document discovered issues in this file and fix them before expanding deployment beyond a trusted local network.
