# Diagnostics feature audit

**Branch:** `diagnostic-query-pagination`  
**Feature plan:** [diagnostics-url-pagination-loading.md](./diagnostics-url-pagination-loading.md)  
**Scope:** URL tabs, server pagination/filter, `ListPagerFilterBar`, related API + caller updates (not Part 3 loading UX)

**Files in scope**

| Area | Files |
| --- | --- |
| Frontend page | `frontend/src/pages/DiagnosticsPage.tsx`, `diagnosticsQuery.ts` |
| Frontend shared | `frontend/src/components/ListPagerFilterBar.tsx`, `frontend/src/lib/paginated.ts` |
| Frontend callers | `integritasApi.ts`, `useIntegritasHistoryAutoRefresh.ts`, `StampResultModal.tsx`, `DashboardPage.tsx`, `dataReadsApi.ts` |
| Backend | `backend/src/shared/list-query.ts`, `integritas.repository.ts`, `integritas.routes.ts`, `dataReads.repository.ts`, `dataReads.routes.ts` |

---

## Progress

| # | Part | Status | Notes |
| --- | --- | --- | --- |
| 1 | Logic sound | ✅ done | Dashboard auto-refresh pageSize fixed; see Part 1 notes below |
| 2 | Over-engineering / simplify | ✅ done | See Part 2 notes below |
| 3 | Coding style consistency | ✅ done | See Part 3 notes below |
| 4 | Broken flows | ⬜ pending | |
| 5 | Security | ⬜ pending | |
| 6 | Dead code cleanup | ⬜ pending | |

---

## 1 — Logic sound

**Goal:** Behaviour matches the feature plan; data flows are coherent end-to-end.

**Check**

- [x] URL params (`tab`, `page`, `pageSize`, `status`, `q`) parse ↔ serialize round-trip correctly
- [x] Only the active tab fetches on load / tab change
- [x] Filter or page-size change resets `page` to 1
- [x] Out-of-range `page` (after delete/filter) clamps instead of showing empty wrongly
- [x] `GET /history` and `POST /history/poll-pending` return the same paginated envelope for the same query
- [x] Auto-refresh uses current query params, not full history
- [x] Dashboard / `StampResultModal` still work with paginated APIs

### Part 1 results

**Pass**

- URL helpers: valid bookmarks round-trip; defaults omitted from URL (`tab=proofs`, `page=1`, `pageSize=50`).
- `useEffect` fetch branches on `activeTab` only — reads not fetched on proofs tab.
- `updateListQuery` resets `page` when `status`, `q`, or `pageSize` change.
- `apply*Response` redirects URL when `page > totalPages` (with items); empty-all case shows empty table, pager displays page 1.
- Backend `GET /history` and `POST /history/poll-pending` share identical list path after poll.
- Diagnostics auto-refresh passes `listQueryParams` (page, filters).
- `StampResultModal` uses `GET /history/:id` — unaffected by list pagination.

**Fixed**

- `DashboardPage`: auto-refresh used default `pageSize: 50` while initial load used `100` — activity list could shrink after first poll. Now passes `{ page: 1, pageSize: 100 }`.

**Minor gaps (no fix yet — Part 4 or accept)**

- Invalid `status` for active tab is ignored in parse but left in URL (`?tab=reads&status=ready` → UI shows “All”, API unfiltered).
- Clamped `pageSize` in URL (e.g. `pageSize=5`) not rewritten to `10` until user changes pager.
- When `totalPages=0` and URL has `page>1`, URL not auto-normalized (display is correct via pager bar).
- Diagnostics auto-refresh updates `items` only, not `total` / `totalPages` — matters mainly with `status=pending` filter when rows leave the page.
- Tab switch resets all list params (per feature plan).

**Initial suspects**

- Auto-refresh hook updates only `items`, not `total` / `totalPages` — totals may drift after pending rows resolve
- Frontend silently drops invalid `status`; backend returns `400` — inconsistent but probably harmless
- Tab switch resets all list params (`defaultDiagnosticsListQuery`) — intentional per plan, but worth confirming UX

---

## 2 — Over-engineering / simplify

**Goal:** Remove layers that do not earn their keep; prefer one obvious path.

**Check**

- [x] Is `diagnosticsQuery.ts` + `paginated.ts` + backend `list-query.ts` the minimum needed (URL canonicalization vs API parsing)?
- [x] Can `applyProofsResponse` / `applyReadsResponse` merge?
- [x] Can `emptyProofsPage` / `emptyReadsPage` share one helper?
- [x] Is `toListQueryParams` needed or can `DiagnosticsListQuery` = `ListQueryParams`?
- [x] Is `loadProofsPage` worth keeping vs inlining in the one mutation path?
- [x] Duplicate page-size constants (`PAGE_SIZE_OPTIONS` vs `DEFAULT_PAGE_SIZE_OPTIONS`)

### Part 2 results

**Simplified (code changed)**

- Merged `applyProofsResponse` / `applyReadsResponse` → one `applyPaginatedPage` helper.
- Merged `emptyProofsPage` / `emptyReadsPage` → `emptyPaginatedPage` in `paginated.ts`.
- Removed `toListQueryParams` and `listQueryParams` memo — pass `listQuery` straight to API wrappers (`""` status/q omitted by `buildListQueryString`).
- Removed `loadProofsPage` — mutations call `getHistory(listQuery)` inline.
- Single `DEFAULT_PAGE_SIZE` + `DEFAULT_PAGE_SIZE_OPTIONS` in `paginated.ts`; removed dead `PAGE_SIZE_OPTIONS` from `diagnosticsQuery.ts`.

