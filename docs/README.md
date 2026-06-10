# Documentation index

How `docs/` is organized and when to use each folder.

## Structure

```txt
docs/
├── README.md                 ← you are here
├── plans/                    ← implementation plans (what to build)
├── qa/                       ← open gaps, checklists, deferred tests
└── reports/                  ← point-in-time audits (what was built / reviewed)
```

Root-level operator docs stay outside this tree: [README.md](../README.md), [SECURITY.md](../SECURITY.md), [AGENTS.md](../AGENTS.md), [CHANGELOG.md](../CHANGELOG.md).

---

## `plans/` — implementation plans

**Use for:** feature design, phased delivery, architecture decisions before and during build.

**Status markers:**

| Marker | Meaning |
|--------|---------|
| **Complete** | Shipped; plan kept for reference. Further work lives in `qa/` or a new plan. |
| **In progress** | Active feature work remaining. |
| **Not started** | Approved plan; implementation not begun. |

| Document | Status | Notes |
|----------|--------|-------|
| [auth-implementation.md](./plans/auth-implementation.md) | **Complete** | Phase 1 auth; shipped in [0.2.0](../CHANGELOG.md#020---2026-06-09) |
| [auth-security.md](./plans/auth-security.md) | **Complete** | Phase 1 threat model & controls (design); hardening gaps → [qa/auth-gaps.md](./qa/auth-gaps.md) |
| [integritas-integration.md](./plans/integritas-integration.md) | **Complete** | Phases 1–3 backend + Phase 5 UX; sandbox tests deferred to QA |

When starting a new feature, add a plan here before large diffs. Mark it **Complete** when shipped and move follow-up testing/hardening to `qa/`.

---

## `qa/` — gaps & QA phase work

**Use for:** open items to close during QA or post-feature hardening — tests, manual checklists, security improvements that should not block ongoing development.

| Document | Purpose |
|----------|---------|
| [qa/README.md](./qa/README.md) | QA phase hub: exit criteria, workstreams, sign-off template |
| [qa/auth-gaps.md](./qa/auth-gaps.md) | Auth security & testing backlog (P0–P2) |

Integritas sandbox tests and manual checklists are in [qa/README.md](./qa/README.md) (Workstreams B–C), deferred from [integritas-integration.md](./plans/integritas-integration.md).

---

## `reports/` — audits & reviews

**Use for:** retrospective documents — what was implemented, file inventories, security review findings at a point in time. **Not** living backlogs (those go in `qa/`).

| Document | Purpose |
|----------|---------|
| [reports/auth-implementation-audit.md](./reports/auth-implementation-audit.md) | Phase 1 auth audit (2026-06-09): plan vs code, security findings |
| [reports/integritas-integration-audit.md](./reports/integritas-integration-audit.md) | Integritas integration audit (2026-06-10): Phases 1–3, 5–6 plan vs code |

Add new reports when completing a major milestone or external review; do not grow reports into task trackers.

---

## Quick paths

| I want to… | Read |
|------------|------|
| Implement auth (already done) | [plans/auth-implementation.md](./plans/auth-implementation.md) + [reports/auth-implementation-audit.md](./reports/auth-implementation-audit.md) |
| Understand auth risks | [plans/auth-security.md](./plans/auth-security.md) → [qa/auth-gaps.md](./qa/auth-gaps.md) for open items |
| Review Integritas delivery | [plans/integritas-integration.md](./plans/integritas-integration.md) + [reports/integritas-integration-audit.md](./reports/integritas-integration-audit.md) |
| Run QA / hardening | [qa/README.md](./qa/README.md) |
| Install or operate the app | [README.md](../README.md) |
