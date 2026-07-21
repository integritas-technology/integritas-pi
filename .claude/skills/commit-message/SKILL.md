---
name: commit-message
description: This skill should be used when the user asks to "write a commit message", "give me a commit message", "commit message please", or wants a git commit message generated for the current changes without actually running `git commit`.
---

# Commit Message

Produce a single-line commit message subject for the current changes. Output the subject line only — no body, no bullet list, no trailing `Co-Authored-By` line.

## Process

1. Run `git status --short` and `git diff --cached` to see what's staged. If nothing is staged, use `git diff` instead.
2. Run `git log --oneline -10` to match this repo's existing style: short, plain, no `feat:`/`fix:` prefix tags, no trailing period.
3. Write one line describing the actual change — the effect/behavior, not a list of touched files. Prefer the "why" when it isn't obvious from a plain summary of the diff. Use past tense, not imperative/present tense (e.g. "Fixed", "Added", "Changed" — not "Fix", "Add", "Change").
4. Output only that single line, in a fenced code block, with no preamble ("Here's a commit message:"), no explanation, and no alternatives to choose from.
5. Do not run `git commit`. Do not add a `Co-Authored-By` trailer or any other trailer. This skill only produces text for the user to commit themselves.
