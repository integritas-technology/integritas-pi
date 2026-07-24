import fs from "node:fs/promises";
import { getDataSource, updateDataSourceReadResult } from "../data-sources/dataSources.repository.js";
import { getAddressBookEntryById } from "../address-book/address-book.repository.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { pulseGpioOutput } from "../data-sources/gpioOutput.service.js";
import { publishMqttOutput } from "../data-sources/mqttOutput.service.js";
import { capturePiCamera } from "../data-sources/cameraCapture.service.js";
import { parseHttpOutputConfig, parseJsonApiConfig, readJsonApiSource, sendHttpOutput, sendMultipartMediaOutput, serializeDataSource } from "../data-sources/dataSources.service.js";
import { createDataSourceRead, linkDataSourceReadProof } from "../data-reads/dataReads.repository.js";
import { createProofRecord } from "../integritas/integritas.repository.js";
import { isIntegritasUnauthorizedErrorCode, isTransientIntegritasErrorCode, requestProofUid } from "../integritas/integritas.service.js";
import type { IntegritasApiFailure } from "../integritas/integritas.types.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { getWalletStatus, recordWalletSendHistory, sendPayment } from "../wallet/wallet.service.js";
import { sha3HashHex } from "../../shared/crypto.js";
import { blockError, errorFromUnknown, errorMessage, parseStoredError, workflowError, type StructuredError } from "../../shared/structured-error.js";
import {
  getAutomationWorkflow,
  listAutomationBlocks,
  listDueScheduleWorkflows,
  updateAutomationBlockRun,
  updateAutomationRunError,
  updateAutomationRunSuccess,
  type AutomationBlockRecord,
  type AutomationWorkflowRecord
} from "./automation.repository.js";
import { createAutomationBlockRun, createAutomationRun, finishAutomationBlockRun, finishAutomationRun, getAutomationRun, listAutomationBlockRuns, listAutomationRuns, listAutomationRunsForWorkflow, type AutomationBlockRunRecord, type AutomationRunListQuery, type AutomationRunRecord } from "./automationRuns.repository.js";

type WorkflowTriggerType = "manual" | "schedule" | "webhook" | "mqtt" | "gpio";

type ReadResult = {
  contentType?: string;
  bytesHash: string;
  preview: unknown;
  canonicalBytes: string;
  sizeBytes?: number;
};

type WorkflowContext = {
  trigger: {
    type: WorkflowTriggerType;
    sourceId?: string;
    payload?: unknown;
  };
  data?: {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    result: ReadResult;
    readId?: string;
  };
  hash?: string;
  proofId?: string | null;
  output?: unknown;
  stopped?: boolean;
  variables: Record<string, unknown>;
};

type FieldCondition = {
  source?: "trigger" | "data";
  fieldPath: string;
  operator: "equals" | "not_equals" | "greater_than" | "greater_than_or_equals" | "less_than" | "less_than_or_equals" | "exists" | "does_not_exist";
  value?: unknown;
};

type WorkflowCondition = {
  source?: "trigger" | "variable";
  fieldPath?: string;
  variableName?: string;
  operator?: FieldCondition["operator"];
  value?: unknown;
};

type OutputBodyMode = "custom" | "workflow_context" | "trigger_payload" | "latest_data" | "latest_data_with_media" | "multipart_media" | "none";
type VariableSource = "custom_json" | "trigger_field" | "latest_data_field" | "context_field";

const runningWorkflowIds = new Set<string>();
let scheduler: NodeJS.Timeout | null = null;

export function serializeAutomationWorkflow(record: AutomationWorkflowRecord) {
  const lastErrorDetails = parseStoredError(record.last_error);
  const blocks = listAutomationBlocks(record.id).map(serializeAutomationBlock);
  return {
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    name: record.name,
    enabled: Boolean(record.enabled),
    archived: Boolean(record.archived),
    lastRunAt: record.last_run_at,
    nextRunAt: record.next_run_at,
    lastHash: record.last_hash,
    lastProofId: record.last_proof_id,
    lastError: errorMessage(record.last_error),
    lastErrorDetails,
    blocks
  };
}

export function serializeAutomationBlock(record: AutomationBlockRecord) {
  const lastErrorDetails = parseStoredError(record.last_error);
  return {
    id: record.id,
    workflowId: record.workflow_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    type: record.type,
    enabled: Boolean(record.enabled),
    order: record.order_index,
    parentBlockId: record.parent_block_id,
    config: JSON.parse(record.config_json) as unknown,
    lastRunAt: record.last_run_at,
    lastError: errorMessage(record.last_error),
    lastErrorDetails
  };
}

