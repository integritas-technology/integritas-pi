# Documenting Work

When finishing a task, summarize:

- What changed.
- Why it changed.
- Which files or feature areas were touched.
- What verification was run.
- Any known limitations, skipped checks, or follow-up work.

Apply that summary to `docs/SESSION.md` and reconcile `docs/TASKS.md` — use the `session-notes` skill for this.

Update project documentation when behavior changes:

- Update `CHANGELOG.md` for every user-facing or operator-facing change (see below).
- Update `README.md` for installation, usage, CLI commands, runtime config, API expectations, or operational workflow changes.
- Update `SECURITY.md` for security-sensitive changes, new exposure, new credentials/secrets behavior, host access, or risk tradeoffs.
- Update `AGENTS.md`/`CLAUDE.md` and `.agents/rules/*.md`/`.claude/rules/*.md`/`.cursor/rules/*.mdc` (kept in sync, see sync notice at the top of each) for architecture, process, or agent workflow guidance changes.

Do not leave undocumented behavior changes that affect installation, deployment, API usage, CLI usage, or operational workflows.

## Changelog

Keep `CHANGELOG.md` up to date as part of finishing work, not as a follow-up task.

- Follow [Keep a Changelog](https://keepachangelog.com/) sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Add new entries under `## [Unreleased] <branch-name>` (the actual git branch name) while work is in progress — this keeps concurrent branches from editing the same shared heading and colliding on merge. Do not use a bare `## [Unreleased]`.
- When a branch merges into `main`, leave its `## [Unreleased] <branch-name>` section as-is; multiple such sections can sit above the latest dated release at once.
- When cutting a release, consolidate every `## [Unreleased] <branch-name>` section into one dated version section (for example `## [0.2.0] - 2026-06-09`), removing the per-branch headings.
- Write entries for operators and users: what changed, not which files were touched.
- Include auth, API, UI, config/env, Docker/install, CLI, and security-impacting changes.
- A one-line entry is fine for small fixes; larger features deserve a short bullet group.
- If a change is already described in `README.md` or `SECURITY.md`, the changelog should still note it briefly and point to those docs when helpful.
