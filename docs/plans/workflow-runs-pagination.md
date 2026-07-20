# Workflow Runs Pagination Plan

**Status:** Not started
**Created:** 2026-07-20
**Goal:** Bring the Diagnostics "Workflow logs" tab to pagination parity with the existing `proofs`/`reads` tabs (page/pageSize/status/search, URL-driven), instead of its current hardcoded `limit=100` fetch with no pager or filters.

## Current State

`DiagnosticsPage.tsx` has three tabs: `proofs`, `reads`, `workflow-runs`. `proofs`/`reads` already share a full pagination stack: `ListPagerFilterBar`, `frontend/src/lib/paginated.ts` helpers, URL-driven query state in `diagnosticsQuery.ts`, and a backend contract (`backend/src/shared/list-query.ts`'s `parseListQuery`/`toPaginatedResult`) already used end-to-end by the `reads` tab (`dataReads.routes.ts` + `dataReads.repository.ts`).

`workflow-runs` bypasses all of this: it calls `listAutomationRuns(100)` (a flat `GET /api/automation/runs?limit=100`), renders the full array through `AutomationRunsTable` with no pager, and is explicitly excluded from `ListPagerFilterBar`. As run history grows, this tab has no way to page, filter by status, or search.

A separate, smaller endpoint — `GET /api/automation/workflows/:id/runs` (used by `AutomationPage.tsx`'s Watch mode, limit=20) — is a different per-workflow recent-runs list and is out of scope; it keeps its existing simple `limit`-only contract.

One deliberate deviation from strict parity: unlike `reads`/`proofs`, workflow runs are created by "Run now" actions elsewhere in the app with no polling, so this tab keeps a lightweight manual **Refresh** action (re-fetches the current page/filters) rather than dropping it for pure parity.

## Backend Plan

`backend/src/features/automation/automationRuns.repository.ts`:

- Add `AUTOMATION_RUN_LIST_STATUSES = ["running", "success", "failed"]` and a `buildAutomationRunListWhere(query)` helper (status + `q` LIKE-search over `id`, `workflow_name`, `trigger_type`, `trigger_source_id`, `error` — `workflow_name` is a real denormalized column on `automation_runs`, no join needed), modeled on `buildDataReadListWhere` in `dataReads.repository.ts`.
- Add `countAutomationRuns(query)` (same shape as `countDataSourceReads`).
- Change `listAutomationRuns(limit = 100)` to `listAutomationRuns(query: AutomationRunListQuery)`, doing `LIMIT ? OFFSET ?` like `listDataSourceReads`.
- Leave `listAutomationRunsForWorkflow(workflowId, limit = 20)` untouched.

`backend/src/features/automation/automation.routes.ts`:

- Rewrite the `GET /runs` handler to use `parseListQuery`/`toPaginatedResult`/`countAutomationRuns`, mirroring `dataReads.routes.ts`'s `GET /` handler exactly.
- Leave `GET /runs/:id`, `GET /workflows/:id/runs`, and the `limitFromQuery` helper untouched.

`backend/src/features/automation/automation.service.ts`:

- Change `listSerializedAutomationRuns`'s param from `limit?: number` to the parsed query object.
- Leave `listSerializedAutomationRunsForWorkflow` untouched.
- Accept as-is: `serializeAutomationRun`'s per-row `listAutomationBlockRuns` query (N+1) still runs per page, now bounded to `pageSize` (10-100) instead of up to 500 — a net improvement, not a blocker.

## Frontend Plan

`frontend/src/features/automation/automationApi.ts`:

- Change `listAutomationRuns` to accept `ListQueryParams` and return `PaginatedResponse<AutomationRun>` via `buildListQueryString`, mirroring `listDataReads` in `dataReadsApi.ts`.
- Leave `listAutomationWorkflowRuns` untouched (only consumer: `AutomationPage.tsx` Watch mode).

`frontend/src/pages/diagnosticsQuery.ts`:

- Add `WORKFLOW_STATUS_OPTIONS` (`running`/`success`/`failed`), next to `PROOF_STATUS_OPTIONS`/`READ_STATUS_OPTIONS`.
- Update `parseDiagnosticsListQuery`'s `allowedStatuses` switch — the `workflow-runs` branch currently returns `[]`, silently stripping any `status` param today.

`frontend/src/pages/DiagnosticsPage.tsx`:

- Replace the standalone `workflowRuns` state with `workflowRunsPage` (`emptyPaginatedPage<AutomationRun>`), fed by the same `load()` effect / `applyPaginatedPage` pattern as `reads`.
- Simplify `handleRefreshWorkflowRuns` to re-fetch at the current `listQuery` (keeps the Refresh button, per the decision above).
- Fold `workflow-runs` into the shared `activePager`/`statusOptions` dispatch and remove its exclusion from `ListPagerFilterBar`.
- Update the render branch to pass `workflowRunsPage.items` to `AutomationRunsTable` (component itself needs no changes).

## What Must Not Change

- `listAutomationRunsForWorkflow`, `GET /workflows/:id/runs`, `limitFromQuery`, `listSerializedAutomationRunsForWorkflow`, `listAutomationWorkflowRuns`, `AutomationPage.tsx` Watch mode.
- `frontend/src/lib/paginated.ts`, `frontend/src/components/ListPagerFilterBar.tsx`, `backend/src/shared/list-query.ts` — all reused as-is.

## Verification

- `npm run typecheck` / `npm run check` (both exist at repo root).
- Manual: page through workflow runs, filter by status, search by workflow name/run id, confirm Refresh re-fetches at the current page/filters, confirm `?status=bogus` still 400s, confirm Watch mode's separate recent-runs list is unaffected.
