# [Feature Name] Plan

| | |
|---|---|
| **Status** | **Not started** \| **In progress** \| **Complete** |
| **Done** | _(summary when complete)_ |
| **Next** | _(current focus)_ |
| **Deferred** | _(moved to QA or out of scope)_ |

_One-line description: what this feature does and who it is for._

Companion docs: [docs index](../README.md), [project README](../../README.md), [SECURITY.md](../../SECURITY.md), [AGENTS.md](../../AGENTS.md). Prior art: _(link related plans)_. QA: [qa/README.md](../qa/README.md).

**External interface (if any):** _(authoritative upstream API, protocol, or hardware boundary — link to external docs)_

---

## Verdict

_(2–4 sentences: current state, what shipped or remains, link to QA gaps when complete.)_

**Naming / scope notes:** _(ticket vs API path mismatches, nav vs API ids, intentional deferrals)_

---

## Shipped capabilities

_Update during/after implementation. When complete, audit against codebase._

| Area | Status | Implementation |
|---|---|---|
| _(capability)_ | **Not started** \| **Partial** \| **Done** | _(route, file, or behavior)_ |

### Not shipped / deferred → [qa-gaps.md](../qa/[feature]-gaps.md)

| Item | Notes |
|---|---|
| _(item)_ | _(QA, open decision, or out of scope)_ |

---

## Canonical API routes

_All routes require `requireAuth` unless noted. Document admin gates._

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/api/[feature]/…` | _(purpose)_ | **Not started** |

**Related (outside this feature namespace):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend liveness (public) |

**CLI:** _(none in V1 \| document commands)_

---

## Upstream / integration reference

_Optional. Vendor API, RPC commands, env vars, allowlists._

```txt
# Example request or command shape
```

**Allowlist:**

| Command / operation | Purpose | Exposed via |
|---|---|---|
| _(name)_ | _(purpose)_ | _(route or internal only)_ |

Do **not** add generic proxies. Each capability gets a narrow service function and route (per `AGENTS.md` and `SECURITY.md`).

---

## Target architecture (KISS + separation of concerns)

```txt
Browser
  → /api/[feature]/* (routes: HTTP only)
  → [feature].service.ts (orchestration)
  → [feature].rpc.ts | external client (if applicable)
  → [feature].parse.ts (raw → typed DTOs)
  → persistence / settings / cross-feature helpers

Schedulers (if any)
  → [feature]-poll.service.ts (started from index.ts after migrations)
```

**Principles:**

1. _(e.g. one client, parse once, no frontend upstream calls)_
2. _(e.g. fail safe, no secrets in responses)_
3. _(e.g. extend existing folders before new abstractions)_

---

## Current state snapshot

_Refresh when auditing plan vs code. Date: YYYY-MM-DD_

### Backend (`backend/src/features/[feature]/`)

| File | Role |
|---|---|
| _(file)_ | _(role)_ |

### Frontend (`frontend/src/features/[feature]/`)

_(pages, components, hooks, API client)_

### Cross-cutting

_(shared services, docker, schedulers, overview integration)_

### Git history

| Commit | Summary |
|---|---|
| _(hash)_ | _(message)_ |

### Open gaps → [qa-gaps.md](../qa/[feature]-gaps.md)

---

## API shape

**Recommended primary DTO** _(endpoint name)_:

```ts
type [Feature]Status = {
  checkedAt: string;
  // … stable fields operators and UI rely on
};
```

**State / enum derivation:**

| Value | When |
|---|---|
| _(state)_ | _(condition)_ |

---

## Implementation plan

### Phase 1 — [title] — **not started** \| **in progress** \| **complete**

**Goal:** _(smallest useful slice)_

#### Backend

1. _(step)_
2. _(step)_

**Files:** _(list)_

**Env:** _(new vars or “none”)_

#### Frontend

1. _(step)_

**Verification:**

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Manual: _(operator-visible outcomes)_

---

### Phase 2 — [title] — **not started** \| **deferred** \| **complete**

**Goal:** _(e.g. scheduler, automation, polling)_

| Rule / config | Default |
|---|---|
| _(name)_ | _(value)_ |

**Files:** _(list)_

---

### Phase 3 — [title] — **not started** \| **deferred** \| **complete**

| Item | Approach |
|---|---|
| _(item)_ | _(approach)_ |

---

## Frontend UX target

| UI element | Data source |
|---|---|
| _(element)_ | _(API field or route)_ |

**Optional polish:** _(deferred items)_

---

## Open decisions

| # | Decision | Recommendation / outcome |
|---|---|---|
| 1 | _(question)_ | _(choice or TBD)_ |

---

## Verification checklist (phase exit)

- [ ] _(acceptance criterion)_
- [ ] `npm run check` passes
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `README.md` updated if operator-facing behavior changed
- [ ] `SECURITY.md` updated if security-sensitive

---

## Changelog & docs

When shipping each phase:

- Add operator-facing notes to `CHANGELOG.md` (`[Unreleased]`).
- Update `README.md` if install, API, or CLI expectations change.
- Update `SECURITY.md` for new exposure, credentials, or host access.
- Mark plan **Complete** in `docs/README.md`; move testing/hardening to `docs/qa/[feature]-gaps.md`.

---

## Ticket checklist (tracking copy)

**Backend**

- [ ] _(item)_

**Frontend**

- [ ] _(item)_

**Future / QA**

- [ ] _(deferred to QA)_
