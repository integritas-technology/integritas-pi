# Block Automation Workflows Plan

This plan tracks the automation-system pivot from coarse When / Condition / Then rules to small composable workflow blocks. The goal is a Scratch-like builder where operators assemble code-backed logic pieces without writing code.

Existing automation/database data is disposable for this pivot. We do not need backward-compatible migrations for saved workflows, data sources, or data-read history while this plan is implemented.

## Goal

Build workflows from ordered blocks:

```txt
[GPIO button pressed]
  -> [Record GPIO event]

[GPIO button pressed]
  -> [Fetch HTTP data source]
  -> [Stamp with Integritas]

[Schedule every 60 seconds]
  -> [Fetch HTTP data source]
  -> [Wait 2 seconds]
  -> [Fetch another source]
  -> [Stamp with Integritas]
```

Later workflows should support safe GPIO output blocks:

```txt
[GPIO button pressed]
  -> [Fetch HTTP data source]
  -> [Blink LED]
  -> [Beep buzzer]
```

## Current State

- Data sources define HTTP JSON APIs, webhooks, MQTT subscriptions, and GPIO input sources.
- Automation workflows are currently tied to one `data_source_id`.
- Rules are represented as `when_json`, `condition_json`, and `then_json`.
- GPIO input workflows currently record GPIO events themselves.
- Scheduled HTTP workflows currently fetch one source at an interval.
- Optional Integritas stamping is represented as a separate rule plus workflow-level `stamp_with_integritas` state.

This works for simple pipelines but makes it hard to express workflows such as:

```txt
When GPIO17 is pressed, fetch a separate HTTP data source.
```

## Target Model

Workflows become ordered block pipelines.

```txt
Workflow
  Block 1: start block
  Block 2: action block
  Block 3: action block
  Block 4: action block
```

Each block has a type, configuration, input/output behavior, and execution status.

```ts
type AutomationBlock = {
  id: string;
  workflowId: string;
  orderIndex: number;
  type: string;
  config: unknown;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
};
```

The backend executes blocks in order and passes a workflow context between them.

```ts
type WorkflowContext = {
  trigger?: {
    type: "schedule" | "manual" | "gpio" | "webhook" | "mqtt";
    sourceId?: string;
    payload?: unknown;
  };
  data?: {
    sourceId?: string;
    sourceName?: string;
    preview?: unknown;
    hash?: string;
    canonicalBytes?: string;
  };
  hash?: string;
  proofId?: string | null;
  events: unknown[];
};
```

## User Journeys

### Record GPIO Event

```txt
User adds GPIO data source: Red Button / GPIO17 / Pull-up / Falling / Active low
User creates workflow:
  [GPIO event: Red Button pressed]
  -> [Record trigger event]
  -> [Stamp with Integritas] optional
```

This preserves the current GPIO-as-data behavior.

### GPIO Triggers HTTP Fetch

```txt
User adds GPIO data source: Red Button
User adds HTTP JSON data source: Weather API
User creates workflow:
  [GPIO event: Red Button pressed]
  -> [Fetch data source: Weather API]
  -> [Stamp with Integritas] optional
```

This adds GPIO-as-trigger behavior without replacing GPIO-as-data.

### Scheduled HTTP Fetch

```txt
User adds HTTP JSON data source: Weather API
User creates workflow:
  [Schedule: every 60 seconds]
  -> [Fetch data source: Weather API]
  -> [Stamp with Integritas] optional
```

This preserves the current scheduled HTTP behavior.

### Future GPIO Output

```txt
User adds GPIO input source: Red Button
User adds GPIO output target: Green LED / GPIO18
User creates workflow:
  [GPIO event: Red Button pressed]
  -> [Pulse GPIO output: Green LED for 500 ms]
```

GPIO output should be introduced as safe, narrow action blocks, not as arbitrary shell execution or generic pin control.

## Database Shape

Because existing automation data is disposable, replace the current automation schema instead of preserving it.

