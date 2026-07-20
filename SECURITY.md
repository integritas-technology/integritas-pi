# Security Policy

## Supported Use

Integritas Pi is a prototype intended to run on a trusted local network. It is not hardened for public internet exposure or multi-tenant production use. Only the version on `main` is supported.

## Guidelines

Follow these when deploying, operating, or contributing to this project:

- Never expose the backend, Minima RPC, or the Docker socket directly to an untrusted network. Access the UI only through the frontend's HTTPS proxy.
- Never enter admin credentials or import a wallet seed phrase over a network connection you cannot verify, even though it is TLS-encrypted. A self-signed certificate proves encryption, not server identity.
- Never disable HTTPS or set `COOKIE_SECURE=false` outside local development.
- Never commit `.env`, `APP_SECRET`, Integritas API keys, or any other credential to version control.
- Never add a generic Minima command proxy or arbitrary shell execution path. Expose only narrow, allowlisted, validated actions.
- Never return secrets, password hashes, TOTP secrets, or raw session tokens from an API response.
- Local admins may use a 6-digit PIN on a trusted LAN or an 8+ character password. Prefer a unique password when stronger protection is needed; only the bcrypt hash is stored, and the credential type is not persisted.
- Treat Docker socket access, GPIO device access, and host file mounts as high-privilege capabilities — keep them opt-in, admin-gated, and off by default wherever possible.
- Preserve `APP_SECRET` across upgrades; losing or changing it makes stored encrypted secrets unrecoverable. For Integritas Connect, the Pi detects decrypt failure, clears the local link (`TOKEN_DECRYPT_FAILED`), and requires reconnect — it does not revoke the device on Connect as revoking requires secret tokens.
- Integritas core calls prefer the Connect account API key decrypted in backend memory. Manually saved and environment API keys remain backend-only fallbacks and are never returned to the browser.
- Pin dependency and image versions before any production-like deployment; avoid mutable tags such as `:dev`.

The detailed risk register — specific risks, current controls, and mitigation plans by area — is maintained separately and kept current as the system changes.

## Reporting A Vulnerability

Open a private security advisory or contact a maintainer directly. Include reproduction steps, affected version, and potential impact.

You should expect an acknowledgment within 48 hours and a more detailed response within 5 business days. There is no bug bounty program.

## Disclosure Policy

Please report privately and allow time for a fix before public disclosure. Once a fix is available, it will be released and noted in `CHANGELOG.md` under a `Security` entry.
