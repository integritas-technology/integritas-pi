# Feedback Feature Plan

**Status:** V1 implemented; V2 hosted API planned  
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
      "area": {
        "id": "automation",
        "label": "Automation"
      },
      "type": "bug",
      "description": "Describe the issue here.",
      "bug": {
        "severity": "medium",
        "reproducibility": "sometimes",
        "expectedBehavior": "Workflow should save.",
        "actualBehavior": "Save button stays disabled."
      },
      "browser": {
        "userAgent": "Mozilla/5.0 ...",
        "language": "en-US",
        "languages": ["en-US", "en"],
        "timezone": "Europe/Stockholm",
        "viewport": {
          "width": 1440,
          "height": 900,
          "devicePixelRatio": 1
        }
      },
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

Top-level `metadata` is refreshed on every submit so the aggregate file reflects current app, user, and device context. Per-submission `stats` and `browser` context are kept on each submission because counts, viewport, browser, and locale are time-sensitive and useful for later analysis.

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
5. Validate optional browser context and bug/feature-specific detail fields.
6. Load `feedback-submissions.json` if it exists.
7. Initialize a new aggregate document if it does not exist.
8. Append the new submission.
9. Write through a temporary file, then rename it over the aggregate file to reduce corruption risk.
10. Record an audit event such as `feedback.submit` without storing the description in the audit log.
11. Return the submission id and export URL.

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
- Let the user choose what app area the feedback is about, even when it differs from the current page.
- Show bug-specific severity, reproducibility, expected behavior, and actual behavior fields for bug reports.
- Show feature-request priority and desired outcome fields for feature requests.
- Include non-secret browser context: user agent, language, timezone, viewport size, and device pixel ratio.
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
- Confirm per-submission page, area, type, description, timestamp, id, browser context, and stats are present.
- Confirm bug reports include bug detail fields and feature requests include feature request detail fields.
- Confirm no secrets are included in the JSON export.

## Later Releases

### V2: Hosted Feedback API

V2 changes the primary sharing path from manual JSON download to direct submission to an Integritas-hosted API. Local JSON persistence remains the durable fallback and manual export path.

Hosted endpoint:

```txt
https://integritas.technology/core/v2/web/feedback
```

Authentication uses the existing Integritas API key from the current encrypted DB-backed settings/secrets flow. Do not add a new feedback API key, and avoid new `.env` variables for V2 feedback configuration.

#### Goals

- Send feedback to an Integritas-hosted API instead of requiring manual file sharing.
- Keep local file export as a fallback if the hosted API is unavailable.
- Add explicit consent copy before transmitting device/user metadata off the Pi.
- Include authenticated user identity metadata, not credential material.
- Add retry handling for offline Pi deployments.
- Add a `Send feedback directly to Integritas` setting/toggle.

#### Step 1: Add Hosted Feedback Setting

Store the setting in SQLite `settings`, not `.env`.

Suggested key:

```txt
feedback.hosted.enabled
```

Default:

```txt
false
```

Add backend config endpoints:

```http
GET   /api/feedback/config
PATCH /api/feedback/config
```

`GET /api/feedback/config` should return non-secret state:

```json
{
  "hostedFeedbackEnabled": false,
  "hostedFeedbackAvailable": false,
  "integritasApiKeyConfigured": true,
  "endpoint": "https://integritas.technology/core/v2/web/feedback"
}
```

`PATCH /api/feedback/config` should be admin-only and accept the toggle:

```json
{
  "hostedFeedbackEnabled": true
}
```

Rules:

- `hostedFeedbackEnabled` reflects the local setting.
- `integritasApiKeyConfigured` reflects whether the existing Integritas API key is available.
- `hostedFeedbackAvailable` is true only when hosted feedback is enabled and an Integritas API key is configured.
- The frontend must never receive the Integritas API key.

#### Step 2: Use Existing Integritas API Key

The backend should use the existing Integritas API key helper:

```ts
getIntegritasApiKey()
```

Rules:

- Do not add a separate feedback API key.
- Do not add a new feedback secret path.
- Never expose the Integritas API key to the frontend.
- If no Integritas API key exists, hosted feedback is unavailable.
- Local feedback save/download still works without an API key.

Frontend copy when unavailable:

```txt
Hosted feedback requires an Integritas API key. Feedback will be saved locally.
```

#### Step 3: Add Explicit Consent

When hosted feedback is enabled and available, the modal must show a required consent checkbox before submitting remotely:

```txt
I agree to send this feedback, device metadata, browser context, and non-secret usage stats to Integritas.
```

