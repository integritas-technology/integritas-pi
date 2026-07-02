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

### Future GPIO Output Blocks

```txt
gpio_set_output
gpio_pulse_output
gpio_blink_output
buzzer_beep
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

## GPIO Output Future

GPIO outputs should be action blocks with narrow behavior and strict validation.

First supported output block:

```txt
gpio_pulse_output
```

Example config:

```json
{
  "pin": 18,
  "activeState": "high",
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
- [ ] Add backend block config validation.
- [x] Extend data reads with trigger metadata.

### Milestone 2: Core Executor

- [x] Implement `executeWorkflow(workflowId, triggerContext)`.
- [x] Implement block executor registry.
- [x] Implement workflow/block status updates.
- [ ] Implement clear errors for invalid block chains.

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
- [x] Add configure-block modal.
- [x] Add move up/down ordering.
- [x] Add frontend validation hints.

### Milestone 6: Wait And Run History

- [ ] Implement `wait` block.
- [ ] Add automation run history tables.
- [ ] Add block-level run history.
- [ ] Add UI run/debug view.

### Milestone 7: Safe GPIO Outputs

- [ ] Define GPIO output target/source shape.
- [ ] Implement safe output validation.
- [ ] Implement `gpio_pulse_output`.
- [ ] Document output hardware safety in `SECURITY.md` and `README.md`.
- [ ] Verify button-triggered LED pulse on Pi hardware.

## Progress Log

### 2026-06-30

- Created this plan after successful GPIO17 button input testing on Raspberry Pi hardware.
- Confirmed the desired product direction: keep GPIO-as-data workflows and add GPIO-as-trigger workflows.
- Agreed that the long-term automation UX should use small composable blocks rather than large When / Condition / Then rules.
- Implemented the first backend block foundation: destructive legacy automation reset, `automation_blocks`, trigger metadata on reads, block executor, schedule/manual fetch, event recording, Integritas stamping, and compatibility endpoints for the existing UI.
- Added the first frontend block-list workspace: workflows now show actual blocks, support appending fetch/wait/stamp blocks, and avoid showing internal start blocks as duplicate collect rules.
- Added block editing and ordering controls: fetch blocks can change target source, wait blocks can change duration, action blocks can be enabled/disabled, and blocks can move up/down while preserving the required start block at the top.
- Replaced the data-source-first create workflow modal with a block-first creator: operators choose a manual, schedule, GPIO, webhook, or MQTT start block and optionally add an initial record/fetch action before opening the workspace.