export function serializeAutomationRun(record: AutomationRunRecord) {
  const errorDetails = parseStoredError(record.error);
  return {
    id: record.id,
    workflowId: record.workflow_id,
    workflowName: record.workflow_name,
    startedAt: record.started_at,
    finishedAt: record.finished_at,
    status: record.status,
    triggerType: record.trigger_type,
    triggerSourceId: record.trigger_source_id,
    triggerPayload: record.trigger_payload_json ? JSON.parse(record.trigger_payload_json) as unknown : null,
    durationMs: record.duration_ms,
    blockCount: record.block_count,
    error: errorMessage(record.error),
    errorDetails,
    blocks: listAutomationBlockRuns(record.id).map(serializeAutomationBlockRun)
  };
}

export function serializeAutomationBlockRun(record: AutomationBlockRunRecord) {
  const errorDetails = parseStoredError(record.error);
  return {
    id: record.id,
    runId: record.run_id,
    workflowId: record.workflow_id,
    blockId: record.block_id,
    order: record.order_index,
    blockType: record.block_type,
    blockLabel: record.block_label,
    startedAt: record.started_at,
    finishedAt: record.finished_at,
    status: record.status,
    durationMs: record.duration_ms,
    input: record.input_json ? JSON.parse(record.input_json) as unknown : null,
    output: record.output_json ? JSON.parse(record.output_json) as unknown : null,
    error: errorMessage(record.error),
    errorDetails
  };
}

export function listSerializedAutomationRuns(query: AutomationRunListQuery) {
  return listAutomationRuns(query).map(serializeAutomationRun);
}

export function listSerializedAutomationRunsForWorkflow(workflowId: string, limit?: number) {
  return listAutomationRunsForWorkflow(workflowId, limit).map(serializeAutomationRun);
}

export function getSerializedAutomationRun(id: string) {
  const run = getAutomationRun(id);
  return run ? serializeAutomationRun(run) : null;
}

export async function runAutomationWorkflow(id: string, trigger: WorkflowContext["trigger"] = { type: "manual" }) {
  const workflow = getAutomationWorkflow(id);
  if (!workflow) throw new Error("Automation workflow not found");
  return executeWorkflow(workflow, trigger);
}

export async function executeWorkflow(workflow: AutomationWorkflowRecord, trigger: WorkflowContext["trigger"]) {
  if (runningWorkflowIds.has(workflow.id)) throw Object.assign(new Error("Automation workflow is already running"), { code: "WORKFLOW_ALREADY_RUNNING" });
  if (workflow.archived) throw new Error("Automation workflow is archived");
  if (!workflow.enabled && trigger.type !== "manual") throw new Error("Automation workflow is disabled");

  runningWorkflowIds.add(workflow.id);
  const context: WorkflowContext = { trigger, variables: {} };
  let nextRunAt: string | null = workflow.next_run_at;
  let run = null as ReturnType<typeof createAutomationRun> | null;

  try {
    const blocks = listAutomationBlocks(workflow.id).filter((block) => block.enabled);
    const mainBlocks = blocks.filter((block) => !block.parent_block_id);
    if (mainBlocks.length === 0) throw new Error("Automation workflow has no blocks");

    validateStartBlock(mainBlocks[0], trigger);
    run = createAutomationRun({ workflowId: workflow.id, workflowName: workflow.name, triggerType: trigger.type, triggerSourceId: trigger.sourceId ?? null, triggerPayload: trigger.payload, blockCount: blocks.length });

    for (const block of mainBlocks) {
      await executeBlock(workflow, block, context, run.id);
      for (const attachedBlock of blocks.filter((item) => item.parent_block_id === block.id)) {
        await executeBlock(workflow, attachedBlock, context, run.id);
      }
      if (block.type === "schedule_start") nextRunAt = nextScheduleRunAt(block);
      if (context.stopped) break;
    }

    const updatedWorkflow = updateAutomationRunSuccess(workflow.id, { hash: context.hash ?? null, proofId: context.proofId ?? null, nextRunAt });
    finishAutomationRun(run.id, { status: "success" });
    return { workflow: serializeAutomationWorkflow(updatedWorkflow), dataSource: context.data?.sourceId ? serializeDataSource(getDataSource(context.data.sourceId)!) : null, proofId: context.proofId ?? null };
  } catch (error) {
    const details = workflowError({ type: "block_failed", ...errorFromUnknown(error, "Automation workflow failed", { workflowId: workflow.id }), message: error instanceof Error ? error.message : "Automation workflow failed" });
    const updatedWorkflow = updateAutomationRunError(workflow.id, details, { hash: context.hash ?? null, proofId: context.proofId ?? null, nextRunAt });
    if (run) finishAutomationRun(run.id, { status: "failed", error: details });
    throw Object.assign(error instanceof Error ? error : new Error(details.message), { workflow: serializeAutomationWorkflow(updatedWorkflow), errorDetails: details });
  } finally {
    runningWorkflowIds.delete(workflow.id);
  }
}

