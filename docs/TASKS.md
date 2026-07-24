# Tasks

## How To Use This File

- Read this file (and `docs/PROJECT.md`) at the start of every session.
- Keep **Current Focus** to 1-3 items max.
- Move completed items to **Done** immediately.
- This tracks active work only. Detailed backlogs stay in their own docs:
  `docs/qa/gaps.md` (QA/security gaps), `docs/plans/*.md` (feature plans).

---

## Current Focus

- [ ] Commit the pending `MinimaSettingsPanel` change on `fix/minima-sync-missmatch` (new file + `AuthSettingsPage.tsx`/`MinimaPage.tsx` edits) — typecheck/build clean, container verified, not yet `git commit`ed.
- [ ] Manual browser click-through of `fix/minima-sync-missmatch` before merging: restart/resync from Minima Core, Dashboard tile during restart, Wallet page gating/spinners/auto-repoll, and the new Wallet-settings/Minima-node-settings panels on Account settings — no authenticated browser session was available to click-test this session.
- [ ] Add a `CHANGELOG.md` `[Unreleased]` section for `fix/minima-sync-missmatch`'s user-facing changes (Minima restart/resync UX, Wallet page gating, settings moved to Account settings) — currently missing entirely.

## In Progress

- [ ] Block automation workflows — see `docs/plans/block-automation-workflows.md`.
- [ ] V1 security sign-off checklist — see `docs/plans/security-checklist.md`.

## Next

- [ ] Document the `DEV_MODE` install flag in `README.md`'s runtime-config section and note its manifest-signature-verification bypass in `SECURITY.md`/`docs/security/host-and-infrastructure.md` — flagged during code review, deliberately deferred as a separate concern from the pagination work.
- [ ] Consider a shared Minima-node-state hook/context: `WalletPage`, `WalletSettingsPanel`, and `MinimaSettingsPanel` each run their own independent `useMinimaStatusRefresh` subscription today (accepted duplication, no shared store exists yet).
- [ ] Check whether `README.md` needs updating now that Account settings gained Wallet settings and Minima node settings sections (moved off `WalletPage`/`MinimaPage`).

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
- [x] Added Pi Camera capture devices and `Capture camera` automation blocks; cleaned up stale docs README plan rows and GPIO guide links.
- [x] Implemented structured data-source/workflow/block error attribution and UI details — see `docs/plans/structured-error-handling.md`.
- [x] Added structured app/API error helpers, frontend parser support, and high-impact route conversion for Data Sources/Webhook, Automation/read-history, auth/setup, and Integritas actions — see `docs/plans/app-api-error-handling.md`.
- [x] Completed active route-level structured app/API error response migration for address book, feedback, files, wallet, tokens, Minima, Integritas Connect auth, and data-source health failures — see `docs/plans/app-api-error-handling.md`.
- [x] Documented structured backend/frontend error-handling rules in `.agents/rules/` and synced the `.claude/` and `.cursor/` counterparts.
- [x] Fixed the Minima Core "Syncing" false-status root cause and added a durable backend-owned `"restarting"` node state, friendlier RPC errors, and adaptive status polling — see `docs/plans/minima-restart-resync-status.md` (branch `fix/minima-sync-missmatch`).
- [x] Synced Dashboard wallet display and polling to node state; disabled Minima Core and Wallet page actions until the node is confirmed running/idle; added loading indicators (dots/spinner) in place of stale or misleading values across Minima Core, Dashboard, and Wallet.
- [x] Fixed Wallet page going stale after a resync/restart performed from another page by auto-refreshing balance/assets/history on the node's return to `"running"`.
- [x] Moved Wallet settings and Minima node settings out of page-level modals into new `WalletSettingsPanel`/`MinimaSettingsPanel` cards on the Account settings page; removed the now-unused settings buttons/modals from `WalletPage.tsx`/`MinimaPage.tsx`. (Still needs a commit — see Current Focus.)

## Ideas

- [ ] Sync mechanism (script or CI check) to keep `.claude/`/`.agents/` (rules and skills) from drifting — still unbuilt; this session hit a real, if small, instance of the drift it's meant to prevent, caught manually rather than by tooling.

---

Related: [PROJECT.md](./PROJECT.md) · [qa/gaps.md](./qa/gaps.md) · [plans/](./plans/) · [security/](./security/)
