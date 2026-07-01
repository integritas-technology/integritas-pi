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
| 1 | Logic sound | ⬜ pending | |
| 2 | Over-engineering / simplify | ⬜ pending | |
| 3 | Coding style consistency | ⬜ pending | |
| 4 | Broken flows | ⬜ pending | |
| 5 | Security | ⬜ pending | |
| 6 | Dead code cleanup | ⬜ pending | |

---

## 1 — Logic sound

**Goal:** Behaviour matches the feature plan; data flows are coherent end-to-end.

**Check**

- [ ] URL params (`tab`, `page`, `pageSize`, `status`, `q`) parse ↔ serialize round-trip correctly
- [ ] Only the active tab fetches on load / tab change
- [ ] Filter or page-size change resets `page` to 1
- [ ] Out-of-range `page` (after delete/filter) clamps instead of showing empty wrongly
- [ ] `GET /history` and `POST /history/poll-pending` return the same paginated envelope for the same query
- [ ] Auto-refresh uses current query params, not full history
- [ ] Dashboard / `StampResultModal` still work with paginated APIs

**Initial suspects**

- Auto-refresh hook updates only `items`, not `total` / `totalPages` — totals may drift after pending rows resolve
- Frontend silently drops invalid `status`; backend returns `400` — inconsistent but probably harmless
- Tab switch resets all list params (`defaultDiagnosticsListQuery`) — intentional per plan, but worth confirming UX

---

## 2 — Over-engineering / simplify

**Goal:** Remove layers that do not earn their keep; prefer one obvious path.

**Check**

- [ ] Is `diagnosticsQuery.ts` + `paginated.ts` + backend `list-query.ts` the minimum needed (URL canonicalization vs API parsing)?
- [ ] Can `applyProofsResponse` / `applyReadsResponse` merge?
- [ ] Can `emptyProofsPage` / `emptyReadsPage` share one helper?
- [ ] Is `toListQueryParams` needed or can `DiagnosticsListQuery` = `ListQueryParams`?
- [ ] Is `loadProofsPage` worth keeping vs inlining in the one mutation path?
- [ ] Duplicate page-size constants (`PAGE_SIZE_OPTIONS` vs `DEFAULT_PAGE_SIZE_OPTIONS`)

**Initial suspects**

- `PAGE_SIZE_OPTIONS` in `diagnosticsQuery.ts` is unused — dead duplicate
- `toListQueryParams` is a 4-line spread wrapper
- Fetch path split: main `useEffect` inlines fetch; mutations use `loadProofsPage` — could unify

---

## 3 — Coding style consistency

**Goal:** Reads like the rest of the app (same patterns, naming, quote style, component boundaries).

**Check**

- [ ] Compare `DiagnosticsPage` with peer pages (`WalletPage`, `DashboardPage`) — hooks, error handling, `busy` pattern
- [ ] `ListPagerFilterBar` matches existing card/table/button patterns (Tailwind vs legacy CSS)
- [ ] API wrappers follow `*Api.ts` conventions elsewhere
- [ ] Backend list routes match style of other feature routers (thin routes, logic in repository)

**Initial suspects**

- `DiagnosticsPage` is more callback/memo-heavy than older pages — may be justified by URL sync
- Quote style mix (double vs single) — pre-existing across pages, only fix if we touch lines

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

- [ ] Remove unused exports/constants (e.g. `PAGE_SIZE_OPTIONS` in `diagnosticsQuery.ts` if unused)
- [ ] Plan doc still references removed `diagnosticsTabToSearchParams` — update when auditing
- [ ] No orphaned imports or commented-out Part 3 loading code
- [ ] No duplicate helpers superseded by shared modules

**Known candidates**

- `frontend/src/pages/diagnosticsQuery.ts` — `PAGE_SIZE_OPTIONS` (unused; bar uses `paginated.ts`)
- `docs/plans/diagnostics-url-pagination-loading.md` — stale helper name in Part 1

---

## How we work through this

1. Pick one part, mark **in progress** in the table above.
2. Walk the checklist; note pass/fail and any fix in the **Notes** column.
3. Fix in small commits only when a part turns up real issues (user decides when to commit).
4. Re-run `npm --prefix backend run build` and `npm --prefix frontend run build` after code changes.