export async function recordPushAutomationPayload(input: {
  workflow: AutomationWorkflowRecord;
  dataSource: { id: string; name: string };
  sourceUrl: string;
  triggerType: "webhook" | "mqtt" | "gpio";
  result: ReadResult;
}) {
  return executeWorkflow(input.workflow, {
    type: input.triggerType,
    sourceId: input.dataSource.id,
    payload: input.result.preview
  });
}

function validateStartBlock(block: AutomationBlockRecord, trigger: WorkflowContext["trigger"]) {
  const config = JSON.parse(block.config_json) as { sourceId?: string };
  const expectedType = trigger.type === "schedule" ? "schedule_start" : trigger.type === "gpio" ? "gpio_event_start" : trigger.type === "webhook" ? "webhook_event_start" : trigger.type === "mqtt" ? "mqtt_event_start" : "manual_start";
  if (trigger.type === "manual") return;
  if (block.type !== expectedType) throw new Error(`Workflow starts with ${block.type}, not ${expectedType}`);
  if (trigger.sourceId && config.sourceId !== trigger.sourceId) throw new Error("Workflow trigger source did not match the incoming event");
}

async function executeBlock(workflow: AutomationWorkflowRecord, block: AutomationBlockRecord, context: WorkflowContext, runId: string) {
  const config = JSON.parse(block.config_json) as { sourceId?: string; targetId?: string; action?: string; durationMs?: number; bodyMode?: OutputBodyMode; bodyTemplate?: unknown; bodyTemplateText?: string; multipartFileField?: string; multipartJsonField?: string; multipartJsonText?: string; variableName?: string; variableSource?: VariableSource; valueJsonText?: string; source?: "trigger" | "variable"; fieldPath?: string; operator?: FieldCondition["operator"]; value?: unknown; condition?: FieldCondition | null; recipientAddressBookId?: string; tokenId?: string; amount?: string };
  const blockRun = createAutomationBlockRun({ runId, workflowId: workflow.id, blockId: block.id, orderIndex: block.order_index, blockType: block.type, blockLabel: blockLabel(block.type), input: contextSummary(context) });

  try {
    let status: "success" | "skipped" = "success";
    if (block.type.endsWith("_start")) {
      updateAutomationBlockRun(block.id);
      finishAutomationBlockRun(blockRun.id, { status: "success", output: contextSummary(context) });
      return;
    }
    if (block.type === "record_trigger_event") await recordTriggerEvent(workflow, block, context);
    else if (block.type === "fetch_data_source") await fetchDataSource(workflow, block, context, String(config.sourceId ?? ""));
    else if (block.type === "capture_camera") await captureCamera(workflow, block, context, config);
    else if (block.type === "set_variable") setVariable(config, context);
    else if (block.type === "if_payload_field_equals") checkPayloadFieldEquals(config, context);
    else if (block.type === "wait") await wait(Number(config.durationMs ?? 0));
    else if (block.type === "stamp_integritas") status = await stampLatestHash(workflow, context, config.condition ?? null);
    else if (block.type === "control_output") await controlOutput(config, context);
    else if (block.type === "send_transaction") await sendTransaction(config, context, workflow);
    else throw new Error(`Unsupported automation block: ${block.type}`);
    updateAutomationBlockRun(block.id);
    finishAutomationBlockRun(blockRun.id, { status, output: contextSummary(context) });
    return;
  } catch (error) {
    const details = blockError({ type: blockErrorType(block.type, error), ...errorFromUnknown(error, "Block failed", { workflowId: workflow.id, blockId: block.id, blockType: block.type, blockLabel: blockLabel(block.type) }), message: friendlyBlockErrorMessage(block.type, error) });
    updateAutomationBlockRun(block.id, { error: details });
    finishAutomationBlockRun(blockRun.id, { status: "failed", output: contextSummary(context), error: details });
    throw error;
  }
}

