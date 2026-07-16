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

## Update Agent Docker Socket Mount

Risk: The `update-agent` service mounts `/var/run/docker.sock` to pull images by digest and recreate `frontend`/`backend`/`minima` containers during an update. Docker socket access is host-root-equivalent: any process holding the mount can start a privileged or host-mounted container regardless of whether the socket is reachable over the network.

Impact: If `update-agent` is compromised (e.g. via a flaw in its manifest parsing or HTTP handling), the attacker gains the same practical privilege as host root.

Current Controls:

- `update-agent` has no host-exposed port; it is reached only through `frontend`'s nginx (`/update`), and its `/status`/`/apply` endpoints require an authenticated admin session (verified against `backend`'s existing session store via `GET /api/auth/me`).
- No generic Docker command surface — only the specific pull/create/start/stop/remove/inspect calls needed to apply a signed update.
- No dependencies beyond `express`; no endpoints beyond `/status`, `/apply`, and its static update page.
- Update manifests must be signed (Ed25519) with a private key that only exists in GitHub Actions Secrets; `update-agent` verifies the signature against an embedded public key before trusting any digest.
- Deliberately not merged with TLS termination/routing duties — a bug in `update-agent` does not also hand over the public-facing routing layer, and vice versa.

Plan:

- Treat "`update-agent` compromised → Pi compromised" as an accepted risk for V1, mitigated by minimal code surface rather than network placement (the mount itself cannot be made safe if the holding process is compromised).
- Revisit only if a narrower Docker control surface (e.g. a proxy with an explicit allowlist) becomes necessary; out of scope for V1.

Status: Accepted risk, documented. See `docs/plans/update-service.md`.

## Update Manifest Signing Key

Risk: The `update-agent` update flow trusts any manifest whose signature verifies against the embedded Ed25519 public key. Compromise of the corresponding private key would let an attacker publish a manifest pointing at attacker-controlled image digests.

Impact: A stolen signing key could be used to make `update-agent` pull and run arbitrary images on every Pi in the field, which — combined with `update-agent`'s `docker.sock` access — is equivalent to full host compromise on affected devices.

Current Controls:

- The private key is generated once, manually, and stored only in GitHub Actions Secrets. It never exists on the VPS or any Pi.
- CI signs the manifest in a single job step; the key is read from the secret into an environment variable for that step only and is never written to a file that survives the job.
- `update-agent` only ever holds the public key, baked into its image at build time.
- Digest pinning means a valid signature alone is not sufficient to run a different artifact than what the digest names — an attacker would need both a stolen key and control of a pushed image.

Plan:

- If the key is ever suspected compromised, rotate it (generate a new keypair, update the GH secret, ship the new public key in a `update-agent` release) and document the rotation in this file.

Status: Accepted risk, documented. See `docs/plans/update-service.md`.

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
