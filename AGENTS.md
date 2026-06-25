# AGENTS.md

Guidance for coding agents working on `integritas-pi`.

## Project Shape

`integritas-pi` is a Raspberry Pi Docker Compose prototype with a React frontend, TypeScript/Express backend, SQLite persistence, Minima, Integritas stamping, data sources, automation workflows, and a small operational CLI.

The primary architecture is API-first:

```txt
Browser UI -> backend API
CLI        -> backend API
Backend    -> SQLite / Integritas / Minima / Docker status / data source URLs
```

Do not implement business logic separately in the frontend or CLI. Put shared behavior behind backend API routes/services.

## Core Principles

- Keep changes small and direct.
- Prefer extending existing feature folders over creating broad abstractions.
- Preserve the browser UI as the primary UX.
- CLI commands are operational/admin helpers, not a full duplicate UI.
- Backend must not expose arbitrary shell command execution.
- Host file access must stay read-only and path-safe.
- Backend should continue running as non-root in Docker.
- Persist runtime state in SQLite under `/data/integritas-pi.db`.
- Do not add mock data/functions to production paths.
- Document security-sensitive tradeoffs in `SECURITY.md` when adding risk.

## Read Before Editing

Always start with:

- `README.md` for install, runtime, API, and operational expectations.
- `CHANGELOG.md` for what changed recently and how releases are recorded.
- `SECURITY.md` for security boundaries and known prototype risks.
- `docker-compose.yml` for service topology, mounts, ports, and container constraints.
- `.env.example` for supported runtime configuration.

## Backend Work

Read these first:

- `backend/src/app.ts` for route registration.
- `backend/src/index.ts` for startup, migrations, and schedulers.
- `backend/src/db/database.ts` for SQLite schema/migrations.
- `backend/src/config/env.ts` for environment configuration.

Feature folders:

- Auth: `backend/src/features/auth/`
- Integritas: `backend/src/features/integritas/`
- Data sources: `backend/src/features/data-sources/`
- Automation: `backend/src/features/automation/`
- Minima: `backend/src/features/minima/`
- Status/Docker overview: `backend/src/features/status/`
- Settings/secrets: `backend/src/features/settings/`
- File browser: `backend/src/features/files/`

Backend rules:

- Add routes through feature routers and register them in `backend/src/app.ts`.
- Add schema changes in `backend/src/db/database.ts`.
- Keep Integritas API keys backend-only.
- When storing secrets, use existing settings/secrets services.
- When adding a scheduler, start it from `backend/src/index.ts` after migrations.
- Return useful error details from backend services, but never leak secrets.

Auth rules:

