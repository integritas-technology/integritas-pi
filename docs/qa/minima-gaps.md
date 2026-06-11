# Minima node — QA & testing gaps

**Status:** Open — track in QA phase before treating Minima Core as field-ready  
**Created:** 2026-06-11  
**Hub:** [README.md](./README.md)  
**Plan (shipped):** [minima-node.md](../plans/minima-node.md)  
**Security:** [SECURITY.md](../../SECURITY.md) (auto-resync, Docker restart, RPC allowlist)

## Purpose

Phases 1–3 of the Minima node plan are **implemented** (status DTO, Minima Core UX, backend health poller, optional auto-resync, restart, peers, parser unit tests). This document lists **remaining gaps** for QA: manual checks, live-RPC tests, auth hardening decisions, and polish items discovered during implementation.

**Not in scope here:** new Minima product features (peer remove, generic RPC proxy, Minima CLI, Prometheus export).

---

## Exit criteria (Minima QA sign-off)

Minima moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack with live Minima container.
- [ ] Parser unit tests pass (`npm run test`).
- [ ] Optional: live RPC integration tests pass with `MINIMA_INTEGRATION_TEST=1` (when implemented).

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 5 | Manual flows on real Minima; stopped-container behavior |
| **P1** | 6 | Auth gates, auto-resync restart chain, overview refresh |
| **P2** | 4 | CLI, monitoring persistence, CI live tests |

---

## P0 — Must verify before field pilot

### MINIMA-01 — Stopped container → `state: stopped`

**Plan ref:** [Verification checklist](../plans/minima-node.md#verification-checklist-phase-1-exit) (unchecked)

- [ ] `docker compose stop minima` → `GET /api/minima/status` returns `state: "stopped"` (HTTP 200)
- [ ] Minima Core summary card shows stopped state; node health degrades gracefully
- [ ] `docker compose start minima` → returns to `running` when RPC recovers

### MINIMA-02 — Megammr resync + auto-restart (UI)

**Shipped behavior:** Resync button chains Megammr resync and container restart when Minima reports restart required.

- [ ] Resync completes with success toast (no false `fetch failed` in footer)
- [ ] Stats recover after restart without manual refresh
- [ ] Resync failure surfaces toast only (no misleading inline error when stats are stale)

### MINIMA-03 — Manual restart (Container card)

- [ ] Restart button (admin) confirms, restarts container, stats recover
- [ ] Audit event `minima.container.restart` recorded in `audit_events`

### MINIMA-04 — Peer add (Configure Minima modal)

- [ ] `GET /api/minima/peers` lists configured peers when RPC healthy
- [ ] `POST /api/minima/peers/add` (admin) accepts `host:port`; list updates on modal reopen
- [ ] **Active peers** on health card (`status.network.connected`) differs from configured peer list count — expected; document for operators

### MINIMA-05 — Parser unit tests

```bash
npm run test
```

- [ ] `minima.parse.test.ts` passes (8 tests)
- [ ] Root `npm run check` passes typecheck + tests (npm audit advisory may be pre-existing)

---

## P1 — Recommended during QA

### MINIMA-06 — Admin gate on resync (open decision)

**Plan recommendation:** `requireRole('admin')` on `POST /api/minima/megammrsync/resync`.  
**Current:** Any authenticated session can resync.

- [ ] Product decision: add admin gate **or** accept risk in `SECURITY.md` (V1 has single admin user)

### MINIMA-07 — Admin gate on Megammr config

**Current:** `POST /api/minima/config` is any authenticated user; restart and peer add are admin-gated.

- [ ] Align with Integritas config posture **or** document as accepted prototype risk

### MINIMA-08 — Backend auto-resync does not restart container

**Current:** `MINIMA_AUTO_RESYNC=true` calls `resyncMegammr()` only. UI resync chains restart; poller does not.

- [ ] Document in README/SECURITY **or** extend poller to call `restartMinimaContainer()` when `needsRestart` (same as UI)

### MINIMA-09 — App shell overview not refreshed

**Plan ref:** Optional polish — overview pills one-shot in `AppShell.tsx`.

- [ ] Header “Wallet ready” pill may be stale until page reload
- [ ] Optional: refresh overview on Minima page mount or interval

### MINIMA-10 — Stall detection / monitoring snapshot

- [ ] With `MINIMA_AUTO_RESYNC=false`, verify `monitoring.stallDetected` when block age > threshold
- [ ] Confirm `monitoring.*` resets on backend restart (in-memory only) — document for operators

### MINIMA-11 — Docker socket writable

**Shipped:** Backend mount is writable (required for `POST /api/minima/restart`).

- [ ] Confirm restart works after `docker compose up -d --build backend`
- [ ] Risk accepted in `SECURITY.md` or narrow via socket proxy (future)

---

## P2 — Post-QA / optional

### MINIMA-12 — Live Minima RPC integration tests

**Plan deferred item.** Add behind env flag:

```bash
MINIMA_INTEGRATION_TEST=1 npm --prefix backend run test:minima
```

Covers: `GET /status`, `GET /peers`, resync smoke (destructive — isolated env only).

### MINIMA-13 — Minima CLI commands

**Plan:** No Minima CLI in V1. Operators use UI or curl with session cookie.

- [ ] Document curl examples in README if operators need scripted resync/status

### MINIMA-14 — Peer remove

Minima docs do not document a remove-peers RPC. Add only if product requires it.

### MINIMA-15 — `GET /api/minima/peers` error semantics

Returns **502** when RPC fails; `GET /status` returns **200** with `state: "error"`. Consider aligning in a future API polish pass.

---

## Manual QA checklist (copy for test runs)

```txt
Minima QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Status & health
[ ] GET /api/minima/status — normalized DTO, monitoring block present
[ ] Node health + Container cards equal height; active peers vs configured peers understood
[ ] View RPC debug collapsible; no transient fetch failed after resync/restart

Operations
[ ] Resync — success path with auto-restart when Minima requires it
[ ] Container Restart — confirm dialog, recovery
[ ] Configure Minima — save Megammr host, add peers, peer list loads

Failure modes
[ ] stop minima container → stopped state
[ ] start minima → running when RPC up

Backend poller (optional)
[ ] MINIMA_AUTO_RESYNC=false — stall logged, no resync
[ ] MINIMA_AUTO_RESYNC=true — resync on stall with cooldown (isolated test env)

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-11 | Initial Minima QA gaps from plan vs implementation audit |
