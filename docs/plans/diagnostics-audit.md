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
| 4 | Broken flows | ✅ done | See Part 4 notes below |
| 5 | Security | ✅ done | `ids` array length now capped; see Part 5 notes below |
| 6 | Dead code cleanup | ✅ done | Unused `ListPagerFilterStatusOption` export removed; see Part 6 notes below |

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

- URL helpers: valid bookmarks round-trip. `tab`, `page`, `pageSize` are always written explicitly to the URL (including defaults) — intentional, per `6259cd0` / CHANGELOG.
- `useEffect` fetch branches on `activeTab` only — reads not fetched on proofs tab.
- `updateListQuery` resets `page` when `status`, `q`, or `pageSize` change.
- `apply*Response` redirects URL when `page > totalPages` (with items); empty-all case shows empty table, pager displays page 1.
- Backend `GET /history` and `POST /history/poll-pending` share identical list path after poll.
- Diagnostics auto-refresh passes `listQueryParams` (page, filters).
- `StampResultModal` uses `GET /history/:id` — unaffected by list pagination.

**Fixed**

- `DashboardPage`: auto-refresh used default `pageSize: 50` while initial load used `100` — activity list could shrink after first poll. Now passes `{ page: 1, pageSize: 100 }`.
- `useIntegritasHistoryAutoRefresh`: `onPage`/`onRecords` were unstable inline closures included directly in the effect's dependency array. Since the effect calls `refresh()` immediately on (re)run, and `refresh()` sets state → re-renders `DiagnosticsPage` → recreates the closure → re-triggers the effect, the hook fired `getHistory` back-to-back (no ~15s gap) for as long as a proof stayed pending, instead of on the intended `DEFAULT_INTERVAL_MS` cadence. Pre-existing bug (present before `6259cd0` too via the old `onRecords` closure), not caught by the original Part 1 pass. Fixed by reading the latest callbacks from a ref instead of the effect's dependency list, so the effect only re-runs when `shouldRefresh`/`intervalMs`/query params actually change. `DashboardPage`'s usage was unaffected (it passes the stable `setProofs` setter directly).

**Minor gaps (no fix yet — Part 4 or accept)**

- Invalid `status` for active tab is ignored in parse but left in URL (`?tab=reads&status=ready` → UI shows “All”, API unfiltered).
- Clamped `pageSize` in URL (e.g. `pageSize=5`) not rewritten to `10` until user changes pager.
- When `totalPages=0` and URL has `page>1`, URL not auto-normalized (display is correct via pager bar).
- Tab switch resets all list params (per feature plan).

**Initial suspects**

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

**Re-fixed (regressed after `6259cd0`)**

- Adding `pendingTotal` to `IntegritasHistoryPage` reintroduced the split this section claims was merged: a proofs-only `applyProofsPage` sat next to the generic `applyPaginatedPage`, with the last two params in swapped order between them (`setPage, clampPage` vs `clampPage, setPage`) — a real footgun, not just duplication. `emptyProofsPage` stayed a thin one-line wrapper over `emptyPaginatedPage` (fine, not duplicated logic, left as-is). Fixed by widening `applyPaginatedPage<T extends { totalPages: number }>` so it works for `IntegritasHistoryPage` directly; `applyProofsPage` removed, all four call sites now use `applyPaginatedPage` with one consistent argument order.

**Kept (earns its keep)**

- `diagnosticsQuery.ts` — URL canonicalization (tab-specific status allowlist; `tab`/`page`/`pageSize` are now always written explicitly, see Part 1).
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

- Subtabs use shared `.subtabs` CSS (same as `WalletPage`), not a one-off pattern.
- `ListPagerFilterBar` uses Tailwind for controls + global `button` / `muted` classes for pager — matches AGENTS.md direction and `WalletPage` filter chips.
- `integritasApi` / `dataReadsApi` follow existing `*Api.ts` shape (`getJson` + typed return); pagination params appended via `buildListQueryString`.
- Backend list routes are thin: parse → count → list → `toPaginatedResult` (same in `integritas.routes.ts` and `dataReads.routes.ts`); `proofHistoryPage` living as a small router-local helper in `integritas.routes.ts` has precedent (`status.routes.ts` does the same).

**Fixed**

- `run()`'s catch block called both `showToast` and `setError(message)` for mutation failures (verify/delete/download) — the only page in the app that double-reports a mutation error via toast *and* a persistent inline banner. Checked `WalletPage`, `IntegritasPage`, `DataSourcesPage`: all three set the inline `error-text` state exclusively from their load/refresh path, and use toast-only for mutation failures. Removed `setError(message)` from `run()`'s catch — `error` state is now driven solely by the list-load `useEffect`, matching the sibling pattern.