```txt
automation_workflows
  id TEXT PRIMARY KEY
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  name TEXT NOT NULL
  enabled INTEGER NOT NULL
  last_run_at TEXT
  last_error TEXT
```

```txt
automation_blocks
  id TEXT PRIMARY KEY
  workflow_id TEXT NOT NULL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  order_index INTEGER NOT NULL
  type TEXT NOT NULL
  enabled INTEGER NOT NULL
  config_json TEXT NOT NULL
  last_run_at TEXT
  last_error TEXT
  FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
```

Keep `data_sources`, `data_source_reads`, and `integritas_proofs`, but extend reads with trigger metadata:

```txt
data_source_reads
  trigger_source_id TEXT
  trigger_payload_json TEXT
  block_id TEXT
```

This allows the UI to explain causality:

```txt
Weather API was fetched because Red Button was pressed.
```

Add workflow execution history after the core block executor works:

```txt
automation_runs
  id TEXT PRIMARY KEY
  workflow_id TEXT NOT NULL
  started_at TEXT NOT NULL
  finished_at TEXT
  status TEXT NOT NULL
  trigger_type TEXT
  trigger_source_id TEXT
  error TEXT
```

```txt
automation_block_runs
  id TEXT PRIMARY KEY
  run_id TEXT NOT NULL
  block_id TEXT NOT NULL
  order_index INTEGER NOT NULL
  status TEXT NOT NULL
  started_at TEXT NOT NULL
  finished_at TEXT
  input_json TEXT
  output_json TEXT
  error TEXT
```

## Block Types

### Start Blocks

```txt
manual_start
schedule_start
gpio_event_start
webhook_event_start
mqtt_event_start
```

### Data Blocks

```txt
record_trigger_event
fetch_data_source
hash_json
```

### Logic Blocks

```txt
wait
condition
stop
```

### Integritas Blocks

```txt
stamp_integritas
```

### Output Control Blocks

```txt
control_output
send_transaction
```

## Workflow Execution

Create a central executor:

```txt
executeWorkflow(workflowId, triggerContext)
```

Execution steps:

```txt
1. Load enabled workflow.
2. Load enabled blocks ordered by order_index.
3. Validate the first block matches the trigger.
4. Run each block executor in order.
5. Pass context between blocks.
6. Stop if a block fails or returns stop.
7. Update workflow/block status.
8. Record reads/proofs where relevant.
```

Use a registry of small executors instead of a large automation function:

```ts
const blockExecutors = {
  manual_start,
  schedule_start,
  gpio_event_start,
  record_trigger_event,
  fetch_data_source,
  wait,
  stamp_integritas,
};
```

## GPIO Input Flow

GPIO watchers should emit trigger events, not decide the workflow action themselves.

```txt
GPIO watcher receives edge event
  -> build trigger context
  -> find enabled workflows whose first block is gpio_event_start for this source
  -> execute matching workflows
```

Example trigger context:

```json
{
  "trigger": {
    "type": "gpio",
    "sourceId": "red-button-id",
    "payload": {
      "source": "gpio",
      "pin": 17,
      "edge": "falling",
      "state": "low",
      "active": true
    }
  },
  "events": []
}
```

Then the workflow determines whether to record the GPIO event, fetch another data source, stamp, wait, or later trigger output.

## Scheduler Flow

The scheduler should find due `schedule_start` blocks rather than reading `polling_interval_seconds` from workflows.

```json
{
  "type": "schedule_start",
  "config": {
    "intervalSeconds": 60,
    "nextRunAt": "2026-06-30T12:00:00.000Z"
  }
}
```

When due:

```txt
schedule_start due
  -> execute workflow with trigger type schedule
```

## Webhook And MQTT Flow

Webhook and MQTT ingestion should follow the same event-trigger pattern as GPIO.

```txt
Webhook payload arrives
  -> find workflows whose first block is webhook_event_start for this source
  -> execute matching workflows
```