- Public routes: `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, `POST /api/auth/login`.
- All other `/api/*` routes require `requireAuth` in `backend/src/app.ts`.
- High-risk mutations also use `requireRole('admin')` (Integritas API key, files, automation/data-source mutations).
- Session cookies: HttpOnly, `SameSite=Strict`, `Secure` when `COOKIE_SECURE=true`.
- Never return password hashes, TOTP secrets, raw session tokens, or Integritas API keys.
- CLI has no session auth in V1; document `401` for protected API calls.

## Frontend Work

Read these first:

- `frontend/src/App.tsx` for page routing.
- `frontend/src/app/nav.ts` for sidebar navigation.
- `frontend/src/app/types.ts` for shared frontend types.
- `frontend/src/styles.css` for existing visual language.
- `frontend/src/components/` for reusable UI primitives.

Page and feature folders:

- Pages: `frontend/src/pages/`
- Integritas UI/API/types: `frontend/src/features/integritas/`
- Data Sources UI/API/types: `frontend/src/features/data-sources/`
- Automation UI/API/types: `frontend/src/features/automation/`
- Auth UI/API: `frontend/src/features/auth/`
- First-run setup wizard: `frontend/src/features/setup/`

Frontend rules:

- Frontend calls backend API only; do not call Integritas directly from the browser.
- All API fetches use `credentials: "include"` via `frontend/src/lib/api.ts`.
- `AuthProvider` owns bootstrap: `GET /api/setup/status` → wizard vs `GET /api/auth/me` → app shell or login.
- Keep UI state simple unless there is a clear need for a new state layer.
- Use existing page/card/table/pill styles before inventing new patterns.
- Styling direction: use Tailwind utilities for component and page styling going forward. Keep plain CSS limited to root/body/base global rules and migrate existing component-level CSS to Tailwind incrementally as files are touched.
- Use the shared toast system (`ToastProvider` / `useToast`) for transient API/action errors that should not occupy page layout, especially when the same action can be triggered from a modal and a page. Keep inline errors for persistent form validation, row-level status, or details the user needs to compare in context.
- Show local and UTC time where workflow scheduling clarity matters.

## CLI Work

Read these first:

- `bin/integritas-pi`
- `install.sh`
- README CLI section.

CLI rules:

- CLI commands should call the same backend API as the browser.
- Do not duplicate business logic in shell.
- Start with operational commands only.
- Keep dependencies minimal: POSIX shell, `curl`, optional `python3` for JSON formatting.
- Installer should keep installing the CLI to `/usr/local/bin/integritas-pi`.

## Minima Rules

- Minima RPC commands should be sent as a single URL path command, not as query parameters. Build the command string first, for example `megammrsync action:resync host:megammr.minima.global:9001`, then percent-encode it into the path: `http://minima:9005/megammrsync%20action%3Aresync%20host%3Amegammr.minima.global%3A9001`.
- Do not expose a generic Minima command proxy. Add narrow, allowlisted backend actions for each supported command.

## Integritas Rules

- Manual file stamps and automated data-source stamps share the same history table.
- Automation stamps the entire JSON response hash.
- Automation currently stamps every poll when enabled, not only changed data.
- Automated history rows should remain identifiable, e.g. `Automation: <source name>`.
- Proof status is initially `pending`; proof polling updates readiness/failure.
- Start `startIntegritasProofPoller()` from `backend/src/index.ts` after migrations (same pattern as the automation scheduler). The poller batches pending UIDs and reuses `refreshProofRecord` / `applyPollResultToRecord` from `integritas.service.ts`.

## Data Source Rules

- Supported V1 data source types are HTTP JSON API fetches, webhook JSON receives, and MQTT JSON subscriptions.
- Skip file-source and manual-upload source types unless explicitly requested.
- Store the latest JSON preview and latest hash on the data source.
- Do not impose arbitrary app-level file/data limits unless required for safety.
- Webhook sources receive JSON through public `/api/data-source-webhooks/:token` endpoints generated per source. They are push-only and only record incoming data when an enabled Automation workflow exists for the source.
- MQTT sources define a broker URL/topic and expect JSON payloads. The backend only subscribes while an enabled Automation workflow exists for the MQTT source.

## Automation Rules

- Automation workflows are collections of ordered rules. V1 supports a required Collect data rule and an optional Integritas stamping rule.
- Each rule follows When / Condition / Then. Keep rules atomic; chain rules instead of adding multiple unrelated actions to one rule.
- Collect data rules either poll an HTTP JSON API source at an interval or enable event-driven webhook/MQTT ingestion for a push source.
- The backend scheduler owns HTTP polling execution; webhook/MQTT collect rules are triggered by incoming data while enabled.
- Store `last_run_at`, `next_run_at`, `last_hash`, `last_proof_id`, and `last_error`.
- Save `last_hash` after successful data fetch or push ingestion even if Integritas stamping fails.
- Surface detailed upstream errors where possible without leaking secrets.

## Docker / Pi Rules

- UI is exposed on HTTPS at `${FRONTEND_PORT:-8080}` (container port 443) with a self-signed cert in `${DATA_DIR:-./data}/certs`.
- Backend is internal behind frontend `/api` proxy.
- SQLite data lives in `${DATA_DIR:-./data}` mounted to `/data`.
- Minima data lives in `${MINIMA_DATA_DIR:-./minima}`.
- Host files are mounted read-only to `/host-files`.
- Docker socket is mounted read-only for prototype status only; treat it as sensitive.
- `host.docker.internal` is mapped for Linux via `extra_hosts` for host-gateway access.

## Verification

Run relevant checks before finishing changes:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

For container-impacting changes, also run:

```bash
docker compose build
```

For shell changes:

```bash
bash -n install.sh
bash -n bin/integritas-pi
```

Before committing or asking someone to push, check untracked files explicitly:

```bash
git status --short --untracked-files=all
```

## Documenting Work

When finishing a task, summarize:

- What changed.
- Why it changed.
- Which files or feature areas were touched.
- What verification was run.
- Any known limitations, skipped checks, or follow-up work.

Update project documentation when behavior changes:

- Update `CHANGELOG.md` for every user-facing or operator-facing change (see below).
- Update `README.md` for installation, usage, CLI commands, runtime config, API expectations, or operational workflow changes.
- Update `SECURITY.md` for security-sensitive changes, new exposure, new credentials/secrets behavior, host access, or risk tradeoffs.
- Update `AGENTS.md` for architecture, process, or agent workflow guidance changes.

Do not leave undocumented behavior changes that affect installation, deployment, API usage, CLI usage, or operational workflows.

## Changelog

Keep `CHANGELOG.md` up to date as part of finishing work, not as a follow-up task.

- Follow [Keep a Changelog](https://keepachangelog.com/) sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Add new entries under `## [Unreleased]` while work is in progress on a branch.
- When a branch or release is completed, move `Unreleased` items into a dated version section (for example `## [0.2.0] - 2026-06-09`) and leave a fresh empty `## [Unreleased]` section at the top.
- Write entries for operators and users: what changed, not which files were touched.
- Include auth, API, UI, config/env, Docker/install, CLI, and security-impacting changes.
- A one-line entry is fine for small fixes; larger features deserve a short bullet group.
- If a change is already described in `README.md` or `SECURITY.md`, the changelog should still note it briefly and point to those docs when helpful.
