# Documentation templates

Reusable scaffolds for feature plans and QA gap reports. Derived from the structure that worked well for [minima-node.md](../plans/minima-node.md) and [minima-gaps.md](../qa/minima-gaps.md).

## When to use

| Template | Copy to | Use when |
|----------|---------|----------|
| [feature-plan.md](./feature-plan.md) | `docs/plans/<feature>.md` | Starting a multi-phase feature before large diffs |
| [qa-gaps.md](./qa-gaps.md) | `docs/qa/<feature>-gaps.md` | Feature is shipped (or nearing ship); tracking QA, hardening, and deferred tests |

## Workflow

1. **Copy** the template into `plans/` or `qa/` and rename (e.g. `widget-integration.md`, `widget-gaps.md`).
2. **Replace** all `[bracketed placeholders]` and `FEATURE` prefixes.
3. **Link** the plan and gaps doc to each other, `docs/README.md`, and `qa/README.md` (add a workstream row if needed).
4. **Update** the plan as you ship phases; move open testing/hardening items to the gaps doc.
5. **Mark** the plan **Complete** in `docs/README.md` when feature build is done; keep gaps open until QA sign-off.

## Reference implementations

| Document | Role |
|----------|------|
| [plans/minima-node.md](../plans/minima-node.md) | Filled feature plan (phases, API, architecture, audit) |
| [qa/minima-gaps.md](../qa/minima-gaps.md) | Filled QA gaps (P0–P2, manual checklist) |
| [qa/auth-gaps.md](../qa/auth-gaps.md) | Alternate gaps style (same priority tiers) |

## Conventions

- **Plans** = what to build, how it fits the architecture, phased delivery, open decisions.
- **QA gaps** = what to verify, accept, or harden after implementation — not new product scope.
- **Reports** (`docs/reports/`) = point-in-time audits; do not use these templates for reports.
- Use stable gap IDs: `FEATURE-01`, `FEATURE-02`, … for ticket cross-reference.
- Prefer one gaps file per feature area; link from [qa/README.md](../qa/README.md) as a workstream.

## Changelog

| Date | Change |
|------|--------|
| 2026-06-11 | Initial templates from Minima plan + gaps structure |