Behavior:

- Hosted mode requires consent before submit.
- Local-only mode does not require hosted consent.
- If hosted feedback is enabled but consent is missing, block submit with inline validation.
- Consent should apply to the current submission only; do not silently remember it unless a future product decision explicitly adds remembered consent.

#### Step 4: Save Locally First

Submission flow should always save locally before attempting hosted delivery:

1. Validate feedback payload.
2. Append submission to `feedback-submissions.json`.
3. Initialize `remoteDelivery` state on the submission.
4. If hosted feedback is disabled, mark `remoteDelivery.status = "not_enabled"`.
5. If no Integritas API key is configured, mark `remoteDelivery.status = "not_configured"`.
6. If hosted feedback is enabled, an API key exists, and consent is present, send one submission to the Integritas hosted endpoint.
7. Update the local JSON file with the remote delivery result.
8. Return local save status plus remote delivery status to the frontend.

Reasoning:

- Feedback is not lost when the Pi is offline.
- Manual download remains available.
- Remote failures can be retried later.
- Local JSON remains the operator-visible audit/debug artifact.

#### Step 5: Add Remote Delivery State

Extend each submission with `remoteDelivery`:

```json
{
  "remoteDelivery": {
    "status": "sent",
    "remoteId": "integritas-feedback-id",
    "endpoint": "https://integritas.technology/core/v2/web/feedback",
    "lastAttemptAt": "2026-07-14T12:00:00.000Z",
    "lastSuccessAt": "2026-07-14T12:00:01.000Z",
    "attemptCount": 1,
    "lastError": null
  }
}
```

Statuses:

```txt
not_enabled
not_configured
pending
sent
failed
```

Recommended status usage:

- `not_enabled`: local toggle is off.
- `not_configured`: Integritas API key is missing.
- `pending`: hosted API was unavailable or the Pi was offline, and retry should be attempted later.
- `sent`: hosted API accepted the submission.
- `failed`: hosted API rejected the submission in a way that retry is unlikely to fix without user/operator action.

#### Step 6: Add Hosted API Client

Add a backend client dedicated to hosted feedback delivery:

```txt
backend/src/features/feedback/feedback.remote.ts
```

Responsibilities:

- POST to `https://integritas.technology/core/v2/web/feedback`.
- Use the existing Integritas API key header convention.
- Apply a timeout.
- Parse hosted API success/failure responses.
- Return structured delivery results.
- Never send credential material.
- Do not allow arbitrary custom feedback URLs.

Suggested hosted request body:

```json
{
  "schemaVersion": 1,
  "metadata": {},
  "submission": {}
}
```

Send one submission per request. Do not send the whole historical aggregate file on each submit.

Suggested hosted success response:

```json
{
  "ok": true,
  "remoteId": "integritas-feedback-id",
  "receivedAt": "2026-07-14T12:00:00.000Z"
}
```

Suggested hosted failure response:

```json
{
  "ok": false,
  "error": "Human readable message",
  "errorCode": "rate_limited"
}
```

#### Step 7: Add Retry Support

Add endpoint:

```http
POST /api/feedback/retry-pending
```

Behavior:

1. Require authenticated admin session.
2. Load the aggregate local feedback JSON.
3. Find submissions with `remoteDelivery.status` of `pending` or `failed`.
4. Skip retry if hosted feedback is disabled or no Integritas API key is configured.
5. Send each retryable submission to the hosted endpoint.
6. Update `remoteDelivery` for each attempted submission.
7. Write the updated aggregate JSON atomically.
8. Return counts.

Response shape:

```json
{
  "sent": 2,
  "failed": 1,
  "skipped": 0
}
```

V2 minimum should include manual retry. Automatic interval retry can be added later if needed, but avoid adding a scheduler unless manual retry proves insufficient.

#### Step 8: Integritas Hosted Endpoint Implementation Guidance

The hosted endpoint implementation lives in the Integritas API repository, not in `integritas-pi`. Before implementing it, review and follow the existing Integritas API repo conventions for:

- Route/module layout.
- Authentication middleware.
- API key validation and request-id handling.
- Request validation helpers or schema library.
- Error response shape.
- Logging and redaction rules.
- Rate limiting/throttling primitives.
- Database/repository patterns.
- Background job or queue patterns, if any already exist.

Do not introduce a parallel validation, auth, logging, queue, or persistence style if the Integritas API repo already has one.

Endpoint:

```http
POST /core/v2/web/feedback
```

Expected authentication:

