import { getDataSource, updateDataSourceReadResult } from "../data-sources/dataSources.repository.js";
import { getAddressBookEntryById } from "../address-book/address-book.repository.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { pulseGpioOutput } from "../data-sources/gpioOutput.service.js";
import { publishMqttOutput } from "../data-sources/mqttOutput.service.js";
import { parseHttpOutputConfig, parseJsonApiConfig, readJsonApiSource, sendHttpOutput, serializeDataSource } from "../data-sources/dataSources.service.js";
import { createDataSourceRead, linkDataSourceReadProof } from "../data-reads/dataReads.repository.js";
import { createProofRecord } from "../integritas/integritas.repository.js";
import { isIntegritasUnauthorizedErrorCode, isTransientIntegritasErrorCode, requestProofUid } from "../integritas/integritas.service.js";
import type { IntegritasApiFailure } from "../integritas/integritas.types.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { getWalletStatus, recordWalletSendHistory, sendPayment } from "../wallet/wallet.service.js";
import { sha3HashHex } from "../../shared/crypto.js";
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
import { createAutomationBlockRun, createAutomationRun, finishAutomationBlockRun, finishAutomationRun, getAutomationRun, listAutomationBlockRuns, listAutomationRuns, listAutomationRunsForWorkflow, type AutomationBlockRunRecord, type AutomationRunRecord } from "./automationRuns.repository.js";

type WorkflowTriggerType = "manual" | "schedule" | "webhook" | "mqtt" | "gpio";

type ReadResult = {
  bytesHash: string;
  preview: unknown;
  canonicalBytes: string;
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
};

type FieldCondition = {
  source?: "trigger" | "data";
  fieldPath: string;
  operator: "equals" | "not_equals" | "greater_than" | "greater_than_or_equals" | "less_than" | "less_than_or_equals" | "exists" | "does_not_exist";
  value?: unknown;
};

type OutputBodyMode = "custom" | "workflow_context" | "trigger_payload" | "latest_data" | "none";

const runningWorkflowIds = new Set<string>();
let scheduler: NodeJS.Timeout | null = null;

export function serializeAutomationWorkflow(record: AutomationWorkflowRecord) {
  const blocks = listAutomationBlocks(record.id).map(serializeAutomationBlock);
  const mainBlocks = blocks.filter((block) => !block.parentBlockId);
  const startBlock = mainBlocks[0];
  const fetchBlock = blocks.find((block) => block.type === "fetch_data_source");
  const stampBlock = blocks.find((block) => block.type === "stamp_integritas");
  const dataSourceId = typeof fetchBlock?.config === "object" && fetchBlock.config && "sourceId" in fetchBlock.config
    ? String(fetchBlock.config.sourceId)
    : typeof startBlock?.config === "object" && startBlock.config && "sourceId" in startBlock.config
      ? String(startBlock.config.sourceId)
      : "";
  const pollingIntervalSeconds = startBlock?.type === "schedule_start" && typeof startBlock.config === "object" && startBlock.config && "intervalSeconds" in startBlock.config
    ? Number(startBlock.config.intervalSeconds)
    : 0;

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
    lastError: record.last_error,
    blocks,
    // Temporary compatibility fields for the existing frontend while the block UI is built.
    dataSourceId,
    pollingIntervalSeconds,
    stampWithIntegritas: Boolean(stampBlock),
    rules: blocks.filter((block) => !block.type.endsWith("_start") && !block.parentBlockId).map(blockToLegacyRule)
  };
}

export function serializeAutomationBlock(record: AutomationBlockRecord) {
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
    lastError: record.last_error
  };
}

export function serializeAutomationRun(record: AutomationRunRecord) {
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
    error: record.error,
    blocks: listAutomationBlockRuns(record.id).map(serializeAutomationBlockRun)
  };
}

export function serializeAutomationBlockRun(record: AutomationBlockRunRecord) {
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
    error: record.error
  };
}