**Aligned (code changed)**

- Subtabs markup formatted like `WalletPage` (multi-line tab buttons).
- Renamed `runProofMutation` → `run`; merged duplicate `handleDownloadSelected` into `run(..., { refresh: false })` — same helper pattern as `IntegritasPage.run`.

**Accepted differences**

- `useCallback` / `useMemo` on DiagnosticsPage — needed for URL-synced fetch deps; `DashboardPage` is simpler because it has no query string.
- `diagnosticsQuery.ts` as a separate module — matches how other pages keep helpers out of the main component when logic is non-trivial.
- Quote style: repo-wide split, not specific to this feature (`WalletPage`/`IntegritasPage`/`DashboardPage`/`DiagnosticsPage` use single quotes; `DataSourcesPage`/`MinimaPage`/`AutomationPage`/`AuthSettingsPage`/`SetupPage` use double). Previous "peer pages use single" note overstated this as a settled convention — it isn't, and it's out of scope for this feature to fix repo-wide.

**Initial suspects**

---

## 4 — Broken flows

**Goal:** Catch UX bugs, especially pagination + selection interactions.

**Check**

- [x] Select rows on page 1 → next page → selection state (still selected? cleared? visible?)
- [x] Delete / download selected when selection spans pages or includes off-screen rows
- [x] Change filter while rows selected
- [x] Change tab while rows selected (proofs only)
- [x] Pending refresh button count — current page only vs all pending
- [x] `/diagnostics?tab=reads&page=2&status=failed` manual test (code path verified; URL parse + API filter)
- [x] Pending auto-refresh still advances rows on proofs tab
- [x] Empty filter → muted empty state, not error

### Part 4 results

**Fixed**

- **Selection cleared** on tab, page, page-size, status, or search change — no invisible delete/download targets.
- **Pending count + auto-refresh regression**: pagination had limited polling to the current page. `GET /history` and `poll-pending` now include `pendingTotal` (global pollable pending count). Auto-refresh uses it correctly (`shouldRefresh` in the hook). **Re-broken, now re-fixed:** despite this section's earlier claim, the "Refresh pending" button in `IntegritasHistoryTable` never actually received `pendingTotal` — it computed its own `pendingOnPage` from `records` (current page only) for both the displayed count and the `disabled` state. Practical effect: viewing page 2+ (or a filter that hides pending rows) while proofs were pending elsewhere showed the wrong count and **disabled the button entirely**, even though clicking it would have correctly triggered a global poll on the backend. Fixed by adding a `pendingTotal` prop to `IntegritasHistoryTable`, wired from `proofsPage.pendingTotal` in `DiagnosticsPage`; button count/disabled state now match what the click actually does. `DataReadsHistoryTable` has no equivalent concept (reads have no pending/poll state) — no change needed there.
- **Empty filter copy**: tables show “No matching …” when filters active, not a generic empty error.

**Accepted**

- Cross-page multi-select is not supported (selection clears on page change). Delete/export remain current-page selection only — predictable for V1.
- Stale proofs state while on reads tab (not rendered) — low impact.

**Initial suspects**

---

## 5 — Security

**Goal:** No new exposure beyond existing auth boundaries; inputs handled safely.

**Check**

- [x] List endpoints still behind `requireAuth` (no new public routes)
- [x] `page` / `pageSize` clamped server-side (no unbounded `LIMIT`)
- [x] `q` length-capped; SQL uses bound params (no injection via `LIKE`)
- [x] `status` allowlisted per endpoint
- [x] `delete-selected` / `export-selected` — arbitrary id list: confirm no cross-tenant/id-guessing issue (single-user prototype; still validate id shape if cheap)
- [x] Export path / file write still respects `dataDir` and auth
- [x] No secrets in paginated responses or URL params

### Part 5 results

**Pass**

- `requireAuth` applied globally in `app.ts` before both `integritasRouter` and `dataReadsRouter` are mounted — no new public routes.
- `pageSize` clamped server-side to 10–100 in `list-query.ts` regardless of client input; `LIMIT`/`OFFSET` in both repositories always use the clamped value.
- `q` capped at 200 chars server-side; both repositories use `LIKE ?` with the value passed as a bound parameter, not string-interpolated into SQL — no injection vector.
- `status` allowlisted per endpoint (`PROOF_LIST_STATUSES`, `DATA_READ_LIST_STATUSES`), enforced server-side independent of frontend behavior.
- `writeProofExport` builds the export path from `env.dataDir` + a server-generated timestamp filename — no user input reaches the filesystem path. Route sits behind the same global `requireAuth`.
- Pagination didn't add any new response fields beyond the pre-existing row shape — no new secret/field exposure.
- `UserRole` is `"admin"` only (single role in the whole system, confirmed in `auth.types.ts`) — the missing `requireRole` on delete/export/verify routes isn't a real privilege gap right now; matches the "single-user prototype" framing already in this doc.

