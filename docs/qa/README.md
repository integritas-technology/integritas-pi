# QA Phase — Testing & Security Hardening

**Status:** Planned — run after core feature implementation, before field deploy sign-off  
**Created:** 2026-06-09

This document is the **single entry point** for work deferred to QA: automated tests, manual checklists, and security hardening that should not block ongoing feature development.

Docs index: [README.md](../README.md)  
Detailed auth backlog: [auth-gaps.md](./auth-gaps.md)  
Integritas feature plan: [integritas-integration.md](../plans/integritas-integration.md)  
Minima node plan: [minima-node.md](../plans/minima-node.md)  
Minima gaps: [minima-gaps.md](./minima-gaps.md)  
Security model: [auth-security.md](../plans/auth-security.md), [SECURITY.md](../../SECURITY.md)

---

## Why a separate QA phase

Feature work (Integritas backend, frontend UX, automation, etc.) can ship incrementally. **QA** bundles:

- Tests that need secrets (Integritas sandbox API key) or a fresh `DATA_DIR`
- Auth security hardening (HTTPS, headers, CSRF decisions, `APP_SECRET` enforcement)
- End-to-end manual passes operators run before trusting a Pi on a network

Do **not** block Phase 5 Integritas UI or other product work on completing QA — but do **not** treat the prototype as production-ready until QA exit criteria are met or risks are explicitly accepted in `SECURITY.md`.

---

## QA exit criteria (project-level)

