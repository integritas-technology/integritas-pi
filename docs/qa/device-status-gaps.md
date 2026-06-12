# Device Status — QA & testing gaps

**Status:** Open — track in QA phase before treating device status as field-ready  
**Created:** 2026-06-12  
**Hub:** [qa/README.md](./README.md)  
**Plan (shipped):** [plans/device-status.md](../plans/device-status.md)  
**Security:** [SECURITY.md](../../SECURITY.md)

## Purpose

Both phases of the device-status plan are **implemented** (Phase 1 — `device.service.ts`, `GET /api/status`, graceful shutdown; Phase 2 — dashboard device status card). This document lists **remaining gaps** for QA: manual verification steps, unit tests deferred from the plan, and implementation notes discovered during audit.

**Not in scope here:** wallet presence in status, health-polling scheduler, per-step setup status (all explicitly deferred — see plan).

---

## Exit criteria (Device Status QA sign-off)

Device status moves from **shipped** to **QA-accepted** when:

- [ ] All **P0** items below are verified **or** explicitly accepted in `SECURITY.md`.
- [ ] **P0 manual checklist** passed on a Pi or dev stack.
- [ ] `npm run check` passes.

---

## Gap summary

| Priority | Count | QA focus |
|----------|-------|----------|
| **P0** | 3 | Must verify before field pilot |
| **P1** | 2 | Recommended during QA |
| **P2** | 3 | Post-QA / optional |

---

## P0 — Must verify before field pilot

### DS-01 — `GET /api/status` endpoint shape and auth

**Plan ref:** [Verification checklist Phase 1](../plans/device-status.md#phase-1)

- [ ] `GET /api/status` returns 200 with `device`, `app`, `node` top-level keys after login
- [ ] `GET /api/status` returns 401 without a valid session (auth gate enforced)
- [ ] `app.setupComplete` reflects actual DB state (true after wizard, false on fresh stack)
- [ ] `node.state` is `"unknown"` immediately after backend restart, then transitions to `"running"` or `"error"` after the first Minima poller tick
- [ ] `app.integritasConnected` is `null` when no API key is configured, `true`/`false` when one is set

### DS-02 — Device ID stability

**Shipped behavior:** `ensureDeviceId()` writes a `crypto.randomUUID()` to the `settings` table on first startup and reads it back on subsequent calls.

- [ ] `device.id` is identical across at least two backend restarts
- [ ] `device.id` is not regenerated when other settings change (e.g. re-running setup)

### DS-03 — Graceful shutdown

**Shipped behavior:** `SIGTERM` and `SIGINT` call `stopAutomationScheduler()`, `stopIntegritasProofPoller()`, `stopMinimaHealthPoller()`, `db.close()`, then `process.exit(0)`.

- [ ] `docker stop <container>` completes within the Docker stop timeout (default 10s) — no hang
- [ ] No uncaught exception or error log lines on graceful shutdown
- [ ] Restart after shutdown starts cleanly (migrations run, device ID retained)

---

## P1 — Recommended during QA

### DS-04 — Unit tests for `device.service.ts`

**Plan recommendation:** Deferred to QA stage.  
**Current:** No automated tests exist for `ensureDeviceId()` or `getDeviceInfo()`.

- [ ] Write `node:test` unit tests covering: `ensureDeviceId` generates and persists ID on first call; returns existing ID on subsequent calls; `getDeviceInfo` returns expected shape with all required fields present

### DS-05 — Unit/integration tests for `status.routes.ts` `GET /`

**Plan recommendation:** Deferred to QA stage.  
**Current:** No route-level tests for the new handler.

- [ ] Add tests covering: authenticated 200 with correct shape; unauthenticated 401; `node` field populated from monitoring snapshot

---

## P2 — Post-QA / optional

### DS-06 — Integration tests for `GET /api/health`

**Plan recommendation:** Deferred to QA stage.  
**Current:** No integration test exercises the public health endpoint.

```bash
# Smoke test (no auth required)
curl -sf http://localhost:3000/api/health | python3 -m json.tool
```

- [ ] Add `node:test` integration test: `GET /api/health` returns `{ status: "ok", service: "integritas-pi" }` (or equivalent) without session cookie

### DS-07 — `integritasConnected` live-check behaviour under failure conditions

**Implementation note (audit finding):** The plan specified `GET /api/status` should make "no upstream network calls" and use cached state only. The implementation adds a live Integritas API health check (`integritasConnected`) with a 3s timeout and 30s server-side cache. The cache mitigates the latency concern, but the call can still slow the first request in each 30s window if the Integritas endpoint is unreachable.

- [ ] Verify response time of `GET /api/status` when Integritas API is unreachable (expect ≤ 3.5s due to timeout)
- [ ] Verify `integritasConnected: false` is returned (not a 500) when the upstream times out
- [ ] Product decision: accept current behaviour **or** move `integritasConnected` to a separate endpoint / make it opt-in

### DS-08 — API shape drift between plan and implementation

**Implementation note (audit finding):** The shipped `device` object includes two fields not in the plan's `DeviceStatus` type: `cpuCount: number` and `disk: DeviceDisk | null`. The frontend `statusTypes.ts` is correct — it reflects the actual shape. The plan's type definition is stale.

- [ ] Update the API shape in [plans/device-status.md § API shape](../plans/device-status.md#api-shape) to add `cpuCount`, `disk`, and `app.integritasConnected` — documentation only, no code change needed

---

## Manual QA checklist (copy for test runs)

```txt
Device Status QA — YYYY-MM-DD — environment: [ ] dev  [ ] Pi

Core flows
[ ] GET /api/status returns 200 with device, app, node after login
[ ] device.id is stable across two backend restarts
[ ] node.state is "unknown" on fresh start, then updates after poller tick
[ ] app.setupComplete reflects actual DB state

Auth gate
[ ] GET /api/status returns 401 without session cookie

Graceful shutdown
[ ] docker stop completes without hang
[ ] No error logs on shutdown
[ ] Restart after shutdown: device ID retained, migrations clean

Dashboard
[ ] Device status card renders on dashboard without JS console errors
[ ] Six metric cards visible (Device, CPU, Memory, Disk, Node status, Integritas API)
[ ] Card auto-refreshes every 30s (observe network tab)

Integritas connection check
[ ] integritasConnected is null when no API key set
[ ] integritasConnected is true/false depending on reachability when key is set

Automated
[ ] npm run check
[ ] npm --prefix backend run build
[ ] npm --prefix frontend run build

Sign-off: ___________
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-12 | Initial device-status QA gaps from plan vs implementation audit |