function blockErrorType(blockType: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
  if (code === "ENOENT") return "command_unavailable";
  if (blockType === "stamp_integritas") return "stamp_failed";
  if (blockType === "if_payload_field_equals") return "condition_failed";
  if (blockType === "capture_camera" || blockType === "control_output" || blockType === "send_transaction") return "action_failed";
  return "block_failed";
}

function friendlyBlockErrorMessage(blockType: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
  if (blockType === "capture_camera" && code === "ENOENT") return "Camera command is not available";
  return error instanceof Error ? error.message : "Block failed";
}

function recordTriggerEvent(workflow: AutomationWorkflowRecord, block: AutomationBlockRecord, context: WorkflowContext) {
  if (!context.trigger.sourceId) throw new Error("Trigger source is required to record event payload");
  const source = getDataSource(context.trigger.sourceId);
  if (!source) throw new Error("Trigger data source not found");
  const payload = context.trigger.payload ?? {};
  const result = hashPayload(payload);
  const read = createDataSourceRead({ dataSourceId: source.id, workflowId: workflow.id, sourceName: source.name, sourceUrl: sourceUrlForRecord(source), triggerType: context.trigger.type, status: "success", hash: result.bytesHash, preview: result.preview, triggerSourceId: source.id, triggerPayload: payload, blockId: block.id });
  updateDataSourceReadResult(source.id, { hash: result.bytesHash, preview: result.preview });
  context.data = { sourceId: source.id, sourceName: source.name, sourceUrl: sourceUrlForRecord(source), result, readId: read.id };
  context.hash = result.bytesHash;
}

async function fetchDataSource(workflow: AutomationWorkflowRecord, block: AutomationBlockRecord, context: WorkflowContext, sourceId: string) {
  const source = getDataSource(sourceId);
  if (!source) throw new Error("Data source not found");
  if (source.type === "webhook" || source.type === "mqtt" || source.type === "gpio-input" || source.type === "gpio-output" || source.type === "pi-camera" || source.type === "http-output" || source.type === "mqtt-output") throw new Error("Fetch data source block requires an HTTP JSON data source");
  const config = parseJsonApiConfig(JSON.parse(source.config) as unknown);
  try {
    const result = await readJsonApiSource(config);
    const read = createDataSourceRead({ dataSourceId: source.id, workflowId: workflow.id, sourceName: source.name, sourceUrl: config.url, triggerType: context.trigger.type === "manual" ? "manual" : context.trigger.type === "schedule" ? "schedule" : context.trigger.type, status: "success", hash: result.bytesHash, preview: result.preview, triggerSourceId: context.trigger.sourceId ?? null, triggerPayload: context.trigger.payload, blockId: block.id });
    updateDataSourceReadResult(source.id, { hash: result.bytesHash, preview: result.preview });
    context.data = { sourceId: source.id, sourceName: source.name, sourceUrl: config.url, result, readId: read.id };
    context.hash = result.bytesHash;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch data source";
    updateDataSourceReadResult(source.id, { error: message });
    createDataSourceRead({ dataSourceId: source.id, workflowId: workflow.id, sourceName: source.name, sourceUrl: config.url, triggerType: context.trigger.type === "manual" ? "manual" : context.trigger.type === "schedule" ? "schedule" : context.trigger.type, status: "failed", error: message, triggerSourceId: context.trigger.sourceId ?? null, triggerPayload: context.trigger.payload, blockId: block.id });
    throw error;
  }
}

async function captureCamera(workflow: AutomationWorkflowRecord, block: AutomationBlockRecord, context: WorkflowContext, config: { sourceId?: string; durationMs?: number }) {
  const sourceId = String(config.sourceId ?? "");
  const source = getDataSource(sourceId);
  if (!source) throw new Error("Camera device not found");
  if (source.type !== "pi-camera") throw new Error("Capture camera block requires a Pi Camera device");

  try {
    const result = await capturePiCamera({ sourceId, durationMs: config.durationMs });
    const read = createDataSourceRead({ dataSourceId: source.id, workflowId: workflow.id, sourceName: source.name, sourceUrl: sourceUrlForRecord(source), triggerType: context.trigger.type === "manual" ? "manual" : context.trigger.type === "schedule" ? "schedule" : context.trigger.type, status: "success", hash: result.bytesHash, preview: result.preview, triggerSourceId: context.trigger.sourceId ?? null, triggerPayload: context.trigger.payload, blockId: block.id });
    updateDataSourceReadResult(source.id, { hash: result.bytesHash, preview: result.preview });
    context.data = { sourceId: source.id, sourceName: source.name, sourceUrl: sourceUrlForRecord(source), result, readId: read.id };
    context.hash = result.bytesHash;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to capture camera";
    updateDataSourceReadResult(source.id, { error: message });
    createDataSourceRead({ dataSourceId: source.id, workflowId: workflow.id, sourceName: source.name, sourceUrl: sourceUrlForRecord(source), triggerType: context.trigger.type === "manual" ? "manual" : context.trigger.type === "schedule" ? "schedule" : context.trigger.type, status: "failed", error: message, triggerSourceId: context.trigger.sourceId ?? null, triggerPayload: context.trigger.payload, blockId: block.id });
    throw error;
  }
}

