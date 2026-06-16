# Changelog

All notable changes to `integritas-pi` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) at the package level.

## [Unreleased]

### Added

- `GET /api/wallet` — auth-protected wallet endpoint returning a normalized `WalletStatus` (checkedAt, tokens array). Each `TokenBalance` includes tokenId, name, confirmed, unconfirmed, sendable, and an `isNative` flag (`tokenId === "0x00"`). Wraps the existing Minima `balance` RPC; the legacy `GET /api/minima/balance` passthrough is unchanged.
- `POST /api/wallet/receive-address` (admin) — returns one of the node's 64 pre-created default wallet addresses at random via the Minima `getaddress` RPC command. Response includes `miniAddress` (Mx… native format, primary for sharing), `address` (0x… hex), and `publicKey`. Does not create new key material.
- `POST /api/wallet/send-payment` (admin) — sends MINIMA or tokens via `send amount:X address:Y tokenid:Z`. Validates address and amount server-side. Returns `txpowId` and `status: "pending"` on submission; audit-logged with address, amount, tokenId, and txpowId (never logs seed phrases or secrets).
- `GET /api/wallet/payment-status/:txpowid` (any authenticated user) — polls the Minima `txpow` command for a submitted transaction and returns `pending | confirmed | failed | unknown`.
- Wallet page redesign: dark hero balance card with MINIMA icon watermark, confirmed/unconfirmed/sendable stats, and two action buttons — **Receive address** and **Send payment**.
- Receive address modal: fetches a random address from the node's 64-address pool, displays Mx (primary) and 0x formats, one-click clipboard copy, and a "Get another address" button to sample a different address.
- Send payment modal: form with recipient address (accepts both Mx and 0x formats), amount, and token selector (built from the live token list). On submit, transitions to a pending state that polls `payment-status` every 5 s for up to 60 s; shows confirmed/failed/timeout states inline and fires a toast on each terminal state. Closes cleanly mid-poll with an info toast.
- Token holdings table with All / Minima / Tokens filter tabs (subtabs component). MINIMA icon shown inline next to native token confirmed balance.
- Dashboard wallet balance card: shows confirmed MINIMA with MINIMA icon inline in the metric grid. Non-blocking — shows "Unavailable" if the node is unreachable.
- `MinimaIcon` component: reusable inline SVG using `currentColor`, used across Wallet page and Dashboard.
- `POST /api/wallet/import` (admin) — restores wallet from a 24-word BIP-39 seed phrase via Minima `restore` RPC. Overwrites the node's current wallet; the node may restart after import. Audit event `wallet.import` is recorded without the phrase. Input is validated server-side (minimum 12 words).
- Import wallet modal on Wallet page: textarea for seed phrase entry, destructive-action warning, success/error inline feedback, and a toast on completion.
- Disabled "Export wallet" button on Wallet page as a placeholder for the deferred encrypted backup feature.
- `POST /api/wallet/accounts` (admin) — creates a labeled wallet account by assigning one random default Minima address (`getaddress`) and storing it in SQLite.
- `GET /api/wallet/accounts` — returns labeled wallet accounts with per-address balances and token counts derived from Minima `coins relevant:true`.
- Wallet page account architecture: account list cards, create-account modal, account details modal, and send form source-account selection.
- Wallet fallback for migration/recovery: unlabeled funded addresses are now surfaced from `coins relevant:true` and can be labeled directly into accounts.
- Wallet fallback labeling now resolves and persists `miniaddress` (`Mx...`) for imported `0x...` addresses when available from the node's default address pool.
- Wallet token display for per-address funds now uses Minima `tokenamount` and token metadata names (when present), fixing raw token-id labels and tiny scientific-notation amounts.
- Dev-only wallet debug action: `POST /api/wallet/debug/clear-wallet-accounts` (admin, blocked in production) clears labeled wallet accounts from SQLite to speed up local label/unlabel testing. Wallet page now shows a `Debug: clear labels` button only in frontend dev mode.

### Fixed

