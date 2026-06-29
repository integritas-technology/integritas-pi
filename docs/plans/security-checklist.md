# Security Checklist

**Status:** In progress  
**Created:** 2026-06-25  
**Goal:** Self-hosted Pi appliance is safe enough for V1 — encrypted LAN traffic, authenticated admin, documented accepted risks.  
**Not V1:** public web hosting, domains, Let's Encrypt, HSTS, operator-managed CA trust.

**Related:** [SECURITY.md](../../SECURITY.md), [gaps.md](../qa/gaps.md)

---

## V1 threat model (keep it simple)

| Threat                                                            | V1 response                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| Passive LAN sniffing (passwords, cookies, API keys, seed phrases) | **HTTPS** on default Docker deploy                   |
| Unauthenticated admin API use                                     | **Login + TOTP + sessions**                          |
| Cleartext session cookies                                         | **`COOKIE_SECURE=true`** on HTTPS deploy             |
| Active MITM with fake cert (user clicks through)                  | **Documented** — self-signed does not prove identity |
| Operator has no domain / fixed URL                                | **No HSTS, no LE** — out of scope                    |

---

## Done (shipped)

- [x] Self-signed TLS on install (`scripts/generate-tls-cert.sh`, nginx `:443`)
- [x] `COOKIE_SECURE=true` on Docker deploy and installer `.env`
- [x] HTTPS-only on `${FRONTEND_PORT}` (plain HTTP rejected on that port)
- [x] `npm run dev:https` for local HTTPS testing
- [x] Admin auth: password + TOTP, HttpOnly `SameSite=Strict` cookies, protected `/api/*`
- [x] Login/setup rate limiting, generic login errors
- [x] Integritas API key encrypted at rest (`APP_SECRET`)
- [x] README + SECURITY.md updated for HTTPS deploy

---

## Implement before V1 sign-off

Work through these in order. Gap IDs refer to [gaps.md](../qa/gaps.md#auth).

| #   | Item                                                                                                               | Why                             | Gap    |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------ |
| 1   | **Security headers** (nginx): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, minimal CSP          | XSS / clickjacking defense      | GAP-07 |
| 2   | **`APP_SECRET` startup guard** — refuse default secret in production-like mode                                     | Weak encryption if `.env` leaks | GAP-04 |
| 3   | **Auth route automated tests** (401, rate limit, setup guard)                                                      | Prevent regressions             | GAP-02 |
| 4   | **TOTP setup decision** — keep manual secret with HTTPS documented (option B) or remove secret from API (option A) | Setup-time secret exposure      | GAP-05 |
| 5   | **CSRF posture** — document `SameSite=Strict` as V1 baseline (accept or add tokens)                                | Mutation abuse                  | GAP-06 |
| 6   | **Manual auth E2E checklist** on fresh `DATA_DIR`                                                                  | Wizard/login not broken         | GAP-03 |

Record any deferred item as an **accepted risk** in [SECURITY.md](../../SECURITY.md).

---

## Verify once (manual — Pi or `docker compose`)

Run after HTTPS deploy; tick when passed.

- [ ] `curl -vk https://<pi-ip>:8080/api/health` → TLS 1.2/1.3, `200`, JSON body
- [ ] `curl -v http://<pi-ip>:8080/api/health` → fails or `400` (not cleartext app traffic)
- [ ] `openssl s_client -connect <pi-ip>:8080 </dev/null 2>/dev/null | openssl x509 -noout -ext subjectAltName` → includes Pi LAN IP
- [ ] Log in via browser → DevTools → `session` cookie has **Secure**, **HttpOnly**, **SameSite=Strict**
- [ ] Optional: Wireshark/`tcpdump` during login → no readable `password` / `totpToken` in capture
- [ ] Seed phrase import only tested over `https://` (not `npm run dev` HTTP)

---

## Explicitly out of scope for V1

Do **not** block V1 on these (self-hosted appliance, no control over user URL/devices):

- HSTS
- Let's Encrypt / domains / DNS
- Caddy / external reverse proxy as default path
- Private CA + “install cert on every device”
- CLI session auth (GAP-16 in [gaps.md](../qa/gaps.md))
- Replacing Docker socket mount

---

## V1 sign-off

V1 security is **accepted** when:

- [ ] All items in **Implement before V1 sign-off** are done **or** accepted in `SECURITY.md`
- [ ] All items in **Verify once** are checked on a Pi deploy
- [ ] `npm run check` + `docker compose build` pass
- [ ] [gaps.md](../qa/gaps.md) sign-off criteria reviewed

Then mark this plan **Complete** and move remaining P1/P2 items to QA only.
