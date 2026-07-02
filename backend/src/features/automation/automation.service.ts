import { getDataSource, updateDataSourceReadResult } from "../data-sources/dataSources.repository.js";
import { pulseGpioOutput } from "../data-sources/gpioOutput.service.js";
import { parseJsonApiConfig, readJsonApiSource, serializeDataSource } from "../data-sources/dataSources.service.js";
import { createDataSourceRead, linkDataSourceReadProof } from "../data-reads/dataReads.repository.js";
import { createProofRecord } from "../integritas/integritas.repository.js";
import { isIntegritasUnauthorizedErrorCode, isTransientIntegritasErrorCode, requestProofUid } from "../integritas/integritas.service.js";
import type { IntegritasApiFailure } from "../integritas/integritas.types.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
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
};

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
  const config = JSON.parse(block.config_json) as { sourceId?: string; targetId?: string; action?: string; durationMs?: number };
  const blockRun = createAutomationBlockRun({ runId, workflowId: workflow.id, blockId: block.id, orderIndex: block.order_index, blockType: block.type, blockLabel: blockLabel(block.type), input: contextSummary(context) });

  try {
    if (block.type.endsWith("_start")) {
      updateAutomationBlockRun(block.id);
      finishAutomationBlockRun(blockRun.id, { status: "success", output: contextSummary(context) });
      return;
    }
    if (block.type === "record_trigger_event") await recordTriggerEvent(workflow, block, context);
    else if (block.type === "fetch_data_source") await fetchDataSource(workflow, block, context, String(config.sourceId ?? ""));
    else if (block.type === "wait") await wait(Number(config.durationMs ?? 0));
    else if (block.type === "stamp_integritas") await stampLatestHash(workflow, context);
    else if (block.type === "control_output") await controlOutput(config, context);
    else throw new Error(`Unsupported automation block: ${block.type}`);
    updateAutomationBlockRun(block.id);
    finishAutomationBlockRun(blockRun.id, { status: "success", output: contextSummary(context) });
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
  if (source.type === "webhook" || source.type === "mqtt" || source.type === "gpio-input" || source.type === "gpio-output") throw new Error("Fetch data source block requires an HTTP JSON data source");
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

async function stampLatestHash(workflow: AutomationWorkflowRecord, context: WorkflowContext) {
  if (!context.hash || !context.data) throw new Error("No collected hash is available to stamp");
  const apiKey = getIntegritasApiKey();
  if (!apiKey) throw new Error("Integritas API key is not configured");

  const stamp = await requestProofUid({ apiKey, hash: context.hash });
  if (!stamp.ok) throw new Error(formatIntegritasStampError(stamp));

  const proof = createProofRecord({ fileName: `Automation: ${context.data.sourceName}`, fileSize: Buffer.byteLength(context.data.result.canonicalBytes, "utf8"), hash: context.hash, proofUid: stamp.proofUid, proofStatus: "pending" });
  context.proofId = proof.id;
  if (context.data.readId) linkDataSourceReadProof(context.data.readId, proof.id);
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
  if (type === "control_output") return "Control output";
  if (type === "fetch_data_source") return "Fetch data source";
  if (type === "record_trigger_event") return "Record trigger event";
  if (type === "wait") return "Wait";
  return "Start workflow";
}

async function controlOutput(config: { targetId?: string; action?: string; durationMs?: number }, context: WorkflowContext) {
  if (config.action !== "pulse") throw new Error("Only pulse output actions are supported");
  if (!config.targetId) throw new Error("Control output block requires a targetId");
  const result = await pulseGpioOutput({ targetId: config.targetId, durationMs: Number(config.durationMs ?? 0) });
  context.data = undefined;
  context.output = result;
  return result;
}

function contextSummary(context: WorkflowContext) {
  return {
    trigger: context.trigger,
    data: context.data ? { sourceId: context.data.sourceId, sourceName: context.data.sourceName, sourceUrl: context.data.sourceUrl, hash: context.data.result.bytesHash, readId: context.data.readId } : null,
    output: context.output ?? null,
    hash: context.hash ?? null,
    proofId: context.proofId ?? null
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
