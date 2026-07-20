# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately.
- This tracks active work only. Detailed backlogs stay in their own docs:
  `docs/qa/gaps.md` (QA/security gaps), `docs/plans/*.md` (feature plans).

---

## Current Focus

- [ ] Add `CLAUDE.md` (`@AGENTS.md` import) so Claude Code loads project instructions.

## In Progress

- [ ] Block automation workflows — see `docs/plans/block-automation-workflows.md`.
- [ ] V1 security sign-off checklist — see `docs/plans/security-checklist.md`.

## Next

- [ ] Fix stale `docs/README.md` active-plans table (references deleted plan files) — re-check, may already be resolved.
- [ ] Decide whether/how to fix the `docs/gpio-device-settings.md` link now that the file may have moved to `archive/docs/guides/`.

## Done

- [x] Implemented V1 workflow variables and output templating — see `docs/plans/workflow-variables-and-output-templating.md`.
- [x] Implemented V1 device configuration flow, HTTP/MQTT output targets, and optional local MQTT broker support — see `docs/plans/device-configuration-and-mqtt-broker.md`.


- [x] `AGENTS.md` rewritten as Karpathy-style behavioral guidelines; project-specific rules split into `.agents/rules/*.md`, indexed from `AGENTS.md` and `docs/README.md`.
- [x] `SECURITY.md` split into a policy document (supported use, guidelines, reporting) plus a detailed risk register in `docs/security/*.md`.
- [x] Fixed stale `SECURITY.md` reference to removed `fromAccountAddress` / labeled accounts.
- [x] `.cursor/rules.mdc` updated to point at `.agents/rules/` and `docs/security/` alongside `AGENTS.md`/`SECURITY.md`.
- [x] `docs/PROJECT.md`, `docs/TASKS.md`, `docs/SESSION.md` added.

## Ideas

- [ ] Sync mechanism (script or CI check) to keep any future `.claude/skills/` and `.agents/skills/` copies from drifting.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/)