- Use the same Integritas API key header convention as the existing web/core API endpoints.
- Reject missing, invalid, disabled, or revoked API keys before parsing/storing feedback.
- Resolve the API key to the owning Integritas account/project/user using existing repo logic.
- Do not accept user identity from the Pi payload as authentication. Treat Pi-provided user metadata as diagnostic context only.

Expected request body:

```json
{
  "schemaVersion": 1,
  "metadata": {
    "app": {},
    "user": {},
    "device": {}
  },
  "submission": {
    "id": "pi-generated-submission-id",
    "submittedAt": "2026-07-14T12:00:00.000Z",
    "page": {},
    "area": {},
    "type": "bug",
    "description": "...",
    "bug": {},
    "featureRequest": {},
    "browser": {},
    "stats": {}
  }
}
```

Validation requirements:

- Require `schemaVersion = 1`.
- Require `submission.id`, `submission.submittedAt`, `submission.type`, `submission.description`, `submission.page.path`, and `submission.area.id`.
- Validate feedback type enum: `bug`, `ux_issue`, `feature_request`, `question`, `other`.
- Validate feedback area enum to match the Pi-side list where possible.
- Validate bug severity/reproducibility enums when `submission.type = "bug"`.
- Validate feature request priority enum when `submission.type = "feature_request"`.
- Enforce maximum lengths at least as strict as the Pi app for free-text fields.
- Reject or ignore unknown fields according to the Integritas API repo's existing request validation policy.
- Treat all text as untrusted user input. Never render it as HTML without escaping/sanitization.
- Validate timestamps are parseable ISO strings, but do not trust client timestamps for ordering or retention decisions. Store server `receivedAt` separately.
- Validate numeric stats and viewport values are finite numbers within reasonable bounds.
- Limit full request body size. The Pi app currently sends small JSON; the hosted API should not accept multi-megabyte feedback payloads.

Suggested hosted persistence fields:

```txt
id                  server-generated feedback id
created_at          server received timestamp
account_id          owner resolved from Integritas API key
api_key_id          API key id/fingerprint, if the repo tracks it
pi_submission_id    submission.id from the Pi
pi_device_id        metadata.device.id
pi_user_id          metadata.user.id
app_name            metadata.app.name
app_version         metadata.app.version
feedback_type       submission.type
feedback_area       submission.area.id
page_path           submission.page.path
status              new | triaged | ignored | duplicate | resolved, if triage workflow exists
payload_json        validated/redacted full payload
dedupe_key          computed duplicate grouping key
```

Storage guidance:

- Prefer the existing Integritas API repo database/repository style.
- Store the full validated payload as JSON for AI ingestion and future schema evolution.
- Also extract key query fields such as account, type, area, app version, device id, user id, and received time.
- Do not store raw API keys.
- Redact or reject any accidental secret-looking fields if the API repo already has redaction utilities.

Response shape:

```json
{
  "ok": true,
  "remoteId": "server-feedback-id",
  "receivedAt": "2026-07-14T12:00:00.000Z",
  "dedupeStatus": "created"
}
```

Possible `dedupeStatus` values:

```txt
created
appended
duplicate_ignored
```

Failure responses should follow the existing Integritas API error format. Suggested error cases:

- `unauthorized`: missing/invalid API key.
- `validation_error`: malformed request or unsupported schema.
- `payload_too_large`: request body exceeds limit.
- `rate_limited`: API key/account/device sent too many requests.
- `server_error`: unexpected server failure.

Abuse protection:

- Apply the existing Integritas API rate limiter if available.
- Rate-limit by API key/account.
- Also consider secondary limits by `metadata.device.id` and source IP to reduce damage from leaked API keys.
- Use conservative limits for V2 because feedback volume should be low.
- Reject oversized descriptions and oversized request bodies.
- Avoid expensive synchronous AI analysis in the request path.
- Do not let arbitrary payload fields affect database table names, file paths, URLs, or queries.
- Use parameterized queries/ORM-safe writes following the repo pattern.
- Log minimal request metadata only. Do not log full descriptions by default.

Duplicate handling and append strategy:

V2 should avoid creating excessive duplicate feedback rows when the same Pi retries or the same user submits repeated similar feedback.

Recommended dedupe layers:

1. Idempotency by `(account_id, pi_submission_id)`.
2. Soft grouping by a computed `dedupe_key`.

Idempotency rule:

- If the same `pi_submission_id` is received again for the same account, return the original `remoteId` instead of creating a new row.
- This makes Pi retries safe.

Suggested `dedupe_key` inputs:

