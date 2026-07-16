# Documenting Work

When finishing a task, summarize:

- What changed.
- Why it changed.
- Which files or feature areas were touched.
- What verification was run.
- Any known limitations, skipped checks, or follow-up work.

Update project documentation when behavior changes:

- Update `CHANGELOG.md` for every user-facing or operator-facing change (see below).
- Update `README.md` for installation, usage, CLI commands, runtime config, API expectations, or operational workflow changes.
- Update `SECURITY.md` for security-sensitive changes, new exposure, new credentials/secrets behavior, host access, or risk tradeoffs.
- Update `AGENTS.md` / `.agents/rules/*.md` for architecture, process, or agent workflow guidance changes.

Do not leave undocumented behavior changes that affect installation, deployment, API usage, CLI usage, or operational workflows.

## Changelog

Keep `CHANGELOG.md` up to date as part of finishing work, not as a follow-up task.

- Follow [Keep a Changelog](https://keepachangelog.com/) sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Add new entries under `## [Unreleased]` while work is in progress on a branch.
- When a branch or release is completed, move `Unreleased` items into a dated version section (for example `## [0.2.0] - 2026-06-09`) and leave a fresh empty `## [Unreleased]` section at the top.
- Write entries for operators and users: what changed, not which files were touched.
- Include auth, API, UI, config/env, Docker/install, CLI, and security-impacting changes.
- A one-line entry is fine for small fixes; larger features deserve a short bullet group.
- If a change is already described in `README.md` or `SECURITY.md`, the changelog should still note it briefly and point to those docs when helpful.
