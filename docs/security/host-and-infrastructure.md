# Host And Infrastructure Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md)

## Docker Socket Mount

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

## File Browser Metadata Exposure

Risk: Backend lists files and directories from the configured host path. Mount is read-only, but filenames, directory names, sizes, and structure may be sensitive.

Impact: Local data disclosure to anyone who can access the UI.

Plan:

- Keep `HOST_FILES_DIR` as narrow as possible.
- Add auth before use outside trusted local development.
- Add per-user allowlists or explicit directory selection later.
- Avoid mounting `/home/pi` in production unless required.

Status: Partially mitigated by read-only mount and path traversal checks. Auth gates `/api/files/*` (see `docs/plans/auth-security.md`).

## Path Traversal And Symlink Escape

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

## SQLite File Permissions

Risk: SQLite data directory must be writable by backend uid `1000`. Incorrect permissions can crash backend. Overly broad permissions can expose encrypted settings and future app data.

Impact: Availability issue or local data exposure.

Current Controls:

- Installer creates data directory and sets owner to `1000:1000`.
- Installer sets directory mode `700`.

Plan:

- Add startup diagnostics with clear error messages.
- Consider migration command and backup documentation.

Status: Partially mitigated.

## Dependency And Image Supply Chain

Risk: Docker images and npm packages are pulled from external registries. Tags such as `minimaglobal/minima:dev` are mutable.

Impact: Unexpected updates, compromised dependencies, reproducibility issues.

Plan:

- Pin image digests for production.
- Avoid `:dev` tags outside prototyping.
- Add automated `npm audit` and image vulnerability scanning.
- Review native dependency `better-sqlite3` updates.

Status: Open.

## One-Line Curl Installer

Risk: `curl | sudo bash` executes remote code as root.

Impact: If GitHub, DNS, TLS trust, or repository contents are compromised, host compromise is possible.

Plan:

- Publish checksums or signed releases.
- Support downloading and inspecting installer before running.
- Consider package repository, deb package, or signed install bundle.
- Keep installer minimal and auditable.

Status: Open. Accepted for prototype UX exploration.
