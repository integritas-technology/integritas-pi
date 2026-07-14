# Feedback Feature Plan

**Status:** Planned  
**Created:** 2026-07-14  
**Goal:** Let authenticated operators send structured app feedback from anywhere in the browser UI, save it locally as AI-ingestible JSON, and make it easy to manually share with the Integritas team.

## Summary

V1 adds a small Feedback entry point in the app shell sidebar. It opens a modal form that captures the current app page automatically, lets the operator choose the feedback type, and records a free-text description.

Submissions are saved by the backend into one aggregate JSON file under the existing writable data directory. The same aggregate file can be downloaded from the browser and sent manually by the user.

V2 replaces manual sharing with direct submission to a hosted Integritas API, with explicit care not to transmit secrets or raw credentials.

## Assumptions

- Feedback is available only to authenticated users.
- V1 stores feedback locally on the Pi; it does not contact any external feedback service.
- The frontend submits feedback through the backend API. The browser does not write local files directly.
- The JSON export should be easy for a person to inspect and easy for an AI workflow to ingest later.
- Stable context belongs in top-level metadata; per-submission data should stay focused on the feedback event.

## V1 User Experience

1. User clicks a small Feedback button in the sidebar.
2. App opens a modal.
3. Modal shows the detected current page, based on the current URL and navigation label.
4. User selects feedback type.
5. User writes the feedback description.
6. User submits the form.
7. Backend appends the submission to the local aggregate JSON file.
8. Modal confirms the feedback was saved and offers a Download feedback JSON action.

Feedback types for V1:

- Bug
- UX issue
- Feature request
- Question
- Other

## V1 Storage Model

Use one aggregate JSON file for all local feedback submissions:

```txt
/data/feedback/feedback-submissions.json
```

For native development, this resolves under the configured `DATA_DIR`, usually:

```txt
./data/feedback/feedback-submissions.json
```

The backend should create the `feedback` directory when needed.

## JSON Shape

```json
{
  "schemaVersion": 1,
  "metadata": {
    "createdAt": "2026-07-14T12:00:00.000Z",
    "updatedAt": "2026-07-14T12:15:00.000Z",
    "app": {
      "name": "integritas-pi",
      "version": "0.15.0"
    },
    "user": {
      "id": "user-id",
      "displayName": "Administrator",
      "role": "admin"
    },
    "device": {
      "id": "device-id",
      "hostname": "integritas-pi",
      "platform": "linux",
      "arch": "arm64"
    }
  },
  "submissions": [
    {
      "id": "submission-id",
      "submittedAt": "2026-07-14T12:15:00.000Z",
      "page": {
        "path": "/automation",
        "label": "Automation"
      },
      "type": "bug",
      "description": "Describe the issue here.",
      "stats": {
        "dataSources": 4,
        "dataReads": 120,
        "integritasProofs": 38,
        "automationWorkflows": 3
      }
    }
  ]
}
```

Top-level `metadata` is refreshed on every submit so the aggregate file reflects current app, user, and device context. Per-submission `stats` are kept on each submission because counts are time-sensitive and useful for later analysis.

Do not store or export secrets:

- Passwords
- TOTP secrets or tokens
- Session tokens or cookies
- Integritas API keys
- Wallet seed phrases
- Raw encrypted secret values

## Backend V1 Plan

Add a feedback feature folder:

```txt
backend/src/features/feedback/
  feedback.routes.ts
  feedback.service.ts
```

Routes:

```http
POST /api/feedback
GET  /api/feedback/export
```

`POST /api/feedback` should:

1. Require an authenticated session through the existing global API auth middleware.
2. Validate feedback type, page path, optional page label, and description.
3. Collect current metadata from the authenticated session and existing device/status helpers.
4. Collect lightweight app stats from SQLite.
5. Load `feedback-submissions.json` if it exists.
6. Initialize a new aggregate document if it does not exist.
7. Append the new submission.
8. Write through a temporary file, then rename it over the aggregate file to reduce corruption risk.
9. Record an audit event such as `feedback.submit` without storing the description in the audit log.
10. Return the submission id and export URL.

`GET /api/feedback/export` should:

1. Require an authenticated session.
2. Return the aggregate JSON file as an attachment named `feedback-submissions.json`.
3. If the file does not exist yet, return a valid empty aggregate document or a clear `404` with a user-friendly frontend message.

## Frontend V1 Plan

Add a feedback feature folder:

```txt
frontend/src/features/feedback/
  FeedbackModal.tsx
```

Update `frontend/src/components/AppShell.tsx` to own modal open/close state and render a Feedback button in the shell.

The modal should:

- Use the shared `Modal` component.
- Use shared `Button` and toast helpers.
- Use `postJson` so credentials are included consistently.
- Derive the page path from `useLocation()` or `window.location.pathname`.
- Derive the page label from `frontend/src/app/nav.ts` when possible.
- Keep validation inline for missing type or description.
- Show transient submit failures through `useToast`.
- Show a success state with a Download feedback JSON action linking to `/api/feedback/export`.

The sidebar entry should be intentionally small and not become a full navigation route.

## Documentation Updates For Implementation

When V1 is implemented, update:

- `README.md` with where feedback is stored and how users can download/share it.
- `CHANGELOG.md` under `[Unreleased]`.
- `docs/README.md` if the plan status changes.
- Security docs if exported diagnostics expand beyond the metadata listed here.

## Verification

For the implementation PR, run:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual checks:

- Submit feedback from at least two routes and confirm both submissions appear in one aggregate JSON file.
- Download the aggregate JSON from the browser.
- Confirm metadata is present only once at the top level.
- Confirm per-submission page, type, description, timestamp, id, and stats are present.
- Confirm no secrets are included in the JSON export.

## Later Releases

### V2: Hosted Feedback API

- Send feedback to an Integritas-hosted API instead of requiring manual file sharing.
- Keep local file export as a fallback if the hosted API is unavailable.
- Add explicit consent copy before transmitting device/user metadata off the Pi.
- Include authenticated user identity metadata, not credential material.
- Add retry handling for offline Pi deployments.

### V3 And Beyond

- Add an operator-facing feedback history/export page.
- Add configurable diagnostics level: minimal, standard, detailed.
- Include recent non-sensitive frontend/backend error summaries.
- Include app build/version metadata once available.
- Support context snapshots if historical app/device metadata per submission becomes important.
- Move local persistence to SQLite plus export generation if the JSON file becomes too large for read-modify-write appends.