async function stampLatestHash(workflow: AutomationWorkflowRecord, context: WorkflowContext, condition: FieldCondition | null): Promise<"success" | "skipped"> {
  if (!context.hash || !context.data) throw new Error("No collected hash is available to stamp");
  if (condition) {
    const result = evaluateCondition(context, { ...condition, source: condition.source ?? "data" });
    context.output = { condition: result, action: result.matched ? "stamped" : "skipped" };
    if (!result.matched) return "skipped";
  }

  const apiKey = getIntegritasApiKey();
  if (!apiKey) throw new Error("Integritas API key is not configured");

  const stamp = await requestProofUid({ apiKey, hash: context.hash });
  if (!stamp.ok) throw new Error(formatIntegritasStampError(stamp));

  const proof = createProofRecord({ fileName: `Automation: ${context.data.sourceName}`, fileSize: context.data.result.sizeBytes ?? Buffer.byteLength(context.data.result.canonicalBytes, "utf8"), hash: context.hash, proofUid: stamp.proofUid, proofStatus: "pending" });
  context.proofId = proof.id;
  if (context.data.readId) linkDataSourceReadProof(context.data.readId, proof.id);
  context.output = { condition: condition ? evaluateCondition(context, { ...condition, source: condition.source ?? "data" }) : null, action: "stamped", proofId: proof.id, proofUid: stamp.proofUid };
  return "success";
}

function hashPayload(payload: unknown): ReadResult {
  const canonicalBytes = `${JSON.stringify(payload, null, 2)}\n`;
  return { bytesHash: sha3HashHex(canonicalBytes), preview: payload, canonicalBytes };
}

function wait(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 60000) throw new Error("Wait duration must be between 0 and 60000 ms");
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function nextScheduleRunAt(block: AutomationBlockRecord) {
  const config = JSON.parse(block.config_json) as { intervalSeconds?: number };
  const intervalSeconds = Number(config.intervalSeconds ?? 0);
  return intervalSeconds > 0 ? new Date(Date.now() + intervalSeconds * 1000).toISOString() : null;
}

function sourceUrlForRecord(source: { type: string; config: string }) {
  const config = JSON.parse(source.config) as Record<string, unknown>;
  if (source.type === "gpio-input") return `${config.chip ?? "gpiochip0"} GPIO${config.pin ?? "?"}`;
  if (source.type === "mqtt") return `${config.brokerUrl ?? "MQTT"} ${config.topic ?? ""}`;
  if (source.type === "webhook") return `/api/data-source-webhooks/${config.webhookToken ?? ""}`;
  if (source.type === "pi-camera") return `pi-camera:${config.mode ?? "photo"}`;
  return String(config.url ?? "data source");
}

function blockLabel(type: string) {
  if (type === "stamp_integritas") return "Stamp data";
  if (type === "set_variable") return "Set variable";
  if (type === "control_output") return "Control device";
  if (type === "send_transaction") return "Send payment";
  if (type === "if_payload_field_equals") return "If field matches";
  if (type === "fetch_data_source") return "Fetch data source";
  if (type === "capture_camera") return "Capture camera";
  if (type === "record_trigger_event") return "Record trigger event";
  if (type === "wait") return "Wait";
  return "Start workflow";
}

function checkPayloadFieldEquals(config: WorkflowCondition, context: WorkflowContext) {
  const result = evaluateWorkflowCondition(context, config);
  context.output = { ...result, action: result.matched ? "continued" : "stopped" };
  if (!result.matched) context.stopped = true;
}

