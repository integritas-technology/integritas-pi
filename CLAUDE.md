# CLAUDE.md

> **Sync notice:** This file is a duplicate of `AGENTS.md` (and `.claude/rules/` duplicates `.agents/rules/`), kept for tool compatibility — some tools read `AGENTS.md`/`.agents/`, Claude Code reads `CLAUDE.md`/`.claude/`. When you change one, apply the identical change to its counterpart in the same commit. Do not let them drift.

Behavioral guidelines to reduce common LLM coding mistakes.
Merge with project-specific instructions as needed — see Project Rules below.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project Rules

Read the rules relevant to the area you're working in before editing:

| Doc | Covers |
|---|---|
| [.claude/rules/project-shape.md](.claude/rules/project-shape.md) | Architecture, core principles, what to read before editing |
| [.claude/rules/backend.md](.claude/rules/backend.md) | Backend feature folders, route/schema conventions, auth rules |
| [.claude/rules/frontend.md](.claude/rules/frontend.md) | Frontend feature folders, API usage, styling conventions |
| [.claude/rules/cli.md](.claude/rules/cli.md) | CLI conventions and constraints |
| [.claude/rules/minima.md](.claude/rules/minima.md) | Minima RPC command rules |
| [.claude/rules/integritas.md](.claude/rules/integritas.md) | Integritas stamping/proof rules |
| [.claude/rules/data-sources.md](.claude/rules/data-sources.md) | Data source types and rules |
| [.claude/rules/automation.md](.claude/rules/automation.md) | Automation workflow rules |
| [.claude/rules/docker.md](.claude/rules/docker.md) | Docker / Raspberry Pi deployment rules |
| [.claude/rules/update-agent.md](.claude/rules/update-agent.md) | Update Agent service rules |
| [.claude/rules/verification.md](.claude/rules/verification.md) | Commands to run before finishing changes |
| [.claude/rules/documenting-work.md](.claude/rules/documenting-work.md) | Task summaries, doc updates, changelog policy |

Also see `docs/PROJECT.md` (goals/constraints), `docs/TASKS.md` (current work), and `SECURITY.md` (security policy).