```txt
MQTT message arrives
  -> find workflows whose first block is mqtt_event_start for this source
  -> execute matching workflows
```

## Backend API

Replace workflow/rule endpoints with block-based endpoints:

```http
GET    /api/automation/workflows
POST   /api/automation/workflows
GET    /api/automation/workflows/:id
PATCH  /api/automation/workflows/:id
DELETE /api/automation/workflows/:id

POST   /api/automation/workflows/:id/blocks
PATCH  /api/automation/workflows/:id/blocks/:blockId
DELETE /api/automation/workflows/:id/blocks/:blockId
POST   /api/automation/workflows/:id/blocks/reorder

POST   /api/automation/workflows/:id/run
```

Example block payloads:

```json
{
  "type": "gpio_event_start",
  "config": {
    "sourceId": "red-button-id",
    "activeOnly": true
  }
}
```

```json
{
  "type": "fetch_data_source",
  "config": {
    "sourceId": "weather-api-id"
  }
}
```

```json
{
  "type": "wait",
  "config": {
    "durationMs": 2000
  }
}
```

## Frontend UX

Start with a simple block-list builder before adding drag and drop.

```txt
Workflow card
  Block list
    1. GPIO button pressed
    2. Fetch Weather API
    3. Stamp with Integritas

  Add block
  Move up / move down
  Configure block
  Delete block
```

Block picker categories:

```txt
Start
  Manual run
  Schedule
  GPIO input event
  Webhook received
  MQTT message received

Data
  Record trigger event
  Fetch data source

Logic
  Wait

Integritas
  Stamp latest hash
```

Validation rules:

```txt
First block must be a start block.
Only one start block per workflow.
Stamp block requires a previous block that creates a hash.
Fetch block requires an HTTP/internal JSON data source.
Record trigger event requires an event trigger.
GPIO output blocks require explicit output config and hardware safety validation.
```

## Remaining Major Improvements

The block workspace is usable for the current prototype: workflows can be created from start/data/logic/output blocks, manually tested, conditionally stamped, and inspected through run logs. The remaining work is mostly about making the builder easier to use safely as workflows grow.

Recommended development order:

1. Complete basic create-workflow block library.
2. Workflow templates.
3. Run log filtering and deeper run links.
4. Better workflow organization.
5. Configure-block modal refinement.
6. Full draft workspace save model.
7. Branching / else flow.

### 1. Complete Basic Create-Workflow Block Library

The create workflow workspace should prioritize clear building blocks before templates. Templates are useful as guides later, but the V1 base should first make it obvious that a valid workflow starts with exactly one start block and then appends data, logic, and action blocks.

Current implementation:

- Create workflow is now a full-page Scratch-inspired draft workspace instead of a modal.
- The block library is split into Start, Data, Logic, Action, and Attached actions sections.
- The draft canvas starts empty and prompts the operator to choose one start block first.
- Start blocks hide after selection; Reset canvas clears the draft and shows start blocks again.
- The selected start block inspector configures source/interval only and does not change start type.
- Data and Logic blocks append after the start block.
- Action blocks currently include Pulse output and Send transaction.
- Integritas stamping attaches as a side block on Record/Fetch data blocks and is created with `parentBlockId` mapping from draft IDs.
- Draft validation calls `POST /api/automation/workflows/validate-draft`, which reuses the backend block-graph validator used by created workflows.
- The canvas presentation layer is now extracted into reusable automation components (`WorkflowCanvas.tsx`) so create, edit, and future watch modes can share the same visual blocks.
- Existing workflows now use the same full-page canvas layout: add-block library on the left, saved workflow canvas in the center, and selected-block editor on the right.
- The current per-block save model remains in the edit inspector while add/remove/move actions apply immediately.
- Workflow workspace entry points are URL-driven: `/automation?flow=build`, `/automation?flow=edit&id=<workflowId>`, and `/automation?flow=watch&id=<workflowId>`.
- Opening an existing workflow no longer uses a modal; the shared canvas is loaded directly inside the Automation page.
- Edit mode keeps validation in the right inspector above selected-block configuration, matching the create workspace placement.
- Workflow-level lifecycle actions stay in the workflow list. Run controls, test payload execution, and recent runs live in Watch mode.
- Edit mode now uses the same outer builder shell, categorized block library, and selected-block inspector pattern as create mode, with persisted block changes still applied through explicit per-block saves.
- Workflow names are editable from the edit workspace setup panel.
- Watch mode now replaces edit controls with run/test controls, selected-block runtime details, latest output/error/timing, read/proof Diagnostics links, and recent run history.
- Build, Edit, and Watch now use a shared workflow workspace shell and one normalized canvas renderer for draft and persisted blocks.
- The center canvas previews the generated block chain before creation.
- The right inspector configures workflow name and selected-block settings.
- The draft canvas owns an editable draft block list and supports add/remove/move controls for supported draft blocks.

