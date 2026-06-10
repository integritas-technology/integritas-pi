# Changelog

All notable changes to `integritas-pi` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) at the package level.

## [Unreleased]

### Added

- Data sources can now store an optional health status URL; the Added data sources table polls it once per minute through the backend and shows a green/red status indicator with the latest response.
- Shared frontend toast system for transient API/action errors, starting with Data Sources actions.
- Data sources can now be edited from the Added data sources table.
- Integritas upstream HTTP client hardening: request timeouts (`INTEGRITAS_REQUEST_TIMEOUT_MS`), transient retry with backoff for `429`/`502`/`503` and network errors, and structured `errorCode` on failed stamp/status/verify API responses.
- Background Integritas proof poller: pending proof records are status-checked on an interval (`INTEGRITAS_POLL_INTERVAL_SECONDS`, default 30s) without manual Diagnostics polling.
- Integritas retry policy: automation treats transient stamp failures as deferred retries; pending proofs time out after `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` (default 5) if on-chain confirmation never completes.

### Changed

- Data source template cards now use the clearer `Add source` call to action instead of `Use template`.
- Added data source row actions now use accessible icon buttons for manual trigger, edit, and delete.
- Integritas sandbox integration tests moved from feature Phase 4 to the planned QA phase; see `docs/qa/README.md`.
- Documentation layout: `docs/plans/` (implementation plans with status), `docs/qa/` (open gaps and checklists), `docs/reports/` (audits only); index at `docs/README.md`. Auth plans marked **Complete**; Integritas plan **In progress**.

## [0.2.0] - 2026-06-09

Branch: `auth-permissions` — authentication, first-run setup, and related UI/platform work merged on top of `main`.

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
