# Workflow Variables And Output Templating Plan

**Status:** V1 implemented  
**Created:** 2026-07-16  
**Goal:** Let workflows prepare per-run values and reuse them in later condition and output blocks.

## Summary

Workflows need a generic way to prepare values before sending commands, notifications, or messages. The first concrete use case is sending a Discord-compatible HTTP webhook body, but the feature must stay generic and work for any output target that accepts structured data.

Add per-run workflow variables plus a `Set variable` block. Later blocks can reference those variables in condition checks and through simple `{{variableName}}` interpolation inside custom output JSON.

Variables are not global settings and are not persisted across runs. They exist only while one workflow run executes.

## Current State

- Automation workflows pass a runtime context between blocks.
- Context currently tracks trigger payload, collected data, hash/proof references, latest output, and stop state.
- HTTP/API and MQTT output targets keep endpoint/transport settings on the device.
- Control device blocks choose what payload to send with body modes:
  - custom JSON
  - workflow context
  - trigger payload
  - latest data
  - no body for HTTP only
- Custom JSON can insert prepared workflow variables with `{{variableName}}` placeholders.
- The main `If field matches` condition block can read either a trigger field or a previously set workflow variable.

## Target Model

Add a `variables` object to the per-run workflow context:

```ts
type WorkflowContext = {
  trigger: WorkflowTrigger;
  data?: WorkflowData;
  output?: unknown;
  hash?: string;
  proofId?: string | null;
  stopped?: boolean;
  variables: Record<string, unknown>;
};
```

Add a workflow block:

```txt
Set variable
Save a value for later blocks.
```

Example workflow:

```txt
[GPIO button pressed]
  -> [Fetch HTTP JSON]
  -> [Set variable: temperature = latest data temperature]
  -> [If variable temperature is greater than 20]
  -> [Set variable: discordMessage = "Temperature alert"]
  -> [Control device: HTTP output with custom JSON]
```

Output custom JSON:

```json
{
  "content": "{{discordMessage}}"
}
```

## User Experience

### Block Library

Place the `Add variable` card under Data blocks, not Action blocks. The block itself is named `Set variable` on the canvas and in the inspector.

```txt
Data blocks

Add variable
Save a value for later blocks.
```

### Set Variable Inspector

Fields:

```txt
Variable name
discordMessage

Value source
[Custom JSON]
[Trigger field]
[Latest data field]
[Workflow context field]

Custom JSON / Field path
...
```

Variable names should be simple and template-safe:

```txt
^[A-Za-z_][A-Za-z0-9_]*$
```

Examples:

```txt
discordMessage
temperature
buttonPin
measurement
```

## Value Sources

### Custom JSON

The user enters a literal JSON value.

Examples:

```json
"Button pressed on Integritas Pi"
```

```json
{
  "content": "Button pressed"
}
```

### Trigger Field

Read a field path from `context.trigger.payload`.

Example:

```txt
pin
```

### Latest Data Field

Read a field path from `context.data.result.preview`.

Requires a prior `Record trigger event` or `Fetch data source` block in the same run.

Example:

```txt
temperature
```

### Workflow Context Field

Read a field path from the workflow context summary.

Examples:

```txt
hash
data.sourceName
trigger.type
```

## Condition Blocks

The main `If field matches` block can read from either the workflow trigger or a workflow variable.

```txt
Condition source
[Trigger event]
[Variable]
```

Trigger conditions use a field path from `context.trigger.payload`:

```txt
Condition source: Trigger event
Field path: temperatureC
Operator: is greater than
Compare value: 20
```

Variable conditions use a variable name from `context.variables`:

```txt
Condition source: Variable
Variable name: temperature
Operator: is greater than
Compare value: 20
```

Variable conditions require an enabled earlier `Set variable` block that defines the variable. The main condition block does not read `Latest data` directly. To condition on data from a recorded or fetched source, set a variable first, then condition on that variable.

Attached `Stamp data` conditions are separate: they still read the parent record/fetch/capture block's data because they are scoped to that attached data block.

## Interpolation Rules

V1 interpolation is intentionally small:

- Only `{{variableName}}` references are supported.
- No JavaScript expressions.
- No conditionals.
- No filters/helpers.
- No nested paths in template placeholders.
- Unknown variables in output templates fail the output block clearly before sending output.

When interpolating inside a string:

```json
{
  "content": "Temperature is {{temperature}} C"
}
```

Convert primitive values to strings.

When the entire string is exactly one variable reference:

```json
{
  "measurement": "{{measurement}}"
}
```

Preserve object/array/number/boolean/null type instead of stringifying it.

## V1 Implementation Plan

Status: Implemented.

1. Extend runtime context.
   Add `variables: Record<string, unknown>` to workflow execution context and include it in block run input/output summaries.

2. Add backend block type.
   Add `set_variable` to automation block type unions and route validation.

3. Add variable assignment execution.
   Implement value source modes and write to `context.variables[name]`.

4. Add frontend block library card.
   Add `Add variable` under Data blocks.

5. Add frontend inspector.
   Let operators choose variable name, value source, and custom JSON or field path.

6. Add output interpolation.
    Apply variable interpolation to custom JSON bodies in Control device blocks before sending HTTP/MQTT output.

7. Add validation.
   Validate variable names, custom JSON, field paths, and variable-backed condition references that are not set by prior blocks.

8. Update run history display.
    Include variables in block run summaries so users can debug what values were set.

9. Add variable-backed conditions.
   Let the main `If field matches` block choose between Trigger event and Variable sources. Remove Latest data as a direct source for this main condition block.

## V1 Non-Goals

- No global variables.
- No persisted variables.
- No variable editor outside workflows.
- No JavaScript/expression language.
- No loops or arrays of variable assignments.
- No math operations.
- No string helper functions.
- No secret storage in variables.
- No cross-workflow variable sharing.

## V2 Ideas

- Field mapping block for building objects from multiple sources.
- Format text block for creating strings from variables and fields.
- Basic string helpers, if users need them.
- Numeric transform helpers, if sensor workflows need simple unit conversion.
- UI preview of the resolved output payload before running a workflow.
- Reusable workflow snippets/templates.

## Security And Safety

Variables can carry data from untrusted inputs such as webhook/MQTT payloads or fetched HTTP responses.

Controls for V1:

- Variables are per-run only.
- Variable names are restricted.
- Custom JSON must parse before save/create.
- Interpolation is data substitution only, not code execution.
- Output blocks still send only to configured output targets.

Documentation updates for implementation:

- Update `README.md` with variable and templating usage.
- Update `CHANGELOG.md` under `[Unreleased]`.
- Update `docs/security/data-sources-and-automation.md` if variable interpolation expands output risk.
- Update `.agents/rules/automation.md` if `set_variable` becomes a supported workflow block.

## Verification For Implementation

Run:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual checks:

- Set a custom string variable and insert it into HTTP output custom JSON.
- Set a variable from a GPIO trigger field and insert it into HTTP output custom JSON.
- Fetch HTTP JSON, set a variable from latest data, and insert it into MQTT output custom JSON.
- Confirm unknown variable references fail clearly.
- Confirm invalid custom JSON fails validation before the workflow is created or saved.
- Confirm variables are visible in block run details for debugging.
- Set a variable from latest data and use `If field matches` with Condition source `Variable`.
- Confirm `If field matches` no longer offers `Latest data` as a condition source.