Remaining basic block-library work:

- Add clearer draft validation on affected blocks.
- Add Watch mode on the shared canvas, including a test-run payload editor, live block status, outputs, and read/proof links.

### 2. Workflow Templates

Add beginner-friendly templates that create known-good starter workflows.

Templates are intentionally deferred until the basic block library is complete, so they can act as user guides rather than hiding the underlying block model.

Good first templates:

```txt
GPIO button -> Record trigger event
GPIO button -> Fetch HTTP JSON -> Conditional Integritas stamp
GPIO button -> Pulse LED
Webhook -> Record trigger event -> Conditional Integritas stamp
Schedule -> Fetch HTTP JSON -> Integritas stamp
```

Why this should come next:

- Helps operators build correct workflows without understanding every block immediately.
- Gives consistent demo paths for GPIO input, HTTP data, LED output, and Integritas stamping.
- Exercises the existing block executor without requiring a large state-management refactor.

Implementation notes:

- Templates should still create normal blocks through the existing backend API.
- Avoid hidden production mock data. Use operator-selected devices/sources where possible.
- Validate required devices before enabling a template, for example HTTP source required for fetch templates and GPIO Output target required for LED templates.

Template expansion should happen after draft support exists for all V1 block types.

### 2. Pre-Run Validation

Before `Run now` or `Run with payload`, surface likely failures without requiring the operator to inspect a failed run log.

Validation examples:

```txt
Fetch block references a missing or incompatible source.
Record trigger event is used without an event start source.
Control output references a missing/non-output device.
Integritas stamp is enabled but no API key is configured.
Condition source is data but no prior block records or fetches data.
Workflow has no enabled action blocks after the start block.
```

Current implementation:

- `GET /api/automation/workflows/:id/validation` returns structured errors and warnings.
- The Automation workspace shows validation status near the run buttons.
- `Run now` and `Run with payload` are disabled in the UI and rejected by the backend when validation errors exist.
- Warnings remain visible for operator review and do not block runs.

Follow-up validation improvements:

- Add template-aware validation hints when workflow templates are introduced.
- Add deeper scheduled/event trigger risk checks if output and transaction blocks become more configurable.

### 3. Run Log Filtering And Deep Links

Workflow run details now separate trigger payloads from fetched/recorded data previews. The next log improvement is navigation and filtering.

Current implementation:

- Block runs with a data read id link to Diagnostics read history filtered to that read.
- Block runs with an Integritas proof id link to Diagnostics proof history filtered to that proof.
- Diagnostics read/proof search includes internal row ids so deep links can resolve the exact row.

Useful additions:

```txt
Filter workflow logs by workflow, status, trigger type, proof id, read id.
Support direct URLs to a specific workflow run.
```

This makes debugging conditional stamping much easier on the Pi after hardware tests.

### 4. Better Workflow Organization

As test workflows accumulate, the workspace needs organization beyond enabled/paused.

Current implementation:

