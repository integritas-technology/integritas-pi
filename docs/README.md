# Docs

```
docs/
├── PROJECT.md   goal, audience, constraints, success criteria
├── TASKS.md     current work items (read every session)
├── SESSION.md   scratch log for the session in progress
├── security/    full security risk register (see SECURITY.md for the lean entry point)
├── plans/       active or upcoming work
├── qa/          open gaps and hardening backlog
└── reports/     point-in-time audits (not maintained after creation)
```

---

## Agent context

| Doc | Purpose |
|---|---|
| [PROJECT.md](./PROJECT.md) | Goals, audience, non-goals, constraints, success criteria |
| [TASKS.md](./TASKS.md) | Current focus / in progress / next / done |
| [SESSION.md](./SESSION.md) | Scratch notes for the session in progress — reset per session |

See also `AGENTS.md` at the repo root (source of truth for architecture and agent rules) and `.cursor/rules.mdc` (tool-specific pointer to it).

---

## Security

| Doc | Purpose |
|---|---|
| [../SECURITY.md](../SECURITY.md) | Lean entry point: scope, current posture, highest-priority accepted risks |
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