**Fixed**

- `delete-selected` / `export-selected` validated `ids` as an array of non-empty strings but never capped its *length*. `express.json({ limit: "2mb" })` bounds the request body, but that's still tens of thousands of UUID-length strings — enough synchronous work (a `better-sqlite3` transaction loop, or a per-id `getProofRecord` loop for export) to stall the single-threaded backend for a noticeable stretch. Low severity (admin-only, self-inflicted), but cheap to close. Added a shared `parseSelectedIds` helper in `integritas.routes.ts` capping at 500 ids (well above the UI's max — selection can never exceed one page's `pageSize`, capped at 100 — since selection always clears on page change).

**Accepted (unchanged)**

- `q` containing `%` / `_` acts as a raw SQL `LIKE` wildcard — not an injection (still a bound parameter value), just occasionally confusing search matches (e.g. `q=%` matches everything). Low value to fix; left as-is.
- No app-wide rate limiting (checked `app.ts` — no `express-rate-limit`/`helmet`). Pre-existing across the whole app, not introduced by this feature; out of scope here.

**Initial suspects**

- `q` with `%` / `_` acts as SQL wildcards — minor, not injection
- No max on `ids` array length for delete/export — DoS-ish if someone sends huge payload (admin session only)

---

## 6 — Dead code cleanup

**Goal:** Remove leftovers from this feature only.

**Check**

- [x] Remove unused exports/constants (e.g. `PAGE_SIZE_OPTIONS` in `diagnosticsQuery.ts` if unused)
- [x] Plan doc still references removed `diagnosticsTabToSearchParams` — update when auditing
- [x] No orphaned imports or commented-out Part 3 loading code
- [x] No duplicate helpers superseded by shared modules

### Part 6 results

**Fixed**

- `ListPagerFilterStatusOption` was `export type`-ed from `ListPagerFilterBar.tsx` but never imported anywhere else (checked every `.ts`/`.tsx` file in the repo) — `PROOF_STATUS_OPTIONS`/`READ_STATUS_OPTIONS` satisfy it structurally via `as const` without ever naming the type. Changed to a local (non-exported) `type`.

**Verified clean (no action needed)**

- No commented-out Part 3 loading/`FetchPhase` code anywhere in the diagnostics files (`FetchPhase` doesn't appear in the frontend at all — Part 3 of the feature plan was never started, not partially started and abandoned).
- No orphaned imports in any in-scope file — walked every export from `diagnosticsQuery.ts`, `paginated.ts`, `list-query.ts`, `integritasApi.ts`, `dataReadsApi.ts` and confirmed each is used at least once outside its own defining file.
- No duplicate helpers remain — the one real duplicate (`applyPaginatedPage` / `applyProofsPage`) was caught and merged back in Part 2.
- No leftover pre-pagination code in either repository (`dataReads.repository.ts` has no vestigial unpaginated `listDataSourceReads`; `integritas.repository.ts`'s `listPendingProofRecords` is a distinct function used by the background poll service, not a leftover from this feature).

**Known candidates (resolved)**

- ~~`frontend/src/pages/diagnosticsQuery.ts` — `PAGE_SIZE_OPTIONS`~~ removed in Part 2.
- ~~`frontend/src/components/ListPagerFilterBar.tsx` — `ListPagerFilterStatusOption` unused export~~ un-exported in Part 6.
- `docs/plans/diagnostics-url-pagination-loading.md` — stale helper name (`diagnosticsTabToSearchParams` vs. actual `diagnosticsSearchParams`) and stale "omit defaults" URL description. Left alone per user decision — that doc is being deprioritized in favor of this audit doc and the explicit-URL-params behavior it now describes accurately in Parts 1–2 above.

---

## How we work through this

1. Pick one part, mark **in progress** in the table above.
2. Walk the checklist; note pass/fail and any fix in the **Notes** column.
3. Fix in small commits only when a part turns up real issues (user decides when to commit).
4. Re-run `npm --prefix backend run build` and `npm --prefix frontend run build` after code changes.