```txt
Archive workflow.
Restore workflow.
Search workflows.
Show Active / All / Enabled / Paused / Error / Archived filters.
Duplicate workflow.
Archived workflows do not run automatically or manually until restored.
```

Possible follow-ups:

```txt
Rename workflow from the workspace.
Require confirmation for destructive deletes.
Add tag/group folders if workflow counts grow beyond simple filters.
```

### 5. Configure-Block Modal Refinement

The current inline block editors are acceptable for the prototype, especially after per-block save feedback was added. A focused configure modal can still improve beginner usability.

Desired behavior:

```txt
Click Configure on a block.
Open one modal with that block's settings.
Show validation and examples in the modal.
Save only that block.
Return to the workflow list with a clear saved/unsaved result.
```

This is smaller than the full draft workspace model and can reuse the current per-block save semantics.

### 6. Full Draft Workspace Save Model

The current model is per-block save plus immediate add/remove/move/enable actions. A full draft model would make the workspace feel more like a document editor.

Target behavior:

```txt
Open workflow workspace.
Make multiple block edits locally.
Add/remove/reorder blocks locally.
Click one top-level Save changes.
Warn before closing if unsaved changes exist.
Discard changes without touching the backend.
```

This is the largest remaining UX refactor because it requires temporary client-side block IDs, local reorder/delete state, and a batch-save API or careful ordered mutation sequence. It is valuable, but not required before more hardware and template testing.

### 7. Branching / Else Flow

Current condition blocks either continue or stop the remaining workflow. That is enough for simple proofs and hardware demos, but not enough for richer automation.

Future options:

```txt
If condition matches -> run nested branch.
Else -> run alternate branch.
Switch/match block for multiple values.
Stop block with custom reason.
```

Defer this until templates, validation, and logs are solid. Branching changes the execution model and UI substantially.

## GPIO Output Targets

GPIO outputs should be configured as reusable output targets. Workflows control them through a generic, narrow `control_output` action block with profile-specific validation.

First supported output target profile:

```txt
LED
```

Example output target config:

```json
{
  "type": "gpio-output",
  "profile": "led",
  "pin": 18,
  "activeState": "high",
  "initialState": "inactive"
}
```

Example control block config:

```json
{
  "type": "control_output",
  "targetId": "green-led-output-id",
  "action": "pulse",
  "durationMs": 500
}
```

Output controls:

```txt
Admin-only.
No arbitrary shell execution.
Validated BCM pin 0-27.
Block output pins already used as active inputs.
Prefer pulse/blink over permanent HIGH for the first release.
Document 3.3V-only GPIO, current limits, LED resistors, and external-driver needs.
```

## Testing Plan

Backend tests:

```txt
Block config validation.
Workflow execution order.
GPIO trigger -> record event.
GPIO trigger -> fetch HTTP source.
Schedule trigger -> fetch HTTP source.
Wait block delay behavior with mocked timers where possible.
Stamp block uses latest hash.
Invalid block chains fail clearly.
Deleted data source disables/fails dependent workflows cleanly.
```

Manual Pi tests:

```txt
Button -> record event.
Button -> fetch HTTP API.
Button -> fetch HTTP API -> stamp.
Two buttons active at once.
Button debounce.
Pause workflow releases GPIO watcher.
Delete GPIO source stops watcher without crash.
```

Future output tests:

```txt
Button -> blink LED.
Button -> wait -> blink LED.
Button -> fetch API -> blink LED.
```

## Implementation Milestones

### Milestone 1: Schema And Types

- [x] Replace automation schema with `automation_workflows` and `automation_blocks`.
- [x] Drop legacy automation/data-read tables in dev/prototype migrations where needed.
- [x] Add block config TypeScript types.
- [x] Add backend block config validation.
- [x] Extend data reads with trigger metadata.

### Milestone 2: Core Executor

- [x] Implement `executeWorkflow(workflowId, triggerContext)`.
- [x] Implement block executor registry.
- [x] Implement workflow/block status updates.
- [x] Implement clear errors for invalid block chains.

