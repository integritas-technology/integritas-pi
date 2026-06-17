# Handoff

**Current:** v0.6.0 (Jun 2026)  
**Baseline:** v0.2.0 (`d26746e`, Jun 9) — auth/setup, Integritas stamp + config, Minima resync + balance passthrough, data sources + automation, diagnostics, toasts, data-source edit/health UI

**Architecture:** browser / CLI → backend API → SQLite / Minima RPC / Integritas upstream

**Delta:** four releases (0.3.0–0.6.0), ~62 commits, `backend/src/features/wallet/` added, Minima/Integritas/status substantially expanded

---

## API — Integritas (v0.3.0)

- `POST /api/integritas/api-key/check` (admin) — validate stored key upstream
- `POST /api/integritas/history/poll-pending` — batch refresh pending proofs
- `GET /api/integritas/config` — includes `portalUrl` from `INTEGRITAS_PORTAL_URL`
- Upstream client: `INTEGRITAS_REQUEST_TIMEOUT_MS`, retry on 429/502/503 + network errors, structured `errorCode`
- Invalid Integritas key returns 403 + `errorCode: unauthorized`; does not clear session

## API — Minima (v0.4.0)

- `GET /api/minima/status` — reworked to normalized node view (chain, peers, container CPU/memory/disk, sync state, `monitoring`)
- `GET /api/minima/peers`, `POST /api/minima/peers/add` (admin)
- `POST /api/minima/restart` (admin) — Docker container restart, audit-logged
- `monitoring` block on status — stall detection from health poller
- `GET /api/minima/balance` — unchanged legacy passthrough

## API — Device (v0.5.0)

- `GET /api/status` — device ID (UUID in settings), hostname, platform, arch, uptime, CPU, memory, load, disk (`/data`), setup state, cached Minima state, Integritas API probe (3 s timeout, 30 s cache)
- `GET /api/status/overview` — Minima check now uses same normalized status logic

## API — Wallet (v0.6.0)

Admin unless noted.

- `GET /api/wallet` — normalized token balances (`balance` RPC)
- `GET /api/wallet/accounts`, `POST /api/wallet/accounts` — labeled accounts + per-address balances (`coins relevant:true`)
- `POST /api/wallet/receive-address` — random address from 64-address pool (`getaddress`, not `newaddress`)
- `POST /api/wallet/send-payment` — `send` RPC; returns `txpowId`; persisted to history
- `GET /api/wallet/payment-status/:txpowid` — `pending | confirmed | failed | unknown`
- `GET /api/wallet/history` — send history with account annotations
- `POST /api/wallet/import` — BIP-39 seed restore via `restore` RPC (destructive, audit-logged, phrase never logged)
- `POST /api/wallet/debug/clear-wallet-accounts`, `POST /api/wallet/debug/clear-wallet-history` — dev only (`NODE_ENV=production` returns 403)

---

## Background jobs

| Job | Added | Role |
|-----|-------|------|
| Integritas proof poller | v0.3.0 | Poll pending proofs on `INTEGRITAS_POLL_INTERVAL_SECONDS`; timeout via `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` |
| Minima health poller | v0.4.0 | Stall detection on `MINIMA_HEALTH_POLL_INTERVAL_SECONDS`; optional auto-resync (`MINIMA_AUTO_RESYNC`) |
| Automation scheduler | baseline | Unchanged; transient stamp failures deferred in v0.3.0 |

Graceful shutdown (v0.5.0): SIGTERM/SIGINT stop all schedulers, close SQLite.

---

## Persistence (new since baseline)

- `wallet_accounts` — `label`, `address`, `mini_address`, `public_key`
- `wallet_send_history` — `txpow_id`, amounts, addresses, account labels
- Device UUID in `settings` (`device_id` key)

---

## Frontend (since baseline)

**Integritas (v0.3.0)**

- Config modal: check key, validity badge, portal link, card layout
- Stamp-result modal after file upload; auto-refresh while pending
- Diagnostics: per-row poll removed from UI; header refresh action (pending count) calls `poll-pending`

**Minima Core (v0.4.0)**

- Summary cards + node health grid; 30 s refresh
- Configure modal: Megammr host, peer list/add
- Container restart control; stall warning; resync UX (polling pause, auto-restart, toasts)
- Modal portal rendering (fixes positioning in transformed cards)

**Dashboard (v0.5.0–v0.6.0)**

- Live-status grid (7 cards: device, CPU, memory, disk, node, Integritas API, wallet) from `GET /api/status`, 30 s poll
- Wallet balance metric with `MinimaIcon`

**Wallet (v0.6.0)**

- Accounts-first UX: create/detail modals, per-account receive addresses
- Send: source account, internal or external recipient, balance guard
- Seed import modal; export placeholder (deferred)
- Token filter tabs, send history card, `CopyableCode`

---

## Config (new env vars)

```
INTEGRITAS_REQUEST_TIMEOUT_MS=15000
INTEGRITAS_POLL_INTERVAL_SECONDS=30
INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES=5
INTEGRITAS_PORTAL_URL=
MINIMA_HEALTH_POLL_INTERVAL_SECONDS=60
MINIMA_STALL_BLOCK_AGE_SECONDS=300
MINIMA_AUTO_RESYNC=false
MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES=30
```

---

## Security (since baseline)

- Docker socket mount writable for `POST /api/minima/restart` — see `SECURITY.md`
- Wallet import/send admin-only; seed phrase never logged or returned
- Integritas API key check uses stored key server-side only

---

## Fixes (notable)

- `getaddress` used instead of `newaddress` for receive addresses (was creating new key material)
- Minima status: suppress transient `fetch failed` during resync/restart; parse `chain.time`, `network.connected`, `memory.ram`/`memory.disk`
- Megammr resync: frontend restarts container when RPC response indicates restart (not backend auto-restart on resync endpoint)

---

## Entry points

| Area | Path |
|------|------|
| Routes | `backend/src/app.ts` |
| Startup / schedulers | `backend/src/index.ts` |
| Schema | `backend/src/db/database.ts` |
| Wallet | `backend/src/features/wallet/` |
| Minima | `backend/src/features/minima/` |
| Integritas | `backend/src/features/integritas/` |
| Device status | `backend/src/features/status/` |
| Changelog | `CHANGELOG.md` |

---

## Verify

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Spot-check: Dashboard (`/api/status`), Minima Core (`/api/minima/status`, resync), Wallet (accounts, send), Integritas (stamp → pending → ready), Diagnostics (history).