- [ ] Auth P0 gaps closed or accepted — see [auth-gaps.md](./auth-gaps.md#exit-criteria-auth-qa-sign-off)
- [ ] Integritas sandbox integration tests passing locally with `INTEGRITAS_SANDBOX_API_KEY` (optional in CI)
- [ ] Integritas manual checklist below passed on a Pi or dev stack with a real API key
- [ ] `npm run check` + `docker compose build` clean
- [ ] `SECURITY.md` updated with deploy mode (HTTP LAN vs HTTPS) and any accepted risks

---

## Workstream A — Auth security & tests

**Source:** [0.2.0 auth release](../CHANGELOG.md#020---2026-06-09) implemented login, sessions, setup wizard, and route protection. Security controls are **prototype-grade** until QA closes gaps.

| Priority | Topic | Detail doc |
|---|---|---|
| **P0** | HTTPS / `COOKIE_SECURE` / HSTS | [GAP-01](./auth-gaps.md#gap-01--transport-security-https--secure-cookies) |
| **P0** | Automated auth route tests (401, rate limit, setup guard) | [GAP-02](./auth-gaps.md#gap-02--automated-auth-security-tests) |
| **P0** | Manual wizard + login E2E checklist | [GAP-03](./auth-gaps.md#gap-03--manual-end-to-end-auth-test-script) |
| **P0** | `APP_SECRET` production validation | [GAP-04](./auth-gaps.md#gap-04--app_secret-startup-validation) |
| **P0** | TOTP secret in setup API (decision + doc) | [GAP-05](./auth-gaps.md#gap-05--totp-secret-in-setup-api-response) |
| **P0** | CSRF posture (SameSite-only vs tokens) | [GAP-06](./auth-gaps.md#gap-06--csrf-baseline-for-mutations) |
| **P0** | Security headers (CSP, frame deny, etc.) | [GAP-07](./auth-gaps.md#gap-07--security-headers-xss-defense-in-depth) |
| **P1** | Session cleanup, rate limits on stamp/automation, `zod` validation, `requireRole` on Integritas mutations | [GAP-08–13](./auth-gaps.md#p1--complete-during-qa-phase-recommended) |
| **P2** | Argon2, CLI auth, pen test | [GAP-14–18](./auth-gaps.md#p2--post-qa-hardening-does-not-block-other-features) |

**Suggested order:** Follow [auth-gaps.md § Suggested QA phase order](./auth-gaps.md#suggested-qa-phase-order).

---

## Workstream B — Integritas sandbox integration tests

**Deferred from:** [integritas-integration.md Phase 4](./plans/integritas-integration.md#phase-4--integration-tests-sandbox-deferred-to-qa)  
**Why deferred:** Requires `INTEGRITAS_SANDBOX_API_KEY`; not suitable for default CI without secrets.

### Scope

Add `backend` tests (e.g. `node:test`) behind an env flag:

| Test flow | Covers |
|---|---|
| Validate API key | `validateIntegritasApiKey` / stamp with test hash |
| Stamp known hash | `requestProofUid` → UID |
| Poll until on-chain or timeout | `pollProofStatus` / `refreshProofRecord` |
| Optional verify | `verifyProof` when payload ready |

### Commands (to implement in QA)

```bash
INTEGRITAS_SANDBOX_API_KEY=... npm --prefix backend run test:integritas
```

- Root `npm run check` stays **without** sandbox tests (typecheck + audit only).
- Document key setup in `README.md` when tests land.

### Files (expected)

- `backend/src/features/integritas/integritas.integration.test.ts`
- `backend/package.json` script `test:integritas`
- `.env.example` — `INTEGRITAS_SANDBOX_API_KEY`

---

## Workstream C — Integritas manual QA

Run on a stack with Integritas API key configured (UI or `INTEGRITAS_API_KEY` in `.env`).

### Core flows

- [ ] Save API key in Integritas config modal → `GET /api/status/overview` shows integritas ok
- [ ] Stamp file on Integritas page → `GET /api/integritas/history` shows `pending` with UID
- [ ] Wait one poll interval (~30s) → same record becomes `ready` or `failed` without manual Poll
- [ ] Diagnostics manual Poll still works on a pending record
- [ ] Export selected proof payloads downloads JSON
- [ ] Verify proof file (upload exported JSON) returns success when on-chain

### Retry / resilience (Phases 1–3)

- [ ] Invalid API key on stamp → `errorCode: unauthorized`; no infinite retry loop
- [ ] Automation workflow with stamp enabled → proof row linked in data reads
- [ ] After transient upstream error (if reproducible), next automation run retries stamp with `last_hash` preserved

### Frontend (after Phase 5 ships)

- [ ] Post-stamp modal shows friendly UID/hash/status (not raw JSON only)
- [ ] Integritas config modal includes portal link opening in new tab

### CLI

- [ ] `integritas-pi integritas history` without session → `401` (documented V1 limit)

---

## Workstream E — Minima node QA

**Source:** [minima-node.md](../plans/minima-node.md) — Phases 1–3 shipped (see git: `d37da21` … `13c041f` on `minima-node-control-service`).  
**Detail:** [minima-gaps.md](./minima-gaps.md)

| Priority | Topic |
|----------|--------|
| **P0** | Stopped container state, resync+restart UI, restart audit, peers modal, `npm run test` |
| **P1** | Admin gate on resync/config (open decision), auto-resync without container restart, AppShell overview refresh, Docker socket writable |
| **P2** | Live RPC integration tests (`MINIMA_INTEGRATION_TEST=1`), CLI, peer remove, peers 502 vs status 200 |

**Unit tests (shipped):** `backend/src/features/minima/minima.parse.test.ts` via `npm run test`.

---

## Workstream D — Build & deploy smoke

- [ ] `npm run check`
- [ ] `npm --prefix backend run build` && `npm --prefix frontend run build`
- [ ] `docker compose config` && `docker compose build`
- [ ] Fresh install path: empty `DATA_DIR` → setup wizard → login → Integritas page loads
- [ ] `bash -n install.sh` && `bash -n bin/integritas-pi`

---

## What stays in feature work (not QA)

These are **implementation**, not QA backlog:

| Item | Plan reference |
|---|---|
| Integritas page UX (stamp modal, portal link) | [integritas-integration.md Phase 5](./plans/integritas-integration.md#phase-5--integritas-page-ux-frontend) |
| Ongoing `CHANGELOG.md` / `README.md` for shipped behavior | Phase 6 in integritas plan |

---

## Sign-off template

```txt
QA sign-off — YYYY-MM-DD

Auth P0: [ ] closed  [ ] accepted risks in SECURITY.md
Integritas sandbox tests: [ ] passing locally  [ ] skipped (reason)
Integritas manual checklist: [ ] passed
Build/deploy smoke: [ ] passed
Deploy mode: [ ] HTTP LAN  [ ] HTTPS + COOKIE_SECURE=true

Approved for: [ ] continued dev  [ ] field pilot  [ ] production
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-11 | Workstream E — Minima node QA gaps ([minima-gaps.md](./minima-gaps.md)) |
| 2026-06-09 | Initial QA hub; Integritas integration tests moved out of feature Phase 4 |