function evaluateWorkflowCondition(context: WorkflowContext, condition: WorkflowCondition) {
  const source = condition.source ?? "trigger";
  const actual = source === "variable" ? context.variables[String(condition.variableName ?? "")] : getPathValue(context.trigger.payload, String(condition.fieldPath ?? ""));
  const matched = evaluateOperator(actual, condition.operator!, condition.value);
  return { source, fieldPath: condition.fieldPath, variableName: condition.variableName, operator: condition.operator, expected: condition.value, actual, matched };
}

function evaluateCondition(context: WorkflowContext, condition: FieldCondition & { source: "trigger" | "data" }) {
  const source = condition.source === "data" ? context.data?.result.preview : context.trigger.payload;
  const actual = getPathValue(source, condition.fieldPath);
  const matched = evaluateOperator(actual, condition.operator, condition.value);
  return { source: condition.source, fieldPath: condition.fieldPath, operator: condition.operator, expected: condition.value, actual, matched };
}

function evaluateOperator(actual: unknown, operator: FieldCondition["operator"], expected: unknown) {
  if (operator === "exists") return actual !== undefined;
  if (operator === "does_not_exist") return actual === undefined;
  if (operator === "equals") return deepEqualJson(actual, expected);
  if (operator === "not_equals") return !deepEqualJson(actual, expected);

  if (typeof actual !== "number" || typeof expected !== "number") return false;
  if (operator === "greater_than") return actual > expected;
  if (operator === "greater_than_or_equals") return actual >= expected;
  if (operator === "less_than") return actual < expected;
  if (operator === "less_than_or_equals") return actual <= expected;
  return false;
}

function getPathValue(value: unknown, path: string) {
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function deepEqualJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setVariable(config: { variableName?: string; variableSource?: VariableSource; valueJsonText?: string; fieldPath?: string }, context: WorkflowContext) {
  const name = String(config.variableName ?? "").trim();
  if (!isVariableName(name)) throw new Error("Set variable requires a valid variable name");
  const source = config.variableSource ?? "custom_json";
  const value = source === "custom_json"
    ? parseVariableJson(config.valueJsonText ?? "null")
    : source === "trigger_field"
      ? getRequiredPathValue(context.trigger.payload, String(config.fieldPath ?? ""), "Trigger field")
      : source === "latest_data_field"
        ? getRequiredPathValue(context.data?.result.preview, String(config.fieldPath ?? ""), "Latest data field")
        : getRequiredPathValue(contextSummary(context), String(config.fieldPath ?? ""), "Workflow context field");
  context.variables[name] = value;
  context.output = { action: "set_variable", name, value };
}

function parseVariableJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Variable custom JSON must be valid JSON");
  }
}

function getRequiredPathValue(value: unknown, path: string, label: string) {
  if (!path.trim()) throw new Error(`${label} requires a field path`);
  const result = getPathValue(value, path);
  if (result === undefined) throw new Error(`${label} was not found: ${path}`);
  return result;
}

async function controlOutput(config: { targetId?: string; action?: string; durationMs?: number; bodyMode?: OutputBodyMode; bodyTemplate?: unknown; bodyTemplateText?: string; multipartFileField?: string; multipartJsonField?: string; multipartJsonText?: string }, context: WorkflowContext) {
  if (!config.targetId) throw new Error("Control output block requires a targetId");
  const target = getDataSource(config.targetId);
  if (!target) throw new Error("Control output target was not found");

  let result: unknown = null;
  if (target.type === "gpio-output") {
    result = await pulseGpioOutput({ targetId: config.targetId, durationMs: Number(config.durationMs ?? 0) });
  } else if (target.type === "http-output") {
    const httpConfig = parseHttpOutputConfig(JSON.parse(target.config) as unknown);
    if (config.bodyMode === "multipart_media") result = await sendMultipartMediaOutput(httpConfig, await multipartMediaPayload(config, context));
    else {
      const payload = await outputPayload(config, context);
      result = await sendHttpOutput(httpConfig, payload.body, payload.hasBody);
    }
  } else if (target.type === "mqtt-output") {
    const payload = await outputPayload(config, context);
    result = await publishMqttOutput({ targetId: config.targetId, payload: payload.body });
  }

  if (!result) throw new Error("Control output block requires an output target");
  context.data = undefined;
  context.output = result;
  return result;
}

