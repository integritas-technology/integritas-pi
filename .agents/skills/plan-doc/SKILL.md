---
name: plan-doc
description: This skill should be used right after a plan-mode plan is approved for a non-trivial feature, or when the user asks to "save the plan", "write this up as a plan doc", "put the plan in the plans folder" — persist the plan into docs/plans/<slug>.md and reference it from docs/TASKS.md before any implementation code is written.
---

# Plan Doc

`docs/plans/*.md` is where this repo keeps durable, readable feature plans — every existing one is referenced from `docs/TASKS.md`. Plan mode's own plan file (`~/.claude/plans/*.md`) is ephemeral working scratch outside the repo; the plan only becomes part of the project's record once it's written into `docs/plans/`. Do this immediately after a plan is approved, before making any code changes — approval of the plan's content is not the same as permission to start implementing it right now, and the user may want it saved for later.

## Process

1. Read an existing plan doc (e.g. `docs/plans/minima-restart-resync-status.md`) to match this repo's exact format.
2. Write `docs/plans/<kebab-case-slug>.md` with:
   - `# <Title> Plan`
   - `**Status:** Not started` (or the real status if resuming/updating an in-progress plan)
   - `**Created:** <YYYY-MM-DD>`
   - `**Goal:** <one sentence>`
   - `## Context` — why this is being built, what was discussed/decided, and any rejected alternatives worth remembering.
   - Section(s) describing the concrete changes (e.g. `## Backend changes`, `## Frontend changes`) — name real files/functions to reuse, not just describe behavior in the abstract.
   - `## Docs` — which docs need updating once built, per `.claude/rules/documenting-work.md`.
   - `## Verification` — how to confirm it works, per `.claude/rules/verification.md`.
3. Add one line under `## Next` (or `## In Progress` if the user says work is already underway) in `docs/TASKS.md`, matching the existing style: `- [ ] <short description> — see \`docs/plans/<slug>.md\`.`
4. Stop there. Writing the plan doc is the deliverable for this step — do not start implementing unless the user explicitly says to begin now. Exiting plan mode only means the plan's content is approved, not that coding should start immediately.
5. Report the file path(s) written, nothing else.
