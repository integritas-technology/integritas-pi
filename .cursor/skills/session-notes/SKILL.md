---
name: session-notes
description: This skill should be used when the user asks to "update TASKS.md", "update the session notes", "log progress", "wrap up this session", "sync the task list", or otherwise wants docs/SESSION.md and docs/TASKS.md brought up to date with the work actually done so far.
---

# Session Notes

Keep `docs/SESSION.md` (this session's scratch log) and `docs/TASKS.md` (the durable task tracker) in sync with the real state of work. Both drift silently if nobody updates them as work happens — treat this as a reconciliation pass, not a rewrite.

## Process

1. Read the current `docs/SESSION.md` and `docs/TASKS.md` in full before editing either.
2. Review what actually happened in the session so far: what was implemented, fixed, decided, or deferred, and what verification ran (tests, typecheck, manual checks). Don't invent progress that didn't happen.
3. Update `docs/SESSION.md`:
   - `## Progress` — one line per concrete thing done this session, past tense.
   - `## Next Steps` — what's queued next, if anything is still open.
   - `## Notes / Open Questions` — decisions made, tradeoffs, or things the user should weigh in on later.
   - This file is not a changelog — don't touch `CHANGELOG.md` from here.
4. Reconcile `docs/TASKS.md` against what's now true:
   - Move any item that's actually finished and verified to `## Done`, checked off.
   - Add newly discovered work to `## Next` or `## Ideas` — not `## Current Focus` unless the user says it's now the priority.
   - Keep `## Current Focus` to 1-3 items max, per the file's own rule; move overflow to `## In Progress` or `## Next`.
   - Fix or remove stale items (referencing a deleted/superseded file, already resolved another way) instead of leaving them to rot.
5. When a session's work is fully done and merged, reset `docs/SESSION.md` back to its empty template (`[Nothing recorded yet.]` / `[Nothing queued yet.]` / `[None.]`) — its own header says to do this.
6. Report a short summary of what changed in each file.
