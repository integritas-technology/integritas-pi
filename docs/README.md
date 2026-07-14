# Docs

```
docs/
├── PROJECT.md   goal, audience, constraints, success criteria
├── frontend-design-system.md   frontend styling/component conventions
├── TASKS.md     current work items (read every session)
├── SESSION.md   scratch log for the session in progress
├── security/    detailed security risk register (see SECURITY.md for the policy)
├── plans/       active or upcoming work
├── qa/          open gaps and hardening backlog
└── reports/     point-in-time audits (not maintained after creation)
```

Project-specific agent rules live outside `docs/`, in `.agents/rules/` at the repo root (agent-config, not human documentation) — see below.

---

## Agent context

| Doc | Purpose |
|---|---|
| [PROJECT.md](./PROJECT.md) | Goals, audience, non-goals, constraints, success criteria |
| [frontend-design-system.md](./frontend-design-system.md) | Frontend styling/component conventions |
| [TASKS.md](./TASKS.md) | Current focus / in progress / next / done |
| [SESSION.md](./SESSION.md) | Scratch notes for the session in progress — reset per session |

`AGENTS.md` at the repo root holds behavioral guidelines (loaded every session by every tool) and indexes the project-specific rules below. `.cursor/rules.mdc` is a tool-specific pointer to it.

| Doc | Purpose |
|---|---|
| [../.agents/rules/project-shape.md](../.agents/rules/project-shape.md) | Architecture, core principles, what to read before editing |
| [../.agents/rules/backend.md](../.agents/rules/backend.md) | Backend feature folders, route/schema conventions, auth rules |
| [../.agents/rules/frontend.md](../.agents/rules/frontend.md) | Frontend feature folders, API usage, styling conventions |
| [../.agents/rules/cli.md](../.agents/rules/cli.md) | CLI conventions and constraints |
| [../.agents/rules/minima.md](../.agents/rules/minima.md) | Minima RPC command rules |
| [../.agents/rules/integritas.md](../.agents/rules/integritas.md) | Integritas stamping/proof rules |
| [../.agents/rules/data-sources.md](../.agents/rules/data-sources.md) | Data source types and rules |
| [../.agents/rules/automation.md](../.agents/rules/automation.md) | Automation workflow rules |
| [../.agents/rules/docker.md](../.agents/rules/docker.md) | Docker / Raspberry Pi deployment rules |
| [../.agents/rules/verification.md](../.agents/rules/verification.md) | Commands to run before finishing changes |
| [../.agents/rules/documenting-work.md](../.agents/rules/documenting-work.md) | Task summaries, doc updates, changelog policy |

---

## Security

| Doc | Purpose |
|---|---|
| [../SECURITY.md](../SECURITY.md) | Security policy: supported use, guidelines, vulnerability reporting |
| [security/auth-and-transport.md](./security/auth-and-transport.md) | LAN access, TLS trust, API keys, `APP_SECRET` |
| [security/host-and-infrastructure.md](./security/host-and-infrastructure.md) | Docker socket, file browser, path traversal, SQLite permissions, supply chain, installer |
| [security/wallet-and-tokens.md](./security/wallet-and-tokens.md) | Seed phrase import, automated transactions, debug clears, token creation |
| [security/data-sources-and-automation.md](./security/data-sources-and-automation.md) | Minima RPC/resync/restart/peers, data source URLs, webhooks, MQTT, GPIO, Integritas proxy |
| [security/low-priority-and-future.md](./security/low-priority-and-future.md) | Rate limiting, error detail, logging hygiene, missing security tests |

---

## Active plans

| Plan | Status |
|---|---|
| [plans/block-automation-workflows.md](./plans/block-automation-workflows.md) | In progress |
| [plans/feedback.md](./plans/feedback.md) | V1 implemented; V2 planned |
| [plans/security-checklist.md](./plans/security-checklist.md) | In progress |

---

## QA

| Doc | Purpose |
|---|---|
| [qa/gaps.md](./qa/gaps.md) | Open QA, security, and test gaps (all areas) |

---

## Hardware

| Doc | Purpose |
|---|---|
| [gpio-device-settings.md](./gpio-device-settings.md) | Tested and suggested GPIO input/output settings by device type |
