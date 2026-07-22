# Backend Unit Tests Plan

**Status:** In Progress
**Created:** 2026-07-22
**Goal:** Build vitest unit test coverage across `backend/src/features/*`, one feature folder at a time. Prioritize security-critical and business-critical logic over exhaustive coverage — pure-logic and DB-backed service/repository behavior first, thin route wiring last (or skipped where it's just glue).

## Conventions

- Test files live in `backend/tests/features/<feature>/<module>.test.ts`, mirroring `backend/src/features/<feature>/<module>.ts`.
- Use `node:assert/strict` + vitest's `describe`/`it` (not vitest's `expect`) — matches the pre-existing `minima.parse.test.ts`/`tokens.parse.test.ts`.
- Import source with the compiled `.js` extension (NodeNext ESM resolution), e.g. `../../../src/features/auth/password.service.js`.
- Pure-function modules (parsing, validation) need no setup.
- DB-backed modules (repositories, services that hit `db`) use `backend/tests/helpers/testDatabase.ts` — sets `DATABASE_PATH` to a unique temp file, dynamically imports `db/database.js` so the singleton binds to it, runs `runMigrations()`, and returns `{ db, teardown }`. Dependent modules (repository/service) must also be dynamically imported inside `beforeAll`, after the DB is set up, since they statically import the `db` singleton.
- Network-calling modules (Minima RPC, Integritas HTTP client, MQTT) aren't covered yet — need a mocking/fixture strategy decision before starting (see Open Questions).
- Routes (`*.routes.ts`) are **not** unit-tested directly. Decision: treat them as thin wiring — pull input off `req`, call an already-tested service function, map the result/error to a response — and consider service/repository coverage sufficient. Revisit for a specific route only if it grows real logic beyond that. See "Future Hardening" for the gap this leaves.

## Progress

| Feature | Status | Notes |
|---|---|---|
| `auth` | Done | Covered: `password.service.ts`, `session.service.ts`, `auth.service.ts` (`login`/`changePassword`), `auth.repository.ts` setup-pending lifecycle, `audit.service.ts`, `auth.middleware.ts` (`requireAuth`/`requireRole`), `setup.service.ts` (admin-creation/setup-complete state machine, `completeSetup`, guarded TOTP error paths). Deliberately skipped: `totp.service.ts` (dead code, `TOTP_ENABLED = false`) and the happy-path "valid TOTP code" branches of `verifySetupTotp`/`initSetupTotp` (same reason — not worth the investment). Also skipped: `rate-limit.middleware.ts` (trivial `express-rate-limit` config, no logic) and `integritas-validation.service.ts` (fully commented out, no live exports). `auth.routes.ts`/`setup.routes.ts` intentionally out of scope — see the routes decision above and "Future Hardening" below. |
| `minima` | Partial | `minima.parse.ts` covered (pre-existing, before this plan). Not started: `minima.service.ts`, `minima.rpc.ts`, `minima-poll.service.ts`, `minima-monitoring.ts`, `minima.docker.ts` — mostly RPC/Docker-socket calls. |
| `tokens` | Partial | `tokens.parse.ts` covered (pre-existing). Not started: `tokens.service.ts`, `tokens.repository.ts`. |
| `automation` | Not started | `automation.validation.ts` (323 lines, pure When/Condition/Then rule validation) is the highest-value/lowest-friction next target — no DB/network. `automation.service.ts`/`automation.repository.ts`/`automationRuns.repository.ts` need the DB harness. |
| `wallet` | Not started | `wallet.parse.ts` is a pure-function module, same shape as `minima.parse.ts`/`tokens.parse.ts` — cheap next target. `wallet.service.ts` likely needs Minima RPC mocking. |
| `data-reads` | Not started | `dataReads.repository.ts`/`dataReads.service.ts` — DB harness, similar shape to `automationRuns.repository.ts`. |
| `data-sources` | Not started | `dataSources.service.ts`/`dataSources.repository.ts` need the DB harness; `gpioIngestion.service.ts`/`gpioOutput.service.ts`/`mqttIngestion.service.ts`/`mqttOutput.service.ts` need hardware/MQTT mocking — lower priority. |
| `integritas` | Not started | `integritas.service.ts`/`integritas.repository.ts` need DB harness + HTTP client mocking; `integritas-poll.service.ts` similar. |
| `integritas-auth` | Not started | `integritas-auth-crypto.service.ts` is small and pure — cheap target. Rest needs HTTP/device-identity mocking. |
| `settings` | Not started | `secrets.service.ts`/`settings.repository.ts` — DB harness. |
| `status` | Not started | `docker.control.ts`/`docker.service.ts` need Docker-socket mocking; `device.service.ts` may be simpler — check before scoping. |
| `address-book` | Not started | `address-book.repository.ts` — DB harness. |
| `feedback` | Not started | `feedback.service.ts` (339 lines) — check for DB/network dependencies before scoping. |
| `files` | Not started | `files.service.ts` — host filesystem access, needs a fixture/sandbox strategy. |
| `debug`, `health` | Not started | Thin route wiring — likely low priority, may skip. |

## Open Questions

- Network-calling modules (Minima RPC over HTTP, Integritas HTTP client, MQTT ingestion/output): mock at the `fetch`/client boundary, or leave to integration/manual testing? Needs a decision before those feature areas are picked up.

## Future Hardening

Routes are deliberately unit-test-free (see the decision above), which means nothing today directly verifies HTTP-layer-only behavior: per-route input guards (e.g. `typeof req.body?.password === "string" ? ... : ""`), error-to-status-code mapping in each route's `catch` block, cookie serialization (`res.cookie(name, token, sessionCookieOptions())`), and — the one that actually matters for security — that `requireAuth`/`requireRole` are wired onto the right routes in `app.ts`. A route unit test would catch these; a service test structurally cannot.

Considered and rejected for now: full supertest coverage per route file (`*.routes.test.ts` mirroring every route module) — high cost (new `supertest` dependency, real middleware stack per request, `authRateLimiter`'s in-memory 5-req/15min limiter needs a reset/mock strategy to avoid tests 429ing each other) for low marginal value once handlers stay thin.

Cheaper alternative, not yet started: a single supertest-based smoke test that walks `app.ts`'s route table and asserts every non-public `/api/*` route returns 401 without a session cookie (public routes per `backend.md`: `GET /api/health`, `GET /api/setup/status`, `POST /api/setup/*`, `POST /api/auth/login`). Written once, catches the one failure mode — a route missing `requireAuth` — that matters most, without turning every route file into an integration-test target.

## Verification

- `npm --prefix backend run test` (vitest)
- `npm --prefix backend run typecheck`

Keep this file updated as work progresses — flip rows to Partial/Done and resolve Open Questions as decisions are made.