async function outputPayload(config: { bodyMode?: OutputBodyMode; bodyTemplate?: unknown; bodyTemplateText?: string }, context: WorkflowContext) {
  const mode = config.bodyMode ?? "workflow_context";
  if (mode === "none") return { body: undefined, hasBody: false };
  if (mode === "custom") return { body: interpolateValue(parseCustomBody(config), context.variables), hasBody: true };
  if (mode === "trigger_payload") return { body: context.trigger.payload ?? {}, hasBody: true };
  if (mode === "latest_data") {
    if (!context.data) throw new Error("No recorded or fetched data is available for this output body");
    return { body: context.data.result.preview, hasBody: true };
  }
  if (mode === "latest_data_with_media") {
    if (!context.data) throw new Error("No recorded or fetched data is available for this output body");
    return { body: await mediaPayload(context.data.result), hasBody: true };
  }
  return { body: contextSummary(context), hasBody: true };
}

async function multipartMediaPayload(config: { multipartFileField?: string; multipartJsonField?: string; multipartJsonText?: string }, context: WorkflowContext) {
  if (!context.data) throw new Error("No camera capture is available for multipart media upload");
  const media = await capturedMedia(context.data.result);
  const templateValues = { ...context.variables, hash: media.sha3, readId: context.data.readId, sourceName: context.data.sourceName, fileName: media.fileName, mediaType: media.mediaType, sizeBytes: media.sizeBytes };
  const jsonFieldName = String(config.multipartJsonField ?? "").trim() || undefined;
  return {
    fileFieldName: String(config.multipartFileField ?? "file").trim() || "file",
    fileName: media.fileName,
    mediaType: media.mediaType,
    bytes: media.bytes,
    jsonFieldName,
    jsonPayload: jsonFieldName ? interpolateValue(parseMultipartJson(config.multipartJsonText, context, media), templateValues) : undefined
  };
}

function parseMultipartJson(text: string | undefined, context: WorkflowContext, media: { fileName: string; mediaType: string; sizeBytes: number; sha3: string }) {
  if (!text?.trim()) return { data: contextSummary(context), media: { fileName: media.fileName, mediaType: media.mediaType, sizeBytes: media.sizeBytes, sha3: media.sha3 } };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Multipart JSON field must be valid JSON");
  }
}

async function mediaPayload(result: ReadResult) {
  const media = await capturedMedia(result);
  return {
    media: {
      fileName: media.fileName,
      path: media.path,
      mediaType: media.mediaType,
      sizeBytes: media.sizeBytes,
      sha3: media.sha3,
      base64: media.bytes.toString("base64")
    },
    capture: result.preview
  };
}

async function capturedMedia(result: ReadResult) {
  const preview = result.preview;
  if (!preview || typeof preview !== "object") throw new Error("Latest data does not include captured media metadata");
  const record = preview as { source?: unknown; path?: unknown; mediaType?: unknown; fileName?: unknown; sizeBytes?: unknown; sha3?: unknown };
  if (record.source !== "pi-camera-helper" || typeof record.path !== "string") throw new Error("Latest data is not a Pi Camera capture");

  const bytes = await fs.readFile(record.path);
  return {
    fileName: typeof record.fileName === "string" ? record.fileName : "camera-capture",
    path: record.path,
    mediaType: typeof record.mediaType === "string" ? record.mediaType : result.contentType ?? "application/octet-stream",
    sizeBytes: typeof record.sizeBytes === "number" ? record.sizeBytes : bytes.length,
    sha3: typeof record.sha3 === "string" ? record.sha3 : result.bytesHash,
    bytes
  };
}

function interpolateValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === "string") return interpolateString(value, variables);
  if (Array.isArray(value)) return value.map((item) => interpolateValue(item, variables));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateValue(item, variables)]));
  return value;
}

function interpolateString(value: string, variables: Record<string, unknown>) {
  const exact = value.match(/^\s*\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}\s*$/);
  if (exact) return variableValue(exact[1], variables);
  return value.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_match, name: string) => stringifyTemplateValue(variableValue(name, variables)));
}

function variableValue(name: string, variables: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`Output template references unknown variable: ${name}`);
  return variables[name];
}

function stringifyTemplateValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return JSON.stringify(value);
}

function isVariableName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function parseCustomBody(config: { bodyTemplate?: unknown; bodyTemplateText?: string }) {
  if (typeof config.bodyTemplateText === "string") {
    try {
      return JSON.parse(config.bodyTemplateText) as unknown;
    } catch {
      throw new Error("Custom output body must be valid JSON");
    }
  }
  return config.bodyTemplate ?? {};
}

