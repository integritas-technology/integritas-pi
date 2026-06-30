# Diagnostics: URL query, pagination, loading state

**Status:** In progress (Part 1 done)  
**Created:** 2026-06-30  
**Goal:** Make the Diagnostics page shareable, scalable, and honest about fetch state — without duplicating business logic outside the backend API.

**Related:** [DiagnosticsPage.tsx](../../frontend/src/pages/DiagnosticsPage.tsx), [IntegritasHistoryTable.tsx](../../frontend/src/features/integritas/IntegritasHistoryTable.tsx), [DataReadsHistoryTable.tsx](../../frontend/src/features/data-reads/DataReadsHistoryTable.tsx)

---

## Current state

| Area | Today |
| --- | --- |
| Route | `/diagnostics` (React Router, no query params anywhere in frontend yet) |
| Tabs | Local `useState`: `proofs` \| `reads` |
| Proof history API | `GET /api/integritas/history` — returns **all** rows |
| Read history API | `GET /api/data-reads` — hard-coded `LIMIT 500` in repository |
| Initial load | Both lists fetched on mount regardless of active tab |
| Loading UI | None for list fetch; `busy` only covers verify/delete/download mutations |
| Auto-refresh | `useIntegritasHistoryAutoRefresh` polls full history when proofs tab is active and pending rows exist |

---

## Part 1 — URL query string

**Scope:** Tab selection only in V1 of this ticket (`tab`), not pagination/filter params yet (those land in Part 2).

### Query param

| Param | Values | Default |
| --- | --- | --- |
| `tab` | `proofs` \| `reads` | `proofs` |

Examples:

- `/diagnostics` → proof history tab
- `/diagnostics?tab=reads` → read history tab
- `/diagnostics?tab=foo` → fall back to `proofs` (replace URL quietly)

### Implementation

1. Add a small helper, e.g. `frontend/src/pages/diagnosticsQuery.ts`:
   - `parseDiagnosticsTab(searchParams)` → `DiagnosticsTab`
   - `diagnosticsTabToSearchParams(tab)` → partial params object
2. In `DiagnosticsPage`, replace `useState` tab with `useSearchParams` from `react-router-dom`:
   - Read `tab` on render.
   - Tab button `onClick` → `setSearchParams({ tab })` with `replace: true` so tab switches do not pollute browser history.
3. Only fetch the list for the **active** tab on mount and when `tab` changes (defer Part 2 pagination params).
4. Keep `useIntegritasHistoryAutoRefresh` gated on `tab === "proofs"`.

### Acceptance

- [x] Refreshing `/diagnostics?tab=reads` stays on read history.
- [x] Back/forward after visiting another section still works; tab switches inside diagnostics use `replace`.
- [x] Invalid `tab` values normalize to `proofs`.

---

## Part 2 — List pagination + filter (reusable component)

**Scope:** Server-side pagination for both log tables, plus a reusable frontend control bar. Filters should be useful but minimal — avoid building a generic data-grid framework.

### Backend API shape (both endpoints)

Extend:

- `GET /api/integritas/history`
- `GET /api/data-reads`

Query params (consistent naming):

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | number ≥ 1 | `1` | 1-based page index |
| `pageSize` | number | `50` | clamp e.g. 10–100 |
| `status` | string | — | proofs: `pending` \| `ready` \| `failed`; reads: `success` \| `failed` |
| `q` | string | — | optional substring match on hash / UID / source name (keep SQL simple: `LIKE`) |

