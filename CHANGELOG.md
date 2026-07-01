# Changelog

All notable changes to `integritas-pi` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) at the package level.

## [Unreleased]

### Changed

- **Diagnostics tabs**: proof vs read history is reflected in the URL (`/diagnostics?tab=reads`). Refreshing or sharing the link opens the correct tab; only the active tab's list is fetched on load.
- **Diagnostics pagination**: proof and read history lists are server-paginated with URL-backed `tab`, `page`, `pageSize`, `status`, and `q` filters (`tab`, `page`, and `pageSize` are always written to the URL, including defaults). Shared pager/filter bar on the Diagnostics page.
- **Diagnostics cleanup**: removed debug `JsonPreview` footer, deduplicated paginated fetch helpers, and avoid double-fetch after poll-pending (uses paginated poll response directly).

### Added

- `GET /api/integritas/history/:id` — fetch a single proof record by id (used by stamp result polling).
- Paginated list responses on `GET /api/integritas/history` and `GET /api/data-reads` (`page`, `pageSize`, `status`, `q` query params).
- `pendingTotal` on proof history list responses — global count of pollable pending proofs for Diagnostics refresh UI and auto-poll.

### Fixed

- **Diagnostics proof export**: corrupt `proof_payload` JSON no longer risks an unhandled export error; export failures return `500` with a message instead.
- **Diagnostics download**: export no longer runs through the post-mutation refresh path (download is read-only).
- **Diagnostics selection**: row selection clears when changing page, filter, or tab so delete/export cannot target off-screen rows.
- **Diagnostics pending poll**: auto-refresh uses global `pendingTotal` so pending proofs on other pages still poll; manual refresh button count stays page-local.
- **Diagnostics page size**: rows-per-page control now follows the URL immediately instead of snapping back to the previous API response.
- **Proof export in native dev**: `DATA_DIR` / `DATABASE_PATH` now drive the export directory (`./data/exports`) instead of always using `/data`, fixing `EACCES: permission denied, mkdir '/data'` on `npm run dev`.

## [0.11.0] - 2026-06-30

### Added

- **Wallet address book**: save and reuse external Mx/0x addresses when sending MINIMA or tokens. Contacts are stored in a new `address_book` SQLite table with a full list, inline add/edit/delete forms, and a copy-to-clipboard button per row. The address book is accessible via a `BookUser` icon button in the wallet page header, opening as a modal. The Send payment modal gains an External / Address book mode toggle — Address book mode shows a dropdown of saved contacts to populate the recipient field.
- Address book REST API (`GET`, `POST /api/wallet/address-book`, `PATCH /DELETE /api/wallet/address-book/:id`): all mutations require admin role and emit audit events (`address-book.create`, `address-book.update`, `address-book.delete`).

### Changed

- **Wallet page layout**: Assets and History are now tabs (using the shared `subtabs` component style) below the hero card instead of separate stacked cards, reducing page height.
- `wallet.routes.ts` send-payment now rejects addresses that do not start with `Mx` or `0x`, consistent with address book validation.
- `TokenListItem.isNative` widened from literal `false` to `boolean`, removing a needless type constraint ahead of known-token support.

### Fixed

- GPIO input watchers now run `gpiomon` continuously and avoid the unsupported `--both-edges` flag on older Raspberry Pi OS/libgpiod versions.
- GPIO input reads now line-buffer `gpiomon` output and ignore stale events from deleted sources instead of crashing on foreign-key errors.

### Removed

- `wallet_accounts` SQLite table dropped — the multi-wallet design it supported was replaced in 0.8.0 and the table has been unused since.

### Internal

- `backend/src/shared/minima-address.ts` — shared `isMinimaAddress` helper used by both address book and wallet send routes.

## [0.10.0] - 2026-06-29

### Changed

- **QA docs**: consolidated five per-area gap files into `docs/qa/gaps.md`; updated `docs/README.md` to remove stale plan references.
- **URL-backed navigation**: replaced local `useState` nav with React Router. Each section now has a real URL (`/dashboard`, `/node`, `/wallet`, etc.), browser history and the back button work, and deep links or page refreshes land on the correct section instead of resetting to dashboard. Sidebar and mobile nav items are `<NavLink>` elements whose active state comes from the router. The `*` catch-all and `/` redirect ensure no dead ends.
- **Auth guard with `/login` route**: unauthenticated access to any protected route redirects to `/login`. `LoginPage` is a proper route; `ProtectedRoute` uses `<Navigate to="/login" replace />`. Visiting `/login` while already authenticated redirects to `/dashboard`.

## [0.9.0] - 2026-06-26

### Added

- **Account settings page**: accessible via the sidebar user box (gear icon replaces the static "Administrator" label). Allows changing the admin password and resetting the TOTP 2FA secret post-setup. Password change requires the current password and a valid 2FA code. TOTP reset follows the same "see once" principle as setup — the QR code and manual key are shown inline once during the reset flow and not retrievable afterward.