async function sendTransaction(config: { recipientAddressBookId?: string; tokenId?: string; amount?: string }, context: WorkflowContext, workflow: AutomationWorkflowRecord) {
  const recipient = config.recipientAddressBookId ? getAddressBookEntryById(config.recipientAddressBookId) : null;
  if (!recipient) throw new Error("Send transaction recipient was not found in the address book");

  const tokenId = String(config.tokenId ?? "0x00").trim();
  if (tokenId.toLowerCase() !== "0x00") throw new Error("Send transaction currently supports only native MINIMA tokenid 0x00");
  const amount = String(config.amount ?? "").trim();
  if (!isPositiveDecimal(amount)) throw new Error("Send transaction amount must be a positive decimal");

  const wallet = await getWalletStatus();
  const nativeToken = wallet.tokens.find((token) => token.tokenId.toLowerCase() === "0x00" || token.isNative);
  if (!nativeToken) throw new Error("Wallet does not report a native MINIMA balance");
  if (compareDecimalStrings(amount, nativeToken.sendable) > 0) throw new Error(`Amount exceeds available balance (${nativeToken.sendable} MINIMA)`);

  const result = await sendPayment({ address: recipient.address, amount, tokenId: "0x00" });
  recordWalletSendHistory({
    toAddress: recipient.address,
    tokenId: "0x00",
    tokenName: "Minima",
    amount,
    txpowId: result.txpowId,
    status: result.ok ? "submitted" : "failed"
  });
  recordAuditEvent("automation.wallet.send", {
    detail: JSON.stringify({ workflowId: workflow.id, workflowName: workflow.name, recipientId: recipient.id, recipientLabel: recipient.label, amount, tokenId: "0x00", txpowId: result.txpowId })
  });

  if (!result.ok || result.status === "failed") throw new Error(result.message ?? "Send transaction failed");
  context.output = { action: "sent_transaction", recipientId: recipient.id, recipientLabel: recipient.label, address: recipient.address, tokenId: "0x00", tokenName: "Minima", amount, txpowId: result.txpowId, status: result.status };
  context.data = undefined;
  return result;
}

function isPositiveDecimal(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value)) return false;
  return compareDecimalStrings(value, "0") > 0;
}

function compareDecimalStrings(a: string, b: string) {
  const normalize = (value: string) => {
    const trimmed = value.trim();
    const [intPart = "0", fracPart = ""] = trimmed.split(".");
    return {
      int: intPart.replace(/^0+(?=\d)/, "") || "0",
      frac: fracPart
    };
  };
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  const fracLen = Math.max(aNorm.frac.length, bNorm.frac.length);
  const aCombined = `${aNorm.int}${aNorm.frac.padEnd(fracLen, "0")}`;
  const bCombined = `${bNorm.int}${bNorm.frac.padEnd(fracLen, "0")}`;
  if (aCombined === bCombined) return 0;
  return BigInt(aCombined) > BigInt(bCombined) ? 1 : -1;
}

function contextSummary(context: WorkflowContext) {
  return {
    trigger: context.trigger,
    data: context.data ? { sourceId: context.data.sourceId, sourceName: context.data.sourceName, sourceUrl: context.data.sourceUrl, hash: context.data.result.bytesHash, readId: context.data.readId } : null,
    output: context.output ?? null,
    hash: context.hash ?? null,
    proofId: context.proofId ?? null,
    stopped: context.stopped ?? false,
    variables: context.variables
  };
}

function formatIntegritasStampError(stamp: IntegritasApiFailure) {
  if (isTransientIntegritasErrorCode(stamp.errorCode)) return `${stamp.error} (${stamp.errorCode}): HTTP ${stamp.status}. Stamp will retry on the next run.`;
  if (isIntegritasUnauthorizedErrorCode(stamp.errorCode)) return "Integritas API key rejected. Update the API key before stamping can succeed.";
  return `${stamp.error} (${stamp.errorCode}): HTTP ${stamp.status} ${JSON.stringify(stamp.responseBody)}`;
}

export function startAutomationScheduler() {
  if (scheduler) return;
  scheduler = setInterval(() => {
    const due = listDueScheduleWorkflows(new Date().toISOString()).filter((workflow) => !runningWorkflowIds.has(workflow.id));
    for (const workflow of due) {
      executeWorkflow(workflow, { type: "schedule" }).catch((error: Error) => console.error(`Automation workflow ${workflow.id} failed: ${error.message}`));
    }
  }, 5000);
}

export function stopAutomationScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}
