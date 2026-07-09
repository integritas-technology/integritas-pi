# Security Notes And Risk Register

This project is a learning prototype. It is not production-ready and should only be run on a trusted local network while these risks are understood and actively managed.

This file is the lean entry point. Full risk register: `docs/security/`. V1 security sign-off checklist: `docs/plans/security-checklist.md`. Open QA hardening: `docs/qa/gaps.md`. Docs index: `docs/README.md`.

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
- The frontend is reachable on the LAN through `https://<pi-ip>:8080` with a self-signed TLS certificate.
- Backend APIs are reachable through the frontend Nginx `/api` proxy.
- The backend stores local settings in SQLite under `/data/integritas-pi.db`.
- Integritas API keys entered in the UI are encrypted before storage with AES-256-GCM using `APP_SECRET`.
- The backend mounts `/var/run/docker.sock` for prototype container monitoring and allowlisted Minima container restart.
- The backend can read the configured host file directory through `/host-files:ro`.
- Minima RPC is bound to `127.0.0.1` on the host by default, but is reachable by backend over the Docker network.

**Auth (Phase 1 — implemented):** Admin login with password + TOTP, stateful sessions (hashed in SQLite), protected `/api/*` routes, login/setup rate limiting, audit log for secret changes. See `docs/plans/auth-security.md`. Default Docker deploy uses HTTPS with a self-signed certificate and `COOKIE_SECURE=true`.

## Highest-Priority Accepted Risks

The two risks most likely to bite an operator if misunderstood. See `docs/security/` for the complete register.

- **Self-signed TLS does not prove server identity.** Traffic is encrypted, but a network attacker could present a different certificate. Never import a wallet seed phrase or enter credentials over a network you can't verify. Details: `docs/security/auth-and-transport.md`, `docs/security/wallet-and-tokens.md`.
- **The backend mounts the Docker socket** (`/var/run/docker.sock`) for prototype container monitoring and restart. If the backend is compromised, this is a high-value target. Details: `docs/security/host-and-infrastructure.md`.

## Full Risk Register

| Doc | Covers |
|---|---|
| [docs/security/auth-and-transport.md](docs/security/auth-and-transport.md) | LAN access, TLS trust, API keys, `APP_SECRET` |
| [docs/security/host-and-infrastructure.md](docs/security/host-and-infrastructure.md) | Docker socket, file browser, path traversal, SQLite permissions, supply chain, installer |
| [docs/security/wallet-and-tokens.md](docs/security/wallet-and-tokens.md) | Seed phrase import, automated transactions, debug clears, token creation |
| [docs/security/data-sources-and-automation.md](docs/security/data-sources-and-automation.md) | Minima RPC/resync/restart/peers, data source URLs, webhooks, MQTT, GPIO, Integritas proxy |
| [docs/security/low-priority-and-future.md](docs/security/low-priority-and-future.md) | Rate limiting, error detail, logging hygiene, missing security tests |

Development roadmap (beyond V1 sign-off): `docs/plans/security-checklist.md`.

## Reporting Security Issues

This is currently a private learning prototype. For now, document discovered issues in the relevant `docs/security/*` file (or here, if general) and fix them before expanding deployment beyond a trusted local network.