```txt
account_id
metadata.device.id
metadata.user.id
submission.type
submission.area.id
submission.page.path
normalized description prefix or hash
```

Soft grouping rule:

- If the new feedback matches an open recent item from the same account/device/user/type/area/page and very similar description, append it as an occurrence/comment instead of creating a separate top-level issue.
- Keep the raw submission as a child event so no user input is lost.
- Return `dedupeStatus = "appended"`.

Do not over-dedupe:

- Different descriptions from the same page should remain separate unless clearly identical or near-identical.
- Bug reports and feature requests should not be grouped together.
- Feedback from different accounts should never be merged into one customer-visible item, though internal analytics can aggregate later.

Suggested data model if the Integritas API repo does not already have a feedback/triage model:

```txt
feedback_items
  id
  account_id
  status
  feedback_type
  feedback_area
  page_path
  title_or_summary
  dedupe_key
  created_at
  updated_at

feedback_events
  id
  feedback_item_id
  account_id
  pi_submission_id
  pi_device_id
  pi_user_id
  app_version
  received_at
  payload_json
```

This gives one triage item with many raw feedback events. If that is too much for the first hosted implementation, start with one table plus idempotency by `pi_submission_id`, then add grouping later.

Operational considerations:

- Add metrics/counters if the Integritas API repo already has observability: accepted, validation failed, unauthorized, rate limited, deduped, appended.
- Add admin/search tooling later; do not block initial ingestion on a full triage UI.
- Document retention policy before storing large volumes of user text.
- Make the endpoint safe to disable or roll back without affecting core Integritas stamping APIs.

Testing requirements for the hosted endpoint:

- Auth required: missing/invalid API key is rejected.
- Valid payload is accepted and persisted.
- Invalid schema/type/area is rejected.
- Oversized description/body is rejected.
- Same `pi_submission_id` retry returns original remote id.
- Rate limiter triggers under repeated requests.
- Payload with HTML/script text is stored as text and not executed/rendered unsafely.
- Payload containing suspicious secret-like fields is redacted or rejected according to repo policy.
- Requests from two accounts with the same `pi_submission_id` do not collide.

#### Step 9: Update Frontend UX

The modal should call `GET /api/feedback/config` when it opens.

Show one of these pre-submit states:

```txt
Feedback will be saved locally.
```

```txt
Feedback will be saved locally and sent to Integritas.
```

```txt
Hosted feedback requires an Integritas API key. Feedback will be saved locally.
```

After submit, show one of these outcomes:

```txt
Feedback saved locally and sent to Integritas.
```

```txt
Feedback saved locally, but Integritas upload failed. You can retry later or download the JSON file manually.
```

```txt
Feedback saved locally. Download the JSON file when you are ready to share it.
```

Keep the Download feedback JSON action in all outcomes.

The `Send feedback directly to Integritas` setting/toggle can live in a later feedback/settings panel, but the backend config endpoint should be designed for it from the start.

#### Step 10: Documentation Updates

Update:

- `README.md`
- `CHANGELOG.md`
- `docs/plans/feedback.md`
- Security docs if hosted metadata transfer changes the threat model.

README should explain:

- The hosted Integritas feedback endpoint.
- The `Send feedback directly to Integritas` setting/toggle.
- That the existing Integritas API key is used and never exposed to the frontend.
- What metadata is sent.
- What is never sent.
- Local fallback behavior.
- Retry behavior.

#### Step 11: Verification

Automated checks:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual checks:

- Hosted toggle off: submit feedback and confirm local-only behavior with `remoteDelivery.status = "not_enabled"`.
- Hosted toggle on, no Integritas API key: confirm local save with `remoteDelivery.status = "not_configured"`.
- Hosted toggle on, API succeeds: confirm local save plus `remoteDelivery.status = "sent"` and a remote id when provided.
- Hosted toggle on, API fails: confirm local save plus `pending` or `failed` status.
- Consent unchecked: confirm remote submit is blocked.
- Retry pending: confirm retry sends pending submissions and updates delivery status.
- Payload inspection: confirm no passwords, TOTP secrets, session cookies, Integritas API keys, wallet seed phrases, or raw encrypted secret values are sent.

### V3 And Beyond

- Add an operator-facing feedback history/export page.
- Add configurable diagnostics level: minimal, standard, detailed.
- Include recent non-sensitive frontend/backend error summaries.
- Include app build/version metadata once available.
- Support context snapshots if historical app/device metadata per submission becomes important.
- Move local persistence to SQLite plus export generation if the JSON file becomes too large for read-modify-write appends.
