# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately.
- This tracks active work only. Detailed backlogs stay in their own docs:
  `docs/qa/gaps.md` (QA/security gaps), `docs/plans/*.md` (feature plans).

---

## Current Focus

- [ ] Agent config cleanup: split `SECURITY.md` into a lean top-level file plus `docs/security/*` detail docs.

## In Progress

- [ ] Block automation workflows — see `docs/plans/block-automation-workflows.md`.
- [ ] V1 security sign-off checklist — see `docs/plans/security-checklist.md`.

## Next

- [ ] Fix stale `SECURITY.md` reference to removed `fromAccountAddress` / labeled accounts (tracked in `docs/qa/gaps.md`).
- [ ] Fix stale `docs/README.md` active-plans table (references deleted plan files).
- [ ] Add `CLAUDE.md` (`@AGENTS.md` import) so Claude Code loads project instructions.

## Done

- [x] `AGENTS.md` established as the cross-tool source of truth.
- [x] `.cursor/rules.mdc` set up as a pointer to `AGENTS.md` (no duplicated rules).
- [x] `docs/PROJECT.md` and `docs/TASKS.md` added.

## Ideas

- [ ] Sync mechanism (script or CI check) to keep any future `.claude/skills/` and `.agents/skills/` copies from drifting.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/)