## [0.8.0] - 2026-06-26

### Added

- Wallet page **Assets card**: lists all wallet tokens (Minima + custom) above send history with tab filters — All / Minima / Tokens. Each row shows token name, full token ID, icon, and sendable balance.
- Wallet page **Receive** button: opens a modal that fetches a wallet address via `POST /api/wallet/receive-address` and displays both the Minima (`Mx…`) and hex (`0x…`) formats with copy buttons.
- Wallet page **Settings** button (gear icon in page header): opens a wallet settings modal with Import wallet (inline form with back navigation) and Export wallet (coming soon). Follows the same pattern as Minima and Integritas page settings.

### Fixed

- Custom token names now correctly extracted from Minima's `balance` RPC response. Minima encodes custom-token metadata as a JSON object (`{ name, description, … }`) rather than a plain string; the parser previously fell back to the token ID for all custom tokens.

### Changed

- Wallet simplified to Minima's default single-wallet model — labeled account architecture removed. Balance, send, and token creation now use the full wallet UTXO pool via `balance`, `getaddress`, and `send` RPC commands. The `wallet_accounts` table is retained in SQLite for backward compatibility but is no longer written to.
- Wallet page hero card now shows total sendable MINIMA from `GET /api/wallet` instead of aggregating per-labeled-account balances.
- Send payment modal simplified: no source account selection, token list and sendable balance sourced from live wallet status.
- Create token modal simplified: no account picker; wallet total sendable MINIMA checked against minimum threshold.
- Token create (`POST /api/tokens/create`) no longer requires `fromAccountAddress`; pre-flight check uses total wallet sendable MINIMA.
- Removed routes: `GET /api/wallet/accounts`, `POST /api/wallet/accounts`, `POST /api/wallet/debug/clear-wallet-accounts`.
- Wallet page hero card restructured: action buttons moved to top-right, MINIMA balance moved to bottom spanning full card width with text wrapping enabled. The Minima icon aligns with the first line of the amount when it wraps.
- Import wallet and Export wallet moved from hero card (where they were commented out) into the wallet settings modal.
- Amount display now uses precision-aware formatting: `formatAmountThreshold` on dashboard and wallet page hero card / assets list (6-decimal truncation with `< 0.000001` for sub-threshold values and `> 0.123456` when non-zero digits are hidden beyond 6 places); `formatAmountAdaptive` used in the asset detail modal and create token modal where full precision is appropriate.
- Assets card rows are now clickable: tapping a row opens an asset detail modal showing full-precision sendable, confirmed, and unconfirmed balances alongside the copyable token ID.

## [0.7.3] - 2026-06-26

### Added

- GPIO Input data sources for Raspberry Pi BCM pin edge events. GPIO sources are input-only, automation-gated, and recorded as JSON payloads through the existing read history/stamping path.
- Installer option `ENABLE_GPIO=true` now creates a Docker Compose override for `/dev/gpiochip0` and records the detected GPIO group id in `.env`.
- Data Sources now reports backend capabilities and disables GPIO Input creation when GPIO device access is not available.

## [0.7.2] - 2026-06-26

### Added

- V1 security sign-off checklist in `docs/plans/v1-security.md` (HTTPS done; headers, tests, and APP_SECRET guard remain).
- `npm run dev:https` — native dev over HTTPS using the same self-signed certs as Docker (`data/certs`), with `COOKIE_SECURE=true` on the backend.
- Self-signed HTTPS for the default Docker deploy: installer and `scripts/generate-tls-cert.sh` generate TLS certs in `DATA_DIR/certs`; nginx serves HTTPS on `${FRONTEND_PORT}` (mapped to container port 443).
- Light and dark mode favicons (`favicon-light.svg`, `favicon-dark.svg`) served from `frontend/public`; the browser picks the appropriate variant via `prefers-color-scheme`.

### Changed

- Docker Compose UI port mapping is now `${FRONTEND_PORT}:443` (HTTPS) instead of `:80` (HTTP). Open `https://<pi-ip>:8080` and accept the browser warning for the self-signed certificate.
- Default `COOKIE_SECURE` is `true` in Docker Compose and installer-generated `.env`.
- CLI default API URL is `https://localhost:8080/api` with `curl -k` for the self-signed cert.

### Security

- Browser-to-Pi traffic is encrypted on the default deploy. Residual risk: self-signed cert warnings and click-through MITM on untrusted networks.

## [0.7.1] - 2026-06-24

### Changed

- Dashboard device status: wallet balance, Minima node status, and Integritas API connection are shown in the first metric row; host device, CPU, memory, and disk metrics are grouped in a second row with clearer **Device** labels.

## [0.7.0] - 2026-06-24

### Added

