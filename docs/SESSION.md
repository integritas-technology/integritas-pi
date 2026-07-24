# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

Branch `fix/minima-sync-missmatch`, verified locally via Docker Compose (`docker compose build <service> && docker compose up -d <service>`) against `https://localhost:8080` — no authenticated browser session available, so verification has been typecheck/build/container-health only, never live click-through. `npm run dev` was tried but has flaky interactions with the restart/resync/status polling flows, so Docker rebuild+redeploy is the agreed verification path for this branch, even though it costs more time per change.

- Fixed the root cause of Minima Core showing "Syncing" when already up to date: `deriveSyncStatus` (`backend/src/features/minima/minima.parse.ts`) was conflating peer-connectivity with chain-sync; simplified to rely only on `rpcOk`/`blockAgeSeconds`.
- Added a durable backend-owned `"restarting"` node state (`MinimaNodeState`) so restart/resync-in-progress is visible from any page/after navigation, not just page-local React state — see `docs/plans/minima-restart-resync-status.md`. Backend tracks operation start/expiry in `minima-monitoring.ts` (`beginMinimaOperation`/`endMinimaOperation`/`isMinimaOperationInProgress`, 120s window) and overrides computed node state in `minima.service.ts`.
- Applied `normalizeMinimaRpcError()` uniformly across Minima RPC routes (not just `/status`) for friendlier error text instead of raw RPC/abort messages.
- Made Minima status polling adaptive: 3s while `"restarting"`, 30s otherwise (`useMinimaStatusRefresh.ts`), applied to both the Minima Core page and the Dashboard.
- Merged the Dashboard's separate node/wallet polling loops into one `tick()` so wallet balance display follows node state one-way (loading/"Unavailable" instead of a stale or misleading value), on the same cadence as node polling.
- Disabled Minima Core page's Resync/Restart buttons until status is confirmed loaded and not already mid-operation.
- Moved the restart/resync "operation in progress" message into a page-level amber banner (was buried in a card footer), sourced from backend truth so it survives navigation.
- Fixed a timing gap between the restart-complete toast and the UI already showing recovered status: extended `refreshAfterOperation`'s retry budget from ~12s to 90s (backend's own operation window is 120s).
- UI polish pass on the Minima Core page: restyled "View RPC debug" as a full-width secondary button with icon (always visible, disabled when no data); moved Restart/Resync buttons to card footers with matching full-width secondary-button styling; removed hover-lift effect on summary cards; moved the "Checked at" timestamp from the Node health card to the Minima card; fixed an empty-header-space bug left behind by that move.
- Standardized `LoadingDots` to a fixed `bg-slate-400` (was `bg-current`, which inherited inconsistent colors per call site).
- Disabled all Wallet page functionality (Receive/Send/Create token/Import wallet) while Minima isn't confirmed `"running"`, using an `actionsBlocked` (gates buttons) vs `minimaConfirmedUnavailable` (gates the warning banner) split — the split exists specifically so the banner doesn't flash "unavailable" during the initial unconfirmed/loading window when the node is actually fine.
- Replaced the Wallet hero's raw/zero balance with `LoadingDots`, and added a spinner (`Loader2`, matching `ProgressModal`'s existing spinner pattern, sized `size-10`) for the Assets and History sections whenever loading or `actionsBlocked`.
- Fixed Wallet page going stale after a resync/restart done from the Minima Core page while Wallet stayed mounted: added a ref-tracked previous-Minima-state check in `WalletPage.tsx` that calls `refresh()` (reloads balance/assets/history) the moment `minimaState` transitions from any non-`running` value back to `"running"`.
- Moved Wallet settings (Import wallet / Export-coming-soon) out of a `WalletPage` modal into a new self-contained `WalletSettingsPanel` card on the Account settings page (`AuthSettingsPage.tsx`), following the existing `IntegritasConnectPanel` pattern; removed the settings icon button and modal from `WalletPage.tsx`.
- Moved Minima node settings (megammr host config, peer connections/add-peers) out of a `MinimaPage` modal into a new `MinimaSettingsPanel` card on the Account settings page, reusing the existing `MinimaRuntimeConfig` presentational component; removed the settings icon button, modal, and all related state/handlers from `MinimaPage.tsx`. **Not yet committed** — this is the very last change made this session.
- Both new settings panels (`WalletSettingsPanel`, `MinimaSettingsPanel`) independently call `useMinimaStatusRefresh` and derive their own `actionsBlocked`/`minimaConfirmedUnavailable` locally — there is no shared Minima-state store/context yet, so each consumer polls and derives on its own (confirmed via research agent; documented as a known duplication, not an oversight).

## Next Steps

- Commit the pending `MinimaSettingsPanel` change (`frontend/src/features/minima/MinimaSettingsPanel.tsx` new, `frontend/src/pages/AuthSettingsPage.tsx` + `frontend/src/pages/MinimaPage.tsx` modified) — typecheck/build clean, container rebuilt and healthy, but not yet `git commit`ed.
- `CHANGELOG.md` has no `[Unreleased]` section — none of this branch's user-facing Minima/Wallet/Settings changes are logged yet. Per `.claude/rules/documenting-work.md` this should be added before the branch is considered done.
- Manual click-through verification is still outstanding for the whole branch (no authenticated browser session was available this session): restart/resync from Minima Core, Dashboard tile behavior during restart, Wallet page gating/spinners/auto-repoll, and the two new Account-settings panels (Wallet settings import flow, Minima node settings save/add-peers) all need a real pass.
- Consider whether a shared Minima-node-state hook/context is worth building now that three consumers (`WalletPage`, `WalletSettingsPanel`, `MinimaSettingsPanel`, plus `MinimaPage`/`DashboardPage`) each run their own `useMinimaStatusRefresh` subscription — currently accepted duplication, not yet a problem, but worth a second look if a fourth consumer shows up.
- README.md may need an update if the Account settings page gained enough surface area (Wallet settings, Minima node settings) to warrant documenting in the operational/API-usage sections — not checked yet this session.

## Notes / Open Questions

- Architecture principle applied throughout: backend is the sole source of truth for "operation in progress" and node state; frontend pages/panels are thin pollers/renderers, never competing local state.
- User's explicit governing rule for all enable/disable logic: "we only want to allow button presses when we are 100% sure we are in a state it will be useful."
- User's explicit process preference: one page/component at a time, verify (typecheck + build + Docker rebuild/redeploy), then move on — an earlier multi-page bundled change broke and had to be reverted.
- `npm run dev` is known to interact badly with the restart/resync/status polling flows in this environment — use `docker compose build <service> && docker compose up -d <service>` for verification on this branch instead, even though the user is otherwise running the app via `npm run dev` day-to-day.