### Milestone 3: Preserve Existing Use Cases

- [x] Implement `manual_start`.
- [x] Implement `schedule_start`.
- [x] Implement `fetch_data_source`.
- [x] Implement `stamp_integritas`.
- [x] Rework scheduler around `schedule_start` blocks.
- [ ] Verify `Schedule -> Fetch HTTP -> Stamp`.

### Milestone 4: GPIO As Trigger And Data

- [x] Implement `gpio_event_start`.
- [x] Implement `record_trigger_event`.
- [x] Route GPIO watcher events into the workflow executor.
- [ ] Verify `GPIO -> Record Event`.
- [ ] Verify `GPIO -> Fetch HTTP -> Stamp`.

### Milestone 5: Block-Based API And UI

- [x] Replace rule API with block API.
- [x] Build simple block-list workflow UI.
- [x] Add block picker categories.
- [ ] Add configure-block modal/refinement.
- [x] Add move up/down ordering.
- [x] Add frontend validation hints.
- [x] Add per-block saved/unsaved feedback.
- [ ] Add workflow templates.
- [x] Add pre-run workflow validation warnings.
- [ ] Add full draft workspace save model.

### Milestone 6: Wait And Run History

- [x] Implement `wait` block.
- [x] Add automation run history tables.
- [x] Add block-level run history.
- [x] Add UI run/debug view.

### Milestone 7: Safe GPIO Outputs

- [x] Define GPIO output target/source shape.
- [x] Implement safe output validation.
- [x] Implement `control_output` pulse action for LED GPIO output targets.
- [x] Document output hardware safety in `SECURITY.md` and `README.md`.
- [ ] Verify button-triggered LED pulse on Pi hardware.

### Milestone 8: Workflow Usability And Debugging

- [ ] Add template-driven workflow creation for common GPIO, HTTP, webhook, schedule, output, and Integritas flows.
- [x] Add validation warnings before manual runs.
- [x] Add direct links to related read/proof details.
- [ ] Add run-log filters.
- [x] Add workflow archive/filter/duplicate organization tools.
- [x] Add first-pass full-page workflow creation workspace with clean Start/Data/Logic block library.
- [ ] Evaluate branching/else blocks after the simpler linear workflow UX is stable.

## Progress Log

### 2026-06-30

- Created this plan after successful GPIO17 button input testing on Raspberry Pi hardware.
- Confirmed the desired product direction: keep GPIO-as-data workflows and add GPIO-as-trigger workflows.
- Agreed that the long-term automation UX should use small composable blocks rather than large When / Condition / Then rules.
- Implemented the first backend block foundation: destructive legacy automation reset, `automation_blocks`, trigger metadata on reads, block executor, schedule/manual fetch, event recording, Integritas stamping, and compatibility endpoints for the existing UI.
- Added the first frontend block-list workspace: workflows now show actual blocks, support appending fetch/wait/stamp blocks, and avoid showing internal start blocks as duplicate collect rules.
- Added block editing and ordering controls: fetch blocks can change target source, wait blocks can change duration, action blocks can be enabled/disabled, and blocks can move up/down while preserving the required start block at the top.
- Replaced the data-source-first create workflow modal with a block-first creator: operators choose a manual, schedule, GPIO, webhook, or MQTT start block and optionally add an initial record/fetch action before opening the workspace.
- Added workflow run history: each execution records a run row and per-block rows with status, timing, errors, and context summaries. Recent runs are visible in the workflow workspace and globally under Diagnostics -> Workflow logs.
- Added the first safe GPIO output path: GPIO Output targets with LED profile, reusable `control_output` pulse blocks, backend pin conflict checks, and hardware safety documentation.
- Added near-term planning for the remaining block workspace improvements: workflow templates first, then pre-run validation, run-log navigation, workflow organization, configure-block modal refinement, full draft saves, and later branching/else flow.
