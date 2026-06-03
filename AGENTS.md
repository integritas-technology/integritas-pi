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

Frontend rules:

- Frontend calls backend API only; do not call Integritas directly from the browser.
- Keep UI state simple unless there is a clear need for a new state layer.
- Use existing page/card/table/pill styles before inventing new patterns.
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

## Integritas Rules

- Manual file stamps and automated data-source stamps share the same history table.
- Automation stamps the entire JSON response hash.
- Automation currently stamps every poll when enabled, not only changed data.
- Automated history rows should remain identifiable, e.g. `Automation: <source name>`.
- Proof status is initially `pending`; proof polling updates readiness/failure.

## Data Source Rules

- Supported V1 data source type is JSON fetched from an API response.
- Skip file-source and manual-upload source types unless explicitly requested.
- Store the latest JSON preview and latest hash on the data source.
- Do not impose arbitrary app-level file/data limits unless required for safety.

## Automation Rules

- Workflows poll a saved data source at an interval.
- The backend scheduler owns execution.
- Store `last_run_at`, `next_run_at`, `last_hash`, `last_proof_id`, and `last_error`.
- Save `last_hash` after successful data fetch even if Integritas stamping fails.
- Surface detailed upstream errors where possible without leaking secrets.

## Docker / Pi Rules

- UI is exposed on `${FRONTEND_PORT:-8080}`.
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

- Update `README.md` for installation, usage, CLI commands, runtime config, API expectations, or operational workflow changes.
- Update `SECURITY.md` for security-sensitive changes, new exposure, new credentials/secrets behavior, host access, or risk tradeoffs.
- Update `AGENTS.md` for architecture, process, or agent workflow guidance changes.

Do not leave undocumented behavior changes that affect installation, deployment, API usage, CLI usage, or operational workflows.
