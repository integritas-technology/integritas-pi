# Structured Error Handling Plan

Status: Implemented. Existing text-error columns are still used for storage; new writers serialize structured errors as JSON and serializers normalize both legacy strings and structured errors.

This plan defines how backend and frontend should separate data-source errors from workflow/block errors, while still preserving native upstream error details for debugging.

## Problem

Workflow failures can currently appear as data-source failures. Example:

```txt
GPIO Input data source
  Last preview: Read failed
  Error: Camera command failed to start (rpicam-still): spawn rpicam-still ENOENT
```

In that case GPIO succeeded: it produced a valid trigger event. The later `Capture camera` block failed because a camera command was unavailable. Showing the camera failure on the GPIO data-source row is misleading.

## Goal

- Attribute errors to the component that failed.
- Keep data-source rows focused on source health, latest source payload, and source-level failures.
- Keep workflow/block failures in workflow run logs and block details.
- Present friendly typed errors in the UI, with native/raw details available for operators.
- Preserve old string errors during migration by normalizing them in the frontend or serializer.

## Ownership Rule

The component that fails owns the error.

```txt
HTTP source fetch fails -> Data source error
MQTT broker connection fails -> Data source error
Webhook payload is invalid JSON -> Data source error
GPIO watcher cannot start -> Data source error
GPIO event triggers workflow successfully -> Data source success
Camera capture block fails -> Workflow block error
Integritas stamp fails -> Workflow/block or Integritas error
HTTP/MQTT output target fails -> Workflow block error
```

Downstream workflow/block failures must not overwrite `data_sources.last_error` for the trigger/source that started the workflow.

## Backend Model

Introduce structured errors with a small common envelope.

```ts
type ErrorDomain = "data_source" | "workflow" | "block" | "integritas" | "system";

type StructuredError = {
  domain: ErrorDomain;
  type: string;
  message: string;
  nativeMessage?: string;
  nativeCode?: string;
  context?: Record<string, unknown>;
  occurredAt?: string;
};
```

Start with focused type unions, but store/serialize as strings so the model can grow.

```ts
type DataSourceErrorType =
  | "source_unavailable"
  | "source_timeout"
  | "invalid_payload"
  | "connection_failed"
  | "permission_denied"
  | "hardware_unavailable"
  | "configuration_invalid";

type WorkflowErrorType =
  | "block_failed"
  | "command_unavailable"
  | "command_failed"
  | "condition_failed"
  | "action_failed"
  | "stamp_failed"
  | "timeout";
```

### Storage

Short-term minimal path:

- Keep existing `last_error` / `error` text columns.
- Store structured errors as JSON strings when new code writes them.
- Serializers normalize both legacy string errors and JSON structured errors into a consistent response shape.

Later cleanup:

- Add explicit `error_json` columns for `data_sources`, `data_source_reads`, `workflow_runs`, and `workflow_run_blocks`.
- Keep legacy text columns only for search/summary if useful.

### Backend Helpers

Add helpers to avoid ad hoc strings:

```ts
function dataSourceError(input: {
  type: DataSourceErrorType;
  message: string;
  nativeMessage?: string;
  nativeCode?: string;
  context?: Record<string, unknown>;
}): StructuredError;

function workflowError(input: {
  type: WorkflowErrorType;
  message: string;
  nativeMessage?: string;
  nativeCode?: string;
  context?: Record<string, unknown>;
}): StructuredError;
```

### Backend Changes

- Audit all calls that update `data_sources.last_error`.
- Keep source-level writes only for actual source failures:
  - HTTP read/health failures.
  - MQTT connect/subscribe/payload failures.
  - GPIO watcher/device/config failures.
  - Webhook invalid payload failures.
- Ensure workflow executor/block failures write to workflow run/block error fields only.
- For trigger starts such as GPIO/webhook/MQTT, write the successful trigger payload to source/read state before executing downstream blocks.
- If a later block fails, do not mutate the trigger source error.
- Normalize API responses so UI receives either `error: StructuredError | null` or a parallel `errorDetails` field.

## Frontend Model

Frontend should not show errors through generic JSON preview by default.

Add a normalizer:

```ts
type UiError = {
  domain: string;
  type: string;
  title: string;
  message: string;
  nativeMessage?: string;
  nativeCode?: string;
  context?: Record<string, unknown>;
  raw: unknown;
};
```

Legacy string fallback:

```ts
normalizeError("Camera command failed...")
// -> {
//   domain: "unknown",
//   type: "unknown",
//   title: "Error",
//   message: "Camera command failed...",
//   raw: "Camera command failed..."
// }
```

## Frontend Presentation

### Data Sources Page

Data-source rows should show source-level state only.

For successful GPIO trigger:

```txt
Last preview
GPIO17 falling edge, active low
[View payload]
```

For GPIO source failure:

```txt
GPIO unavailable
/dev/gpiochip0 is not mounted in the backend container.
[View details]
```

Do not show workflow block failures, such as camera capture errors, on the triggering GPIO data-source row.

### Workflow Logs

Workflow run summaries should show:

```txt
Workflow failed
Failed block: Capture camera
Error: Command unavailable
Message: Camera command is not available
```

Block detail should show:

```txt
Block
Capture camera

Error type
command_unavailable

Message
Camera command is not available

Native details
spawn rpicam-still ENOENT

Context
command: rpicam-still
```

### Error Details Modal

Add `ErrorDetailsModal` for structured errors.

Default layout:

```txt
Error Details

Type
Command unavailable

Message
Camera command is not available

Native Details
spawn rpicam-still ENOENT

Context
Workflow: Camera
Block: Capture camera
Time: 2026-07-22T07:39:42.565Z

Raw
{ ...full structured error... }
```

Raw JSON remains available, but it is secondary.

## Migration Strategy

1. Add structured error types/helpers and response normalizers.
2. Update source-level writers to use data-source error helpers.
3. Update workflow/block executor to use workflow/block error helpers.
4. Stop propagating downstream block failures into `data_sources.last_error`.
5. Add frontend `ErrorDetailsModal` and `normalizeError`.
6. Replace source/workflow error JSON-preview calls with structured error details.
7. Optionally add `error_json` columns once the response shape is stable.

## Acceptance Criteria

- Triggering a GPIO workflow whose camera block fails leaves the GPIO source showing the GPIO event, not the camera failure.
- Workflow run logs show the failed camera block with `command_unavailable` and native `spawn rpicam-still ENOENT` details.
- Data-source setup/runtime failures still appear on the relevant data-source row.
- Legacy string errors still render without crashing or losing information.
- Raw error JSON remains available for debugging.