Response shape:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 50,
  "total": 123,
  "totalPages": 3
}
```

Repository changes:

- `listProofRecords({ page, pageSize, status, q })` + `countProofRecords(...)` with the same filters.
- `listDataSourceReads({ page, pageSize, status, q })` + count; remove the silent `LIMIT 500` in favour of explicit pagination (document default page size in UI).

Update frontend API wrappers (`integritasApi.getHistory`, `dataReadsApi.listDataReads`) to accept query params and return the paginated envelope.

### Reusable component

Add `frontend/src/components/ListPagerFilterBar.tsx` (name flexible):

- **Filter row:** status `<select>` (optional per tab) + search `<input>` with debounced `onChange` (~300ms).
- **Pager row:** “Showing X–Y of Z”, prev/next buttons, optional page-size select.
- Props driven by parent; component does not fetch — keeps it reusable for future list pages (wallet history, etc.).

Wire query params into the URL in this part (not just tab):

| Param | When present |
| --- | --- |
| `tab` | always (from Part 1) |
| `page` | when > 1 |
| `pageSize` | when ≠ default |
| `status` | when filter active |
| `q` | when non-empty |

Reset `page` to `1` when `tab`, `status`, or `q` changes.

### Page integration

- `DiagnosticsPage` owns URL ↔ fetch orchestration (single place).
- Pass **only the current page** of items into `IntegritasHistoryTable` / `DataReadsHistoryTable`.
- Update `useIntegritasHistoryAutoRefresh` to refresh **current page** (same query params), not full history.
- Audit other callers of `getHistory()` / `listDataReads()` (`DashboardPage`, `StampResultModal`) — they can keep unpaginated behaviour via default `pageSize` high enough for dashboard preview, or a dedicated “recent N” if needed.

### Acceptance

- [ ] Large proof/read lists render one page at a time.
- [ ] Filters and page changes update the URL and survive refresh.
- [ ] `ListPagerFilterBar` is generic enough to reuse without diagnostics-specific logic inside it.
- [ ] Empty filter result shows the existing muted empty state, not an error.

---

## Part 3 — Loading + fetching status (simple state machine)

**Scope:** Separate **list fetch lifecycle** from **mutation `busy`** (verify, delete, download).

### State machine (per tab)

Each tab maintains its own fetch state:

```txt
idle → loading   (first fetch for this tab / param set)
loading → ready  (success)
loading → error  (failure)
ready → fetching (background refresh: auto-poll, manual refresh, tab revisit with cached params)
fetching → ready
fetching → error (optional: keep stale rows visible + inline error)
error → loading  (retry)
```

Suggested type:

```ts
type FetchPhase = "idle" | "loading" | "ready" | "fetching" | "error";
```

- **`loading`:** no rows yet — show skeleton or centered “Loading…” in the table card (match `AddressBookPanel` / `WalletPage` muted text pattern).
- **`fetching`:** rows may be visible — show a small non-blocking indicator in the card header (“Updating…” + optional subtle spinner on the refresh control).
- **`error`:** toast for transient failures; keep inline `error-text` for persistent load failure with a Retry button.
- **`busy`:** unchanged for row actions; disable action buttons only, not the whole table.

### DiagnosticsPage responsibilities

1. On tab or query change → `loading` if no cached data for that key, else `fetching`.
2. Optional light cache keyed by `tab + serialized query` so switching tabs back does not flash empty.
3. `useIntegritasHistoryAutoRefresh` triggers `fetching`, not `loading`, and respects current pagination filters.
4. Surface `lastUpdatedAt` (local time) in the table header when `ready` — helps operators trust auto-poll.

### Acceptance

- [ ] First visit shows loading, not an empty table.
- [ ] Auto-refresh does not blank the table or show the full-page loader.
- [ ] Manual “refresh pending” on proofs sets `fetching` and preserves selection where possible.
- [ ] Mutation `busy` and list `fetching` can overlap without UI deadlock.

---

## Part 4 — Cleanup

**Scope:** Remove duplication and leave the feature maintainable.

### Code cleanup

- [ ] Stop fetching both lists on mount; fetch only active tab (Part 1) with pagination params (Part 2).
- [ ] Extract shared tab buttons if diagnostics and wallet subtabs diverge — optional; only if it reduces copy-paste.
- [ ] Remove stale copy: DataReadsHistoryTable “Showing the latest 500…” → dynamic “Showing X–Y of Z”.
- [ ] Ensure `poll-pending` / `getHistory` responses stay consistent with paginated list shape (poll may return updated rows for current view only, or trigger a refetch — pick one approach and document in code comment).
- [ ] Drop unused `result` / `JsonPreview` at page bottom if nothing sets it anymore, or scope it to debug-only actions.

### Docs / changelog

- [ ] `CHANGELOG.md` under `[Unreleased]`: URL-backed diagnostics tab, paginated/filtered log APIs, loading indicators.
- [ ] `README.md` API section: document new query params on history endpoints (brief).
- [ ] No `SECURITY.md` change expected (same auth boundaries).

### Verification

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Manual:

- [ ] `/diagnostics?tab=reads&page=2&status=failed` loads correctly.
- [ ] Pending proof auto-refresh still advances rows to ready on proofs tab.
- [ ] Dashboard recent activity still works after API shape change.

---

## Suggested implementation order

1. **Part 1** — URL tab only (frontend-only, quick win).
2. **Part 3** — loading state machine on current full-list APIs (unblocks UX before backend pagination).
3. **Part 2** — backend pagination + `ListPagerFilterBar` + URL params for page/filter.
4. **Part 4** — cleanup, docs, and caller audit.

Parts 2 and 3 can swap if you prefer API-first; the order above ships tab deep-linking and honest loading early.

---

## Out of scope (this ticket)

- Client-side-only pagination of full lists (do not download everything then slice in the browser once API pagination exists).
- Generic query-param hook for the whole app (YAGNI until a second page needs it).
- CLI support for paginated history.
- Export/download of filtered pages (export-selected stays selection-based).
