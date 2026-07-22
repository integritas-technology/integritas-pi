# App/API Error Handling Plan

Status: Implemented for active route-level API error responses. Shared backend helpers and frontend parsing are in place; active routes now return structured `errorDetails` while preserving existing compatibility fields. Status endpoints may still embed plain nested service-error strings inside successful status payloads.

This plan covers request, validation, authorization, and unexpected system errors. It is separate from domain/operational errors such as data-source failures and workflow block failures; see `docs/plans/structured-error-handling.md` for those.

## Problem

Backend routes currently return inconsistent error shapes, for example:

```json
{ "error": "name is required" }
```

```json
{ "ok": false, "error": "address is required" }
```

```json
{ "error": "Workflow validation failed", "validation": { "ok": false } }
```

The frontend normalizes most failed responses into `Error.message` in `frontend/src/lib/api.ts`, keeping only `status` and sometimes `errorCode`. Pages then display the string as a toast or inline error. This makes it hard to distinguish validation, auth, not-found, conflict, system, and dependency errors consistently.

## Goal

- Use a consistent app/API error envelope for request-level failures.
- Keep app/API errors separate from persisted domain errors.
- Preserve native/system details for diagnostics without leaking stack traces or secrets to normal UI.
- Let frontend render validation, auth, conflict, not-found, and system failures differently.
- Support legacy `{ error: string }` responses during migration.

## Error Categories

### Domain/Operational Errors

These are product events and may be persisted in data-source, workflow, block, proof, or read history state.

Examples:

- GPIO watcher cannot start.
- MQTT broker connection fails.
- Camera capture block fails.
- Integritas stamp fails.

Handled by: `docs/plans/structured-error-handling.md`.

### App/API Errors

These are request/interaction errors. They usually should not become operational history.

Examples:

- User submitted invalid form data.
- Session expired.
- User lacks admin role.
- Workflow not found.
- Source cannot be deleted because another record depends on it.

### System Errors

These are unexpected infrastructure or code failures.

Examples:

- SQLite write failed.
- Required config is missing.
- Unhandled exception.
- Dependency unavailable outside a domain-specific operation.

System errors should be logged server-side and returned to the UI with safe, generic messages.

## Backend Target Shape

Use one response envelope for app/system API failures.

```ts
type ApiErrorDomain = "app" | "system";

type ApiErrorType =
  | "validation_failed"
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "dependency_unavailable"
  | "configuration_missing"
  | "unexpected";

type ApiErrorResponse = {
  error: {
    domain: ApiErrorDomain;
    type: ApiErrorType;
    message: string;
    fieldErrors?: Record<string, string>;
    nativeMessage?: string;
    nativeCode?: string;
    requestId?: string;
    context?: Record<string, unknown>;
  };
};
```

Examples:

```json
{
  "error": {
    "domain": "app",
    "type": "validation_failed",
    "message": "Name is required",
    "fieldErrors": {
      "name": "Name is required"
    }
  }
}
```

```json
{
  "error": {
    "domain": "app",
    "type": "forbidden",
    "message": "Admin role is required"
  }
}
```

```json
{
  "error": {
    "domain": "system",
    "type": "unexpected",
    "message": "Something went wrong. Check backend logs."
  }
}
```

## Backend Helpers

Add helpers so routes do not hand-roll responses.

```ts
badRequest(res, message, context?)
validationFailed(res, message, fieldErrors)
unauthorized(res, message?)
forbidden(res, message?)
notFound(res, message)
conflict(res, message, context?)
rateLimited(res, message?)
dependencyUnavailable(res, message, nativeError?)
unexpected(res, nativeError)
```

Implementation notes:

- Do not expose stack traces in responses.
- Include `nativeMessage` only when it is useful and safe.
- Avoid including secrets, tokens, paths with sensitive user data, or full upstream payloads by default.
- Add request IDs later for log correlation.

## Frontend Target Shape

Update `frontend/src/lib/api.ts` to preserve structured details.

```ts
type ApiErrorDetails = {
  domain: "app" | "system" | "unknown";
  type: string;
  message: string;
  fieldErrors?: Record<string, string>;
  nativeMessage?: string;
  nativeCode?: string;
  requestId?: string;
  context?: Record<string, unknown>;
  raw: unknown;
};

type ApiError = Error & {
  status?: number;
  errorCode?: string;
  details?: ApiErrorDetails;
};
```

Legacy fallback:

```ts
{ "error": "name is required" }
```

normalizes to:

```ts
{
  domain: "unknown",
  type: "unknown",
  message: "name is required",
  raw: { error: "name is required" }
}
```

## Frontend Presentation Rules

- `validation_failed`: show inline field errors where possible; otherwise show a form-level error.
- `unauthorized`: invoke existing session/login handling unless it is a public auth/setup route.
- `forbidden`: show a permission-focused toast or inline message.
- `not_found`: show a not-found or empty state where appropriate.
- `conflict`: show an actionable toast/modal explaining what must change.
- `rate_limited`: show retry guidance.
- `system` / `unexpected`: show a safe generic message and optionally a details modal with request ID/native details if available.

Use `ErrorDetailsModal` for detailed views; raw JSON should be secondary, not the primary presentation.

## Migration Strategy

1. Add backend error response helpers.
2. Update frontend API parser to support both structured and legacy errors.
3. Convert high-impact route groups first:
   - Auth/setup.
   - Data Sources / Devices.
   - Automation workflows and workflow runs.
   - Integritas actions.
4. Add shared frontend helpers for toast titles/messages by error type.
5. Add inline field-error support to forms that currently only show one string.
6. Convert remaining routes opportunistically.
7. Add request IDs/log correlation after the envelope is stable.

## Acceptance Criteria

- Existing legacy error responses still render correctly.
- New structured errors preserve `status`, `type`, `message`, and optional `fieldErrors` in frontend `ApiError`.
- Form validation errors can be shown inline without parsing strings.
- Auth/session errors still trigger login handling correctly.
- App/API errors do not create or overwrite data-source/workflow operational history.
- System errors return safe UI messages and do not leak stack traces.
