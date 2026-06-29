# Route Mapping & Navigation State

**Status:** Pending  
**Created:** 2026-06-29  
**Goal:** Replace prototype's local `useState` navigation with URL-backed routes using React Router. Each nav item maps to a defined path with browser history, deep linking, and refresh-safe state.

---

## Route Table

| NavId | Path |
|---|---|
| dashboard | /dashboard |
| setup | /setup |
| node | /node |
| wallet | /wallet |
| integritas | /integritas |
| data | /data |
| automation | /automation |
| diagnostics | /diagnostics |
| settings | /settings |

---

## Part 1 — Implementation

- [ ] Wrap `main.tsx` in `<BrowserRouter>`
- [ ] Add `<ProtectedRoute>` component — reads `useAuth().user`, redirects to `/login` if null, shows loader while `loading` is true
- [ ] Replace `ActivePage` with `<Routes>` + `<Route>` entries (9 routes) inside `AppShell`'s content area
- [ ] Replace sidebar `setActive(id)` calls with `<NavLink to="/path">` (active state comes for free)
- [ ] Add `/` → `/dashboard` redirect and a `*` 404 fallback route

## Part 2 — Cleanup

- [ ] Remove `active: NavId` state and `setActive` from `AppContent`
- [ ] Remove `active` / `setActive` props from `AppShell`
- [ ] Delete the `ActivePage` component
- [ ] Replace `onBack={() => setActive("dashboard")}` and `onStartSetup={() => setActive("setup")}` patterns with `useNavigate()` inside those pages directly
