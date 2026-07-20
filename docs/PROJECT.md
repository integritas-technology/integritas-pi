# Project: Integritas Pi

## Goal

A Raspberry Pi Docker Compose prototype that lets an operator run a Minima node, stamp/verify data with Integritas, and automate data-source-to-stamp workflows from a browser UI, an install script, and a small operational CLI.

## Target Audience

- Learning/prototype users running a personal Raspberry Pi appliance on a trusted local network.
- Operators who want one-command install and a browser UI rather than manual Docker/Minima setup.

## Core Value

- API-first architecture: one backend serves the browser UI and the CLI, so there is one source of truth for business logic.
- Automation workflows connect data sources (HTTP, webhook, MQTT, GPIO) directly to Integritas stamping without custom scripting.
- Self-hosted: no cloud dependency beyond the Integritas API itself.

## Key Features

- Manual file stamping and verification through Integritas.
- Automation workflows: collect data (poll/webhook/MQTT/GPIO) then optionally stamp it.
- Minima node wallet, tokens, peers, and status monitoring.
- Read-only host file browser.
- First-run setup wizard, local admin auth (6-digit PIN or 8+ character password), audit log.

## Non-Goals

- Not production-hardened — see `SECURITY.md` and `docs/security/` for accepted risk tradeoffs.
- No multi-tenant or multi-user accounts (single admin model).
- No generic Minima RPC proxy — only narrow, allowlisted actions.
- No business logic duplicated in the frontend or CLI; both call the backend API only.

## Constraints

- Must run on Raspberry Pi (ARM) via Docker Compose.
- Backend must not expose arbitrary shell command execution.
- Host file access must stay read-only and path-safe.
- Backend runs as non-root in Docker.
- Runtime state persists in SQLite under `/data/integritas-pi.db`.

## Success Criteria

- One-command install (`install.sh`) results in a working HTTPS UI on the Pi's LAN IP.
- An operator can configure a data source, enable an automation workflow, and see a resulting Integritas proof without touching the CLI or backend code.
- `npm run check` plus backend/frontend builds pass before any change ships.

## References

- `AGENTS.md` — architecture and agent/contributor rules.
- `docs/TASKS.md` — current work items.
- `SECURITY.md` + `docs/security/` — risk register.
- `README.md` — install, runtime, and operational instructions for humans.