**Kept (earns its keep)**

- `diagnosticsQuery.ts` — URL canonicalization (omit defaults, tab-specific status allowlist).
- `paginated.ts` — API query string + shared types/helpers for any list page.
- `backend/list-query.ts` — server-side validation/clamping (frontend can't be trusted).

**Not simplified (would cost clarity)**

- Three parse layers stay — each targets a different boundary (browser URL / API client / server).
- `DiagnosticsListQuery` vs `ListQueryParams` — URL model uses `""` for empty filters; API model omits them. Structurally compatible; no merge needed.

**Initial suspects**

---

## 3 — Coding style consistency

**Goal:** Reads like the rest of the app (same patterns, naming, quote style, component boundaries).

**Check**

- [x] Compare `DiagnosticsPage` with peer pages (`WalletPage`, `DashboardPage`) — hooks, error handling, `busy` pattern
- [x] `ListPagerFilterBar` matches existing card/table/button patterns (Tailwind vs legacy CSS)
- [x] API wrappers follow `*Api.ts` conventions elsewhere
- [x] Backend list routes match style of other feature routers (thin routes, logic in repository)

### Part 3 results

**Pass**

- `busy` + `integritasErrorToast` + inline `error-text` matches `IntegritasPage` / `DataSourcesPage`.
- Subtabs use shared `.subtabs` CSS (same as `WalletPage`), not a one-off pattern.
- `ListPagerFilterBar` uses Tailwind for controls + global `button` / `muted` classes for pager — matches AGENTS.md direction and `WalletPage` filter chips.
- `integritasApi` / `dataReadsApi` follow existing `*Api.ts` shape (`getJson` + typed return); pagination params appended via `buildListQueryString`.
- Backend list routes are thin: parse → count → list → `toPaginatedResult` (same in `integritas.routes.ts` and `dataReads.routes.ts`).

**Aligned (code changed)**

- `DiagnosticsPage` + `diagnosticsQuery.ts`: single quotes (peer pages use single; `*Api.ts` files use double — existing split).
- Subtabs markup formatted like `WalletPage` (multi-line tab buttons).
- Renamed `runProofMutation` → `run`; merged duplicate `handleDownloadSelected` into `run(..., { refresh: false })` — same helper pattern as `IntegritasPage.run`.

**Accepted differences**

- `useCallback` / `useMemo` on DiagnosticsPage — needed for URL-synced fetch deps; `DashboardPage` is simpler because it has no query string.
- `diagnosticsQuery.ts` as a separate module — matches how other pages keep helpers out of the main component when logic is non-trivial.

**Initial suspects**

---

## 4 — Broken flows

**Goal:** Catch UX bugs, especially pagination + selection interactions.

**Check**

- [ ] Select rows on page 1 → next page → selection state (still selected? cleared? visible?)
- [ ] Delete / download selected when selection spans pages or includes off-screen rows
- [ ] Change filter while rows selected
- [ ] Change tab while rows selected (proofs only)
- [ ] Pending refresh button count — current page only vs all pending
- [ ] `/diagnostics?tab=reads&page=2&status=failed` manual test
- [ ] Pending auto-refresh still advances rows on proofs tab
- [ ] Empty filter → muted empty state, not error

**Initial suspects**

- `selectedIds` is **not** cleared on page/filter/tab change — delete/export may target invisible rows (may be OK, but confusing)
- Refresh-pending `(N)` count is **page-local**, not global pending count
- Reads tab shows stale proofs data in state until revisited (low impact)

---

## 5 — Security

**Goal:** No new exposure beyond existing auth boundaries; inputs handled safely.

**Check**

- [ ] List endpoints still behind `requireAuth` (no new public routes)
- [ ] `page` / `pageSize` clamped server-side (no unbounded `LIMIT`)
- [ ] `q` length-capped; SQL uses bound params (no injection via `LIKE`)
- [ ] `status` allowlisted per endpoint
- [ ] `delete-selected` / `export-selected` — arbitrary id list: confirm no cross-tenant/id-guessing issue (single-user prototype; still validate id shape if cheap)
- [ ] Export path / file write still respects `dataDir` and auth
- [ ] No secrets in paginated responses or URL params

**Initial suspects**

- `q` with `%` / `_` acts as SQL wildcards — minor, not injection
- No max on `ids` array length for delete/export — DoS-ish if someone sends huge payload (admin session only)

---

## 6 — Dead code cleanup

**Goal:** Remove leftovers from this feature only.

**Check**

- [x] Remove unused exports/constants (e.g. `PAGE_SIZE_OPTIONS` in `diagnosticsQuery.ts` if unused)
- [ ] Plan doc still references removed `diagnosticsTabToSearchParams` — update when auditing
- [ ] No orphaned imports or commented-out Part 3 loading code
- [ ] No duplicate helpers superseded by shared modules

**Known candidates**

- ~~`frontend/src/pages/diagnosticsQuery.ts` — `PAGE_SIZE_OPTIONS`~~ removed in Part 2
- `docs/plans/diagnostics-url-pagination-loading.md` — stale helper name in Part 1

---

## How we work through this

1. Pick one part, mark **in progress** in the table above.
2. Walk the checklist; note pass/fail and any fix in the **Notes** column.
3. Fix in small commits only when a part turns up real issues (user decides when to commit).
4. Re-run `npm --prefix backend run build` and `npm --prefix frontend run build` after code changes.
