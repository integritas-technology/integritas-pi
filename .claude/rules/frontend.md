# Frontend Work

Read these first:

- `frontend/src/App.tsx` for page routing.
- `frontend/src/app/nav.ts` for sidebar navigation.
- `frontend/src/app/types.ts` for shared frontend types.
- `frontend/src/styles.css` for existing visual language.
- `frontend/src/components/` for reusable UI primitives.
- `docs/frontend-design-system.md` for frontend design-system rules and component taxonomy.

Page and feature folders:

- Pages: `frontend/src/pages/`
- Integritas UI/API/types: `frontend/src/features/integritas/`
- Integritas Connect auth UI/API: `frontend/src/features/integritasAuth/`
- Data Sources UI/API/types: `frontend/src/features/data-sources/`
- Automation UI/API/types: `frontend/src/features/automation/`
- Auth UI/API: `frontend/src/features/auth/`
- First-run setup wizard: `frontend/src/features/setup/`

Frontend rules:

- Frontend calls backend API only; do not call Integritas directly from the browser.
- All API fetches use `credentials: "include"` via `frontend/src/lib/api.ts`.
- `AuthProvider` owns bootstrap: no local admin → full wizard; local admin + incomplete first-run setup → local session/PIN login then resume the Connect step; completed first-run setup → app shell or normal login. Later Connect revocation does not reopen onboarding.
- Keep UI state simple unless there is a clear need for a new state layer.
- Use existing shared components (`Page`, `Card`, `Section`, `Pill`, `Modal`, tables/forms helpers) before inventing new patterns.
- Styling direction: component and page styling should be implemented with Tailwind utilities. Plain CSS should be limited to root/body/base global rules only. Follow `docs/frontend-design-system.md` when deciding between shared components, local class constants, and page-specific markup.
- Use the shared toast system (`ToastProvider` / `useToast`) for transient API/action errors that should not occupy page layout, especially when the same action can be triggered from a modal and a page. Keep inline errors for persistent form validation, row-level status, or details the user needs to compare in context.
- Show local and UTC time where workflow scheduling clarity matters.

Error handling rules:

- Backend API failures are normalized in `frontend/src/lib/api.ts`; use `ApiError.details` instead of parsing response strings in feature code.
- Normalize operational/domain errors with `frontend/src/lib/errors.ts` and show details through `frontend/src/components/ErrorDetails.tsx` when row-level or persisted errors need inspection.
- Prefer friendly summary text in rows/toasts and make native details/context/raw JSON secondary in the details view.
- Use `lastErrorDetails`/`errorDetails` fields when available, falling back to legacy string errors for old records.
- Do not show workflow/block failures as data-source/device errors; Devices should show source health and source failures only, while automation failures belong in workflow run/block UI.