- `generateAddress` renamed to `getReceiveAddress` throughout — was incorrectly calling `newaddress` (creates new key material) instead of `getaddress` (returns from the node's 64 pre-created address pool).

## [0.5.0] - 2026-06-12

System basic status and health checks added to Dashboard with 30s auto-polling, and graceful shutdown to backend systems.

### Added

- `GET /api/status` — new auth-protected device summary endpoint: stable device ID (UUID persisted in `settings`), hostname, platform, arch, uptime, CPU count, host memory, load averages, disk usage (`/data`, falling back to `/`), setup state, Minima node state (from poller cache), and a live Integritas API connection check (3 s timeout, 30 s server-side cache).
- Graceful shutdown: SIGTERM and SIGINT now stop all background schedulers (automation, Integritas proof poller, Minima health poller) and close the SQLite connection before exiting.
- Dashboard live-status grid: six metric cards (Node status, Device, Integritas API, CPU, Memory, Disk) fed by `GET /api/status`, auto-polling every 30 seconds. No Minima RPC or Docker socket calls on the dashboard path.

## [0.4.0] - 2026-06-11

Minima node status, health monitoring, container restart, peer management, and Minima Core UI.

### Fixed

- Minima status no longer shows raw `fetch failed` during resync/restart when last-known stats are still shown; transient RPC blips are suppressed and post-operation refresh retries until Minima is back.
- Minima UX: removed duplicate Peer connections section (configured peer list vs active P2P count were different metrics); health card now shows **Active peers** from status RPC; add-peers moved to Configure Minima.
- Megammr resync now automatically restarts the Minima container when Minima reports a restart is required.
- Minima container restart control moved to a header icon on the Container card.
- Modal dialogs (including JSON preview on Minima resync) now render via a document portal, fixing incorrect positioning and hover flicker inside cards that use CSS transforms.
- Minima status parsing now reads `chain.time`, `network.connected`, and `memory.ram` / `memory.disk` from the live `status` RPC response; falls back to allowlisted `block` / `peers` commands when needed.
- Minima resync UX: pause health polling during resync, keep last known stats when RPC blips, derive sync status as Active/Stale/Syncing, and show accurate resync toasts (including restart hint when Minima reports resync finished).

### Changed

- Minima Core page layout aligned with the Edge Workbench mock: three summary cards (node, sync, storage) and a Node health stat grid.
- Minima Core splits **Node health** (RPC: node memory, peers, blocks) from **Container** (Docker: CPU, container memory, state, runtime); node memory no longer falls back to Docker stats.
- `GET /api/status/overview` Minima service check now uses the same normalized node status logic as `/api/minima/status`.

### Added

- Minima Phase 3: `POST /api/minima/restart` (admin, Docker container restart with audit log), `GET /api/minima/peers`, `POST /api/minima/peers/add` (admin, allowlisted `peers action:addpeers`), Minima Core UI for restart and peer list/add, and `node:test` fixtures for `minima.parse.ts`.
- Backend Minima health poller: detects chain stalls on an interval (`MINIMA_HEALTH_POLL_INTERVAL_SECONDS`), exposes `monitoring` on `GET /api/minima/status`, and optionally triggers Megammr auto-resync when `MINIMA_AUTO_RESYNC=true`.
- Minima Core UI shows a stall warning when `monitoring.stallDetected` is true.
- Minima node status API returns a normalized operator view: container state, chain block/age, peer count, CPU/memory, and container disk (`GET /api/minima/status`).
- Minima Core page shows structured node health cards with 30s auto-refresh; RPC debug JSON is collapsible. Megammr resync failures surface via toast.
- Configure Minima modal: Integritas-style layout with runtime config, Megammr host, and peer list/add in one place (settings icon on the page header).

### Security

- Backend Docker socket mount is writable (not read-only) so admin-only `POST /api/minima/restart` can restart the Minima container; see `SECURITY.md`.

## [0.3.0] - 2026-06-11

Integritas integration hardening and proof polling, plus data-source health/editing, shared toast notifications, and runtime config UX.

### Added

- Integritas runtime config: **Check key** button and validity badge via `POST /api/integritas/api-key/check` (admin). Uses the stored key server-side only; auto-checks when the modal opens if a key is configured.
- Data sources can now store an optional health status URL; the Added data sources table polls it once per minute through the backend and shows a green/red status indicator with the latest response.
- Shared frontend toast system for transient API/action errors, starting with Data Sources actions.
- Data sources can now be edited from the Added data sources table.
- Integritas upstream HTTP client hardening: request timeouts (`INTEGRITAS_REQUEST_TIMEOUT_MS`), transient retry with backoff for `429`/`502`/`503` and network errors, and structured `errorCode` on failed stamp/status/verify API responses.
- Background Integritas proof poller: pending proof records are status-checked on an interval (`INTEGRITAS_POLL_INTERVAL_SECONDS`, default 30s) without manual Diagnostics polling.
- Integritas retry policy: automation treats transient stamp failures as deferred retries; pending proofs time out after `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` (default 5) if on-chain confirmation never completes.
- Integritas page UX: friendly stamp-result modal after file upload (proof UID, hash, on-chain status with optional live poll); portal link in Integritas config modal via `INTEGRITAS_PORTAL_URL` / `GET /api/integritas/config` `portalUrl`.
- `docs/reports/integritas-integration-audit.md` — implementation audit for Integritas Phases 1–3, 5–6.

### Changed

- Integritas runtime config modal: runtime details, portal link, and API key controls each sit in separate cards; key validity and last-checked time share one row.
- Data source template cards now use the clearer `Add source` call to action instead of `Use template`.
- Added data source row actions now use accessible icon buttons for manual trigger, edit, and delete.
- Integritas upstream API key rejection no longer logs the user out: session `401` stays separate from Integritas `errorCode: unauthorized` (HTTP 403 + toast). Invalid keys show a non-destructive error and open Configure Integritas when stamping.
- Integritas proof status UX: backend poller runs immediately on startup; Diagnostics, Dashboard, and the stamp-result modal auto-refresh history while proofs are pending (no manual page reload).
- Diagnostics proof history: per-row Poll removed; single **Refresh pending** header action calls `POST /api/integritas/history/poll-pending` (same batched upstream logic as the background poller).
- Integritas sandbox integration tests moved from feature Phase 4 to the planned QA phase; see `docs/qa/README.md`.
- Documentation layout: `docs/plans/` (implementation plans with status), `docs/qa/` (open gaps and checklists), `docs/reports/` (audits only); index at `docs/README.md`. Auth plans marked **Complete**; Integritas plan **In progress**.

## [0.2.0] - 2026-06-09

Local authentication, first-run setup, and related UI/platform work merged.

### Added

#### Authentication and sessions

- Backend auth feature (`backend/src/features/auth/`): admin login with password + TOTP, HttpOnly session cookies, hashed session tokens in SQLite, login rate limiting, and audit events for login/logout.
- Protected API surface: all `/api/*` routes except `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, and `POST /api/auth/login` require a valid session (`requireAuth` in `backend/src/app.ts`).
- Role-gated admin mutations: Integritas API key changes, file browser access, and automation/data-source mutations require `admin` role.
- New auth API routes:
  - `POST /api/auth/login` — password + TOTP; sets session cookie
  - `POST /api/auth/logout` — clears session
  - `GET /api/auth/me` — current user profile
  - `GET /api/setup/status` — whether first-run setup is complete
  - `POST /api/setup/totp/init`, `POST /api/setup/totp/verify` — TOTP enrollment during setup
  - `POST /api/setup/integritas/verify` — validate Integritas API key during setup
  - `POST /api/setup/complete` — finish setup and create admin session
- SQLite migrations for `users`, `sessions`, and related auth columns in `backend/src/db/database.ts`.
- Session configuration via `.env`: `COOKIE_SECURE`, `SESSION_MAX_AGE_DAYS`, `SESSION_IDLE_HOURS`.

#### First-run setup wizard

- Frontend setup wizard (`frontend/src/features/setup/`) shown when setup is incomplete: welcome, password, TOTP enrollment, Integritas API key, and completion steps.
- `AuthProvider` bootstrap flow: setup wizard → login → authenticated app shell.
- Sidebar user box with sign-out (`frontend/src/features/auth/SidebarUserBox.tsx`).
- Login page with password and TOTP fields (`frontend/src/features/auth/LoginPage.tsx`).

#### UI and feature pages

- **Wallet page** — Minima balance read through allowlisted backend RPC (`GET /api/minima/balance`).
- **Diagnostics page** — consolidated Integritas proof history and data-read history in tabbed views (replaces separate Data Reads nav entry).
- **Minima page** — Configure Minima modal (Megammr host stored in SQLite), Megammr resync action (`POST /api/minima/megammrsync/resync`).
- **Integritas page** — Configure Integritas modal for runtime API key management.
- **Data Sources page** — add-source flow moved into a modal.
- **Dashboard** — activity feed (recent Integritas proofs and data reads), use-case/build-flow sections, and “Start setup” navigation.
- **App shell** — service status pills in the header (backend, Minima, Integritas).
- Reusable `Modal` component (`frontend/src/components/Modal.tsx`).

#### Backend (non-auth)

- Minima config persistence and allowlisted RPC helpers in `backend/src/features/minima/minima.service.ts` (`getMinimaConfig`, `saveMinimaConfig`, `getWalletBalance`, `resyncMegammr`).
- `backend/src/db/ensureDatabaseDirectory.ts` for safer database directory creation on startup.
- `backend/src/config/loadEnv.ts` for local development env loading.

#### Development tooling

- Root `npm run dev`, `dev:frontend`, and `dev:backend` scripts for native iteration without Docker rebuilds.
- Root `postinstall` to install backend and frontend dependencies.
- `frontend/vite.config.ts` with `/api` proxy to the backend during local dev.
- Tailwind CSS integration in the frontend build.

#### Documentation

- `docs/auth-implementation.md` — Phase 1 auth implementation plan aligned with this repo.
- `docs/auth-security.md` — auth security model and checklist.
- `docs/reports/auth-implementation-audit.md` — implementation audit report.
- `docs/reports/auth-qa-gaps.md` — QA and testing gap tracker.
- `.cursor/rules.mdc` — project documentation rules for Cursor.
- Expanded `README.md`, `SECURITY.md`, and `AGENTS.md` for auth, sessions, and Minima allowlist behavior.

### Changed

- `frontend/src/App.tsx` — wrapped in `AuthProvider`; pages render only after authentication; setup page receives `onSignOut`.
- `frontend/src/lib/api.ts` — all fetches use `credentials: "include"`; centralized JSON helpers and `401` handler to return user to login.
- Wallet and Diagnostics nav entries now route to real pages instead of `EmptyPage` placeholders.
- Data Reads removed as a standalone sidebar item; history is available under Diagnostics.
- Integritas proof history removed from the Integritas page; history actions live under Diagnostics.
- `docker-compose.yml` — `APP_SECRET` and session-related env vars passed to the backend container.
- `frontend/Dockerfile` — build adjusted for Vite config.

### Security

- Passwords hashed with bcrypt; TOTP secrets encrypted with existing `APP_SECRET`-backed crypto.
- Generic login errors (`Invalid credentials`) to avoid account enumeration.
- Session cookies: HttpOnly, `SameSite=Strict`, optional `Secure` flag for HTTPS deploys.
- Documented prototype limits: CLI has no session auth in V1 (protected API calls return `401` without a browser session).

### Known limitations

- CLI (`bin/integritas-pi`) does not authenticate; operational commands against protected routes will receive `401` until a later CLI auth story is added.
- Guest/mock login paths were removed; V1 is admin-only.
- Automated npm audit may report transitive `tar` advisories in backend dev dependencies; unrelated to runtime auth behavior.
