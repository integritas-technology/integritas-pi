# [Feature Name] — QA & testing gaps

**Status:** Open — track in QA phase before treating [feature] as field-ready  
**Created:** YYYY-MM-DD  
**Hub:** [qa/README.md](./README.md)  
**Plan (shipped):** [[feature].md](../plans/[feature].md)  
**Security:** [SECURITY.md](../../SECURITY.md) _(link relevant sections)_

## Purpose

Phases _[N]_ of the [feature] plan are **implemented** (_brief list_). This document lists **remaining gaps** for QA: manual checks, integration tests, auth hardening decisions, and polish items discovered during implementation.

**Not in scope here:** new product features (_list explicit out-of-scope items_).

---

## Exit criteria ([Feature] QA sign-off)

[Feature] moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack (_environment notes_).
- [ ] Automated tests pass (`npm run test` or feature-specific command).
- [ ] Optional: live integration tests pass with `_[FEATURE]_INTEGRATION_TEST=1` (when implemented).

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | _N_ | _(must verify before field pilot)_ |
| **P1** | _N_ | _(recommended during QA)_ |
| **P2** | _N_ | _(post-QA / optional)_ |

---

## P0 — Must verify before field pilot

### FEATURE-01 — [short title]

**Plan ref:** [Verification checklist](../plans/[feature].md#verification-checklist-phase-exit) _(if applicable)_

- [ ] _(test step)_
- [ ] _(test step)_

### FEATURE-02 — [short title]

**Shipped behavior:** _(what the code does today)_

- [ ] _(test step)_

_(Add FEATURE-03, … as needed.)_

---

## P1 — Recommended during QA

### FEATURE-0N — [short title]

**Plan recommendation:** _(if from open decision)_  
**Current:** _(actual behavior)_

- [ ] Product decision: fix **or** accept risk in `SECURITY.md`

_(Repeat per gap.)_

---

## P2 — Post-QA / optional

### FEATURE-0N — [short title]

_(Description. Include env flag, command, or doc update if applicable.)_

```bash
# Example integration test invocation
FEATURE_INTEGRATION_TEST=1 npm --prefix backend run test:[feature]
```

---

## Manual QA checklist (copy for test runs)

```txt
[Feature] QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Core flows
[ ] _(happy path)_
[ ] _(happy path)_

Failure modes
[ ] _(degraded / stopped / error state)_

Security / auth (if applicable)
[ ] _(admin-only routes, audit events)_

Automated
[ ] npm run test — _(suite name)_
[ ] npm run check

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| YYYY-MM-DD | Initial [feature] QA gaps from plan vs implementation audit |
