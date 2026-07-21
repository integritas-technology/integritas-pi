# Auth And Transport Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md#auth) · [plans/security-checklist.md](../plans/security-checklist.md)

## Unauthenticated LAN Access (mitigated, residual TLS trust risk)

Risk: On the default HTTPS deploy, browsers do not trust the self-signed certificate. Users must click through a warning. A network attacker could present a different certificate if users are not careful.

Impact: Session theft remains possible on untrusted networks if users accept a malicious certificate; passive sniffing is mitigated by TLS encryption.

Controls (V1):

- Login required for all `/api/*` routes except health, setup, and login.
- HttpOnly + `SameSite=Strict` session cookies with `Secure` on the default HTTPS deploy; token hashes stored in SQLite.
- TOTP required at setup and login.
- Login/setup rate limiting and generic login errors.
- Self-signed TLS encrypts browser-to-Pi traffic by default.

Residual gap: Self-signed certificates do not prove server identity. CSRF tokens are a follow-up (`SameSite=Strict` is the V1 baseline). Custom trusted certificates or operator-managed reverse-proxy TLS are planned for a later release.

Status: Partially mitigated; see `docs/qa/gaps.md` (GAP-01) for follow-up items (HSTS, custom certs).

## Self-Signed HTTPS UI

Risk: The app is served over HTTPS with an installer-generated self-signed certificate.

Impact: Browsers show security warnings. Users may click through without verifying the certificate, which weakens protection against active man-in-the-middle attacks. Passive LAN sniffing of credentials, cookies, API keys, and seed phrases is mitigated by TLS encryption.

Current Controls:

- Installer generates TLS certificate with SANs for `localhost`, `127.0.0.1`, and the detected LAN IP.
- Nginx terminates TLS; `COOKIE_SECURE=true` on the default Docker deploy.
- Certificates stored under `DATA_DIR/certs`; regenerate with `INTEGRITAS_TLS_FORCE=1 bash scripts/generate-tls-cert.sh` after a LAN IP change.

Plan: See `docs/plans/security-checklist.md` for V2+ custom-certificate/HSTS work.

Status: Mitigated for passive sniffing; residual self-signed trust risk documented.

## Integritas Connect Credentials

Risk: Linking or revoking Integritas Connect is a high-impact mutation. A compromised admin session could link a different account or disrupt proof stamping.

Impact: Service disruption, billing/quota misuse, incorrect stamping under attacker-controlled credentials.

Controls (V1):

- Connect activation (`POST /api/auth/connect/start`, `GET /api/auth/connect/status`) requires an admin session.
- Connect tokens and the derived core API key are stored encrypted in SQLite; never returned to the frontend.
- Device revocation is detected upstream (`DEVICE_REVOKED`) and clears local Connect state.
- Audit events recorded on activation start and revocation.

Status: Mitigated.

## `APP_SECRET` Dependency

Risk: Encrypted local secrets (Integritas API key, TOTP, Connect tokens) can only be decrypted with the same `APP_SECRET` from `.env`. If `APP_SECRET` is lost or changed, stored secrets are unrecoverable. If `.env` leaks together with the database, encrypted secrets can be decrypted.

Impact: Loss of access to saved secrets or compromise when both `.env` and SQLite are obtained.

Plan:

- Preserve `APP_SECRET` during updates.
- Restrict permissions on `/opt/integritas-pi/.env`.
- Add backup/restore documentation.
- Consider integrating OS keyring, TPM, age/sops, or user-provided passphrase for stronger production secret handling.

Status: Partially mitigated by installer preservation. Production design open. See GAP-04 in `qa/gaps.md`.