export function listSerializedAutomationRuns(limit?: number) {
  return listAutomationRuns(limit).map(serializeAutomationRun);
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
  const context: WorkflowContext = { trigger };
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
    const message = error instanceof Error ? error.message : "Automation workflow failed";
    const updatedWorkflow = updateAutomationRunError(workflow.id, message, { hash: context.hash ?? null, proofId: context.proofId ?? null, nextRunAt });
    if (run) finishAutomationRun(run.id, { status: "failed", error: message });
    throw Object.assign(error instanceof Error ? error : new Error(message), { workflow: serializeAutomationWorkflow(updatedWorkflow) });
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

export function recordPushAutomationError(input: { workflow: AutomationWorkflowRecord; dataSource: { id: string; name: string }; sourceUrl: string; triggerType: "webhook" | "mqtt" | "gpio"; error: string }) {
  updateDataSourceReadResult(input.dataSource.id, { error: input.error });
  createDataSourceRead({ dataSourceId: input.dataSource.id, workflowId: input.workflow.id, sourceName: input.dataSource.name, sourceUrl: input.sourceUrl, triggerType: input.triggerType, status: "failed", error: input.error, triggerSourceId: input.dataSource.id });
  const updatedWorkflow = updateAutomationRunError(input.workflow.id, input.error);
  return { workflow: serializeAutomationWorkflow(updatedWorkflow) };
}

function validateStartBlock(block: AutomationBlockRecord, trigger: WorkflowContext["trigger"]) {
  const config = JSON.parse(block.config_json) as { sourceId?: string };
  const expectedType = trigger.type === "schedule" ? "schedule_start" : trigger.type === "gpio" ? "gpio_event_start" : trigger.type === "webhook" ? "webhook_event_start" : trigger.type === "mqtt" ? "mqtt_event_start" : "manual_start";
  if (trigger.type === "manual") return;
  if (block.type !== expectedType) throw new Error(`Workflow starts with ${block.type}, not ${expectedType}`);
  if (trigger.sourceId && config.sourceId !== trigger.sourceId) throw new Error("Workflow trigger source did not match the incoming event");
}

async function executeBlock(workflow: AutomationWorkflowRecord, block: AutomationBlockRecord, context: WorkflowContext, runId: string) {
  const config = JSON.parse(block.config_json) as { sourceId?: string; targetId?: string; action?: string; durationMs?: number; bodyMode?: OutputBodyMode; bodyTemplate?: unknown; bodyTemplateText?: string; source?: "trigger" | "data"; fieldPath?: string; operator?: FieldCondition["operator"]; value?: unknown; condition?: FieldCondition | null; recipientAddressBookId?: string; tokenId?: string; amount?: string };
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
    updateAutomationBlockRun(block.id, { error: error instanceof Error ? error.message : "Block failed" });
    finishAutomationBlockRun(blockRun.id, { status: "failed", output: contextSummary(context), error: error instanceof Error ? error.message : "Block failed" });
    throw error;
  }
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
  if (source.type === "webhook" || source.type === "mqtt" || source.type === "gpio-input" || source.type === "gpio-output" || source.type === "http-output" || source.type === "mqtt-output") throw new Error("Fetch data source block requires an HTTP JSON data source");
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

  const proof = createProofRecord({ fileName: `Automation: ${context.data.sourceName}`, fileSize: Buffer.byteLength(context.data.result.canonicalBytes, "utf8"), hash: context.hash, proofUid: stamp.proofUid, proofStatus: "pending" });
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
  return String(config.url ?? "data source");
}

function blockToLegacyRule(block: ReturnType<typeof serializeAutomationBlock>) {
  return {
    id: block.id,
    workflowId: block.workflowId,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    name: blockLabel(block.type),
    type: block.type === "stamp_integritas" ? "stamp_integritas" : "collect_data",
    enabled: block.enabled,
    order: block.order,
    when: block.type.endsWith("_start") ? block.config : { type: "after_previous_block" },
    condition: { type: "block_enabled" },
    then: block.config,
    lastRunAt: block.lastRunAt,
    lastError: block.lastError
  };
}

function blockLabel(type: string) {
  if (type === "stamp_integritas") return "Stamp with Integritas";
  if (type === "control_output") return "Control device";
  if (type === "send_transaction") return "Send transaction";
  if (type === "if_payload_field_equals") return "If field matches";
  if (type === "fetch_data_source") return "Fetch data source";
  if (type === "record_trigger_event") return "Record trigger event";
  if (type === "wait") return "Wait";
  return "Start workflow";
}

function checkPayloadFieldEquals(config: { source?: "trigger" | "data"; fieldPath?: string; operator?: FieldCondition["operator"]; value?: unknown }, context: WorkflowContext) {
  const result = evaluateCondition(context, { source: config.source ?? "trigger", fieldPath: String(config.fieldPath ?? ""), operator: config.operator!, value: config.value });
  context.output = { ...result, action: result.matched ? "continued" : "stopped" };
  if (!result.matched) context.stopped = true;
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

async function controlOutput(config: { targetId?: string; action?: string; durationMs?: number; bodyMode?: OutputBodyMode; bodyTemplate?: unknown; bodyTemplateText?: string }, context: WorkflowContext) {
  if (!config.targetId) throw new Error("Control output block requires a targetId");
  const target = getDataSource(config.targetId);
  if (!target) throw new Error("Control output target was not found");

  const payload = outputPayload(config, context);
  const result = target.type === "gpio-output"
    ? await pulseGpioOutput({ targetId: config.targetId, durationMs: Number(config.durationMs ?? 0) })
    : target.type === "http-output"
      ? await sendHttpOutput(parseHttpOutputConfig(JSON.parse(target.config) as unknown), payload.body, payload.hasBody)
    : target.type === "mqtt-output"
        ? await publishMqttOutput({ targetId: config.targetId, payload: payload.body })
        : null;
  if (!result) throw new Error("Control output block requires an output target");
  context.data = undefined;
  context.output = result;
  return result;
}

function outputPayload(config: { bodyMode?: OutputBodyMode; bodyTemplate?: unknown; bodyTemplateText?: string }, context: WorkflowContext) {
  const mode = config.bodyMode ?? "workflow_context";
  if (mode === "none") return { body: undefined, hasBody: false };
  if (mode === "custom") return { body: parseCustomBody(config), hasBody: true };
  if (mode === "trigger_payload") return { body: context.trigger.payload ?? {}, hasBody: true };
  if (mode === "latest_data") {
    if (!context.data) throw new Error("No recorded or fetched data is available for this output body");
    return { body: context.data.result.preview, hasBody: true };
  }
  return { body: contextSummary(context), hasBody: true };
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
    stopped: context.stopped ?? false
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
