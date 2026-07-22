# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately.
- This tracks active work only. Detailed backlogs stay in their own docs:
  `docs/qa/gaps.md` (QA/security gaps), `docs/plans/*.md` (feature plans).

---

## Current Focus

- [ ] Merge `chore/workflow-pagination` into `main` — a manual browser pass through Diagnostics pagination (proofs/reads/workflow-runs) is recommended first; full E2E wasn't run this session (TOTP-gated setup flow, out of scope for automated verification).

## In Progress

- [ ] Block automation workflows — see `docs/plans/block-automation-workflows.md`.
- [ ] V1 security sign-off checklist — see `docs/plans/security-checklist.md`.
- [ ] Backend unit test coverage, one feature folder at a time — see `docs/plans/backend-unit-tests.md`. `auth` partially covered so far (password, session, login/change-password).

## Next

- [ ] Fix stale `docs/README.md` active-plans table (references deleted plan files) — re-check, may already be resolved.
- [ ] Decide whether/how to fix the `docs/gpio-device-settings.md` link now that the file may have moved to `archive/docs/guides/`.
- [ ] Document the `DEV_MODE` install flag in `README.md`'s runtime-config section and note its manifest-signature-verification bypass in `SECURITY.md`/`docs/security/host-and-infrastructure.md` — flagged during code review, deliberately deferred as a separate concern from the pagination work.

## Done

- [x] Implemented V1 workflow variables and output templating — see `docs/plans/workflow-variables-and-output-templating.md`.
- [x] Implemented V1 device configuration flow, HTTP/MQTT output targets, and optional local MQTT broker support — see `docs/plans/device-configuration-and-mqtt-broker.md`.
- [x] `AGENTS.md` rewritten as Karpathy-style behavioral guidelines; project-specific rules split into `.agents/rules/*.md`, indexed from `AGENTS.md` and `docs/README.md`.
- [x] `SECURITY.md` split into a policy document (supported use, guidelines, reporting) plus a detailed risk register in `docs/security/*.md`.
- [x] Fixed stale `SECURITY.md` reference to removed `fromAccountAddress` / labeled accounts.
- [x] `.cursor/rules.mdc` updated to point at `.agents/rules/` and `docs/security/` alongside `AGENTS.md`/`SECURITY.md`.
- [x] `docs/PROJECT.md`, `docs/TASKS.md`, `docs/SESSION.md` added.
- [x] Added `CLAUDE.md`/`.claude/rules/` as full duplicates of `AGENTS.md`/`.agents/rules/` (not an `@AGENTS.md` import as originally planned), with a sync notice in both top-level files warning against drift.
- [x] Diagnostics "Workflow logs" tab brought to pagination/filter/search parity with proofs/reads — see `docs/plans/workflow-runs-pagination.md` (now Implemented).
- [x] Unified a single lightweight refresh button across all three Diagnostics tabs; fixed the "Raw details" panel rendering at the table bottom instead of inline; lowered the default Diagnostics page size 50→25 and fixed a bug where it silently fell back to 10 instead.
- [x] Ran a multi-agent code + security review of `chore/workflow-pagination`; security review was clean; fixed 7 of 10 code-review findings (shared backend pageSize=0 bug, duplicated tab-dispatch logic, an orphaned API route, a stale hardcoded default, dead code, a refresh-icon busy-state paper cut, and an empty `CHANGELOG.md [Unreleased]`).
- [x] Added `commit-message` and `session-notes` skills (mirrored in `.claude/skills/` and `.agents/skills/`).

## Ideas

- [ ] Sync mechanism (script or CI check) to keep `.claude/`/`.agents/` (rules and skills) from drifting — still unbuilt; this session hit a real, if small, instance of the drift it's meant to prevent, caught manually rather than by tooling.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/)
