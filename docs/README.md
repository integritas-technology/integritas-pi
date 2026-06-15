# Documentation index

How `docs/` is organized and when to use each folder.

## Structure

```txt
docs/
├── README.md                 ← you are here
├── templates/                ← copy-paste scaffolds for plans & QA gaps
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
| [minima-node.md](./plans/minima-node.md) | **Complete** | Phases 1–3 shipped; live RPC integration tests in QA |
| [device-status.md](./plans/device-status.md) | **Complete** | Device info service, `GET /api/status` summary, graceful shutdown; unit tests deferred → [qa/device-status-gaps.md](./qa/device-status-gaps.md) |
| [wallet.md](./plans/wallet.md) | **Not started** | Wallet lifecycle service: balance, address, send, import/export; 3 phases |

When starting a new feature, copy [templates/feature-plan.md](./templates/feature-plan.md) into `plans/` before large diffs. Mark it **Complete** when shipped and move follow-up testing/hardening to `qa/`.

---

## `templates/` — plan & QA scaffolds

**Use for:** starting new feature plans and gap reports with a consistent layout.

| Template | Purpose |
|----------|---------|
| [templates/README.md](./templates/README.md) | How to copy, name, and link new docs |
| [templates/feature-plan.md](./templates/feature-plan.md) | Phased implementation plan (from [minima-node.md](./plans/minima-node.md)) |
| [templates/qa-gaps.md](./templates/qa-gaps.md) | P0–P2 QA backlog (from [minima-gaps.md](./qa/minima-gaps.md)) |

Reference implementations: [minima-node.md](./plans/minima-node.md), [minima-gaps.md](./qa/minima-gaps.md).

---

## `qa/` — gaps & QA phase work

**Use for:** open items to close during QA or post-feature hardening — tests, manual checklists, security improvements that should not block ongoing development.

| Document | Purpose |
|----------|---------|
| [qa/README.md](./qa/README.md) | QA phase hub: exit criteria, workstreams, sign-off template |
| [qa/auth-gaps.md](./qa/auth-gaps.md) | Auth security & testing backlog (P0–P2) |
| [qa/minima-gaps.md](./qa/minima-gaps.md) | Minima node manual QA, auth gates, live RPC tests (P0–P2) |
| [qa/device-status-gaps.md](./qa/device-status-gaps.md) | Device status endpoint and graceful shutdown QA (P0–P2) |

Integritas sandbox tests: [qa/README.md](./qa/README.md) Workstreams B–C. Minima QA: Workstream E + [minima-gaps.md](./qa/minima-gaps.md).

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
| Start a new feature plan | [templates/feature-plan.md](./templates/feature-plan.md) |
| Start a QA gaps doc | [templates/qa-gaps.md](./templates/qa-gaps.md) |
| Install or operate the app | [README.md](../README.md) |