- `GET /api/tokens` — auth-protected list of non-native wallet tokens from Minima `balance`, merged with SQLite `custom_tokens` metadata (`createdLocally`, `decimal` when recorded on this Pi).
- `GET /api/tokens/create-requirements` — returns estimated MINIMA colouring cost, minimum labeled-account balance, and operator note.
- `POST /api/tokens/create` (admin) — creates a custom token via Minima `tokencreate name:X amount:Y decimals:Z` from a **labeled** wallet account (`fromAccountAddress`) with at least `0.001` MINIMA on that address. Persists `name`, `amount`, `decimal`, and `token_id` in SQLite; audit event `tokens.create` records tokenId, amounts, txpowId, and source address (no secrets). On-chain creation is irreversible.
- Wallet page **Create token** action: modal with labeled-account picker, name, supply amount, and decimal places; success toast and account list refresh.
- Backend unit tests for `parseTokenCreateResponse` (`tokens.parse.test.ts`).

### Changed

- Wallet UI formats MINIMA amounts for display (trimmed decimals).
- Dashboard and Wallet hero totals use formatted MINIMA amounts with ellipsis truncation when space is tight; hover shows the full formatted value.
- Webhook and MQTT Data Sources now define connection details only; incoming push data is recorded and optionally stamped only while an Automation workflow is enabled for that source.
- Automation now presents workflows as ordered When / Condition / Then rules. V1 creates a Collect data rule and lets operators add or remove an Integritas stamping rule.
- Automation now uses a compact workflow overview with a modal workspace for opening a workflow, reviewing its rule chain, and adding/removing V1 rules.

### Fixed

- Custom token creation: Minima expects `decimals:` (not `decimal:`) in `tokencreate`; token ID is now parsed from the txpow output body. API request field remains `decimal`.
- Removed MINIMA routing hack that sent funds to random addresses before `tokencreate`, which left labeled accounts empty and inflated unlabeled funded addresses.

## [0.6.0] - 2026-06-16

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
- Wallet send history (Phase 1): backend now persists `POST /api/wallet/send-payment` activity in SQLite and exposes it via `GET /api/wallet/history`; Wallet page now renders a `History` card with recent sent transactions.
- Wallet history display now annotates account-aware transfer flow (`From <address> (<account>) -> <address> (<destination account | External>)`) and adds dev-only `POST /api/wallet/debug/clear-wallet-history` + `Debug: clear history` button for local test resets.
- Reusable `CopyableCode` component with icon copy buttons for addresses, token IDs, and txpow IDs in wallet modals.
- Wallet UI polish: Minima/custom token glyphs in account list and send history rows; send form shows selected-token available balance beside the Token label and blocks submits that exceed it; wallet hero card responsive layout improvements for phone/tablet widths.

### Changed

- Wallet page UX pivot: labeled **accounts** are the primary model (create account, account detail with Mx/0x addresses and per-account funds). Receive addresses are shown per account in the detail modal rather than via a separate random receive-address modal.
- Send payment modal: requires a source account; supports external address or internal transfer to another labeled account; closes on successful submit with a success toast (in-page `payment-status` polling removed from the wallet UI). Backend `GET /api/wallet/payment-status/:txpowid` remains available.

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
- Data Sources now has protocol cards for HTTP JSON API and webhook JSON receive sources; webhook sources get generated receive URLs and update source history when JSON is posted.
- Data Sources now supports MQTT JSON subscriptions as push sources; the backend subscribes to configured broker/topic pairs and records received JSON in source history.
- Integritas upstream HTTP client hardening: request timeouts (`INTEGRITAS_REQUEST_TIMEOUT_MS`), transient retry with backoff for `429`/`502`/`503` and network errors, and structured `errorCode` on failed stamp/status/verify API responses.
- Background Integritas proof poller: pending proof records are status-checked on an interval (`INTEGRITAS_POLL_INTERVAL_SECONDS`, default 30s) without manual Diagnostics polling.
- Integritas retry policy: automation treats transient stamp failures as deferred retries; pending proofs time out after `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` (default 5) if on-chain confirmation never completes.
- Integritas page UX: friendly stamp-result modal after file upload (proof UID, hash, on-chain status with optional live poll); portal link in Integritas config modal via `INTEGRITAS_PORTAL_URL` / `GET /api/integritas/config` `portalUrl`.
- `docs/reports/integritas-integration-audit.md` — implementation audit for Integritas Phases 1–3, 5–6.

### Changed

- Integritas runtime config modal: runtime details, portal link, and API key controls each sit in separate cards; key validity and last-checked time share one row.
- Data source template cards now use the clearer `Add source` call to action instead of `Use template`.
- Added data source row actions now use accessible icon buttons for manual trigger, edit, and delete.
- Data source creation now presents protocol cards instead of separate internal/external HTTP templates, and the source type field is hidden from the form.
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
