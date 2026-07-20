import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { getAddressBookEntryById } from "../address-book/address-book.repository.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
import { parseGpioOutputConfig } from "../data-sources/dataSources.service.js";
import { syncGpioDataSources } from "../data-sources/gpioIngestion.service.js";
import { syncMqttDataSources } from "../data-sources/mqttIngestion.service.js";
import { createAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationWorkflow, duplicateAutomationWorkflow, getAutomationWorkflow, listAutomationBlocks, listAutomationWorkflows, reorderAutomationBlocks, updateAutomationBlock, updateAutomationWorkflow, type AutomationBlockType } from "./automation.repository.js";
import { getSerializedAutomationRun, listSerializedAutomationRuns, listSerializedAutomationRunsForWorkflow, runAutomationWorkflow, serializeAutomationBlock, serializeAutomationWorkflow } from "./automation.service.js";
import { AUTOMATION_RUN_LIST_STATUSES, countAutomationRuns } from "./automationRuns.repository.js";
import { validateAutomationDraft, validateAutomationWorkflow, type AutomationDraftValidationBlock } from "./automation.validation.js";
import { parseListQuery, toPaginatedResult } from "../../shared/list-query.js";

export const automationRouter = Router();

automationRouter.get("/workflows", (_req, res) => {
  res.json({ items: listAutomationWorkflows().map(serializeAutomationWorkflow) });
});

automationRouter.get("/runs", (req, res) => {
  const parsed = parseListQuery(req.query, { allowedStatuses: AUTOMATION_RUN_LIST_STATUSES });
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const total = countAutomationRuns(parsed.value);
  const items = listSerializedAutomationRuns(parsed.value);
  return res.json(toPaginatedResult(items, total, parsed.value));
});

automationRouter.get("/runs/:id", (req, res) => {
  const run = getSerializedAutomationRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Automation run not found" });
  res.json({ item: run });
});

automationRouter.get("/workflows/:id/runs", (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const limit = limitFromQuery(req.query.limit, 20);
  res.json({ items: listSerializedAutomationRunsForWorkflow(workflow.id, limit) });
});

automationRouter.get("/workflows/:id/validation", async (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  res.json({ item: await validateAutomationWorkflow(workflow.id) });
});

automationRouter.post("/workflows/validate-draft", async (req, res) => {
  const blocks = parseDraftValidationBlocks(req.body?.blocks);
  res.json({ item: await validateAutomationDraft(blocks) });
});

automationRouter.post("/workflows", requireRole("admin"), (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const enabled = Boolean(req.body?.enabled);

  if (!name) return res.status(400).json({ error: "name is required" });

  if (Array.isArray(req.body?.blocks)) {
    try {
      const blocks = parseWorkflowBlocks(req.body.blocks);
      const workflow = createAutomationWorkflow({
        name,
        enabled,
        nextRunAt: enabled ? nextRunAtForBlocks(blocks) : null,
        blocks
      });
      syncMqttDataSources();
      syncGpioDataSources();
      return res.json({ item: serializeAutomationWorkflow(workflow) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid workflow blocks" });
    }
  }

  const dataSourceId = typeof req.body?.dataSourceId === "string" ? req.body.dataSourceId : "";
  const pollingIntervalSeconds = Number(req.body?.pollingIntervalSeconds);
  const stampWithIntegritas = req.body?.stampWithIntegritas === true;
  const dataSource = getDataSource(dataSourceId);
  if (!dataSource) return res.status(400).json({ error: "dataSourceId must reference an existing data source" });
  const isPushSource = dataSource.type === "webhook" || dataSource.type === "mqtt" || dataSource.type === "gpio-input";
  if (!isPushSource && (!Number.isFinite(pollingIntervalSeconds) || pollingIntervalSeconds < 10)) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  try {
    const workflow = createAutomationWorkflow({
      name,
      enabled,
      nextRunAt: enabled && !isPushSource ? new Date(Date.now() + pollingIntervalSeconds * 1000).toISOString() : null,
      blocks: legacyBlocksForWorkflow(dataSource.id, dataSource.type, isPushSource ? 0 : pollingIntervalSeconds)
    });
    if (stampWithIntegritas) setStampBlock(workflow.id, true);
    syncMqttDataSources();
    syncGpioDataSources();
    return res.json({ item: serializeAutomationWorkflow(getAutomationWorkflow(workflow.id)!) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid workflow" });
  }
});

automationRouter.patch("/workflows/:id", requireRole("admin"), (req, res) => {
  const current = getAutomationWorkflow(req.params.id);
  if (!current) return res.status(404).json({ error: "Automation workflow not found" });
  const serialized = serializeAutomationWorkflow(current);
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
  const archived = typeof req.body?.archived === "boolean" ? req.body.archived : undefined;
  const nextPollingIntervalSeconds = Number.isFinite(Number(req.body?.pollingIntervalSeconds)) ? Number(req.body.pollingIntervalSeconds) : undefined;

  if (nextPollingIntervalSeconds !== undefined && serialized.pollingIntervalSeconds > 0 && nextPollingIntervalSeconds < 10) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  const workflow = updateAutomationWorkflow(req.params.id, {
    name: typeof req.body?.name === "string" ? req.body.name.trim() : undefined,
    enabled,
    archived,
    nextRunAt: archived === true || enabled === false ? null : undefined
  });

  if (nextPollingIntervalSeconds !== undefined && serialized.pollingIntervalSeconds > 0) {
    const scheduleBlock = listAutomationBlocks(req.params.id).find((block) => !block.parent_block_id && block.type === "schedule_start");
    if (scheduleBlock) updateAutomationBlock(req.params.id, scheduleBlock.id, { config: { intervalSeconds: nextPollingIntervalSeconds } });
    if (enabled !== false) updateAutomationWorkflow(req.params.id, { nextRunAt: new Date(Date.now() + nextPollingIntervalSeconds * 1000).toISOString() });
  }

  if (typeof req.body?.stampWithIntegritas === "boolean") {
    try {
      setStampBlock(req.params.id, req.body.stampWithIntegritas);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Could not update Integritas stamping" });
    }
  }

  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ item: serializeAutomationWorkflow(getAutomationWorkflow(workflow!.id)!) });
});

automationRouter.post("/workflows/:id/duplicate", requireRole("admin"), (req, res) => {
  const workflow = duplicateAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ item: serializeAutomationWorkflow(workflow) });
});

automationRouter.post("/workflows/:id/blocks", requireRole("admin"), (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const type = typeof req.body?.type === "string" ? req.body.type as AutomationBlockType : "" as AutomationBlockType;
  if (!isAutomationBlockType(type)) return res.status(400).json({ error: "Invalid block type" });
  try {
    const config = req.body?.config && typeof req.body.config === "object" && !Array.isArray(req.body.config) ? req.body.config as Record<string, unknown> : {};
    const parentBlockId = typeof req.body?.parentBlockId === "string" ? req.body.parentBlockId : null;
    validateBlockAttachment(workflow.id, type, parentBlockId);
    validateBlockConfig(type, config);
    const block = createAutomationBlock(workflow.id, { type, config, enabled: req.body?.enabled !== false, parentBlockId });
    syncMqttDataSources();
    syncGpioDataSources();
    return res.json({ item: serializeAutomationBlock(block), workflow: serializeAutomationWorkflow(getAutomationWorkflow(workflow.id)!) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid block" });
  }
});

automationRouter.patch("/workflows/:workflowId/blocks/:blockId", requireRole("admin"), (req, res) => {
  const workflow = getAutomationWorkflow(req.params.workflowId);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const currentBlock = listAutomationBlocks(workflow.id).find((block) => block.id === req.params.blockId);
  if (!currentBlock) return res.status(404).json({ error: "Block not found" });
  const config = req.body?.config && typeof req.body.config === "object" && !Array.isArray(req.body.config) ? req.body.config as Record<string, unknown> : undefined;
  if (config) {
    try {
      validateBlockConfig(currentBlock.type, config);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid block config" });
    }
  }
  const block = updateAutomationBlock(req.params.workflowId, req.params.blockId, {
    config,
    enabled: typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined
  });
  if (!block) return res.status(404).json({ error: "Block not found" });
  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ item: serializeAutomationBlock(block), workflow: serializeAutomationWorkflow(getAutomationWorkflow(workflow.id)!) });
});

automationRouter.post("/workflows/:id/blocks/reorder", requireRole("admin"), (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const blockIds = Array.isArray(req.body?.blockIds) ? req.body.blockIds.filter((id: unknown): id is string => typeof id === "string") : [];
  try {
    const blocks = reorderAutomationBlocks(workflow.id, blockIds);
    syncMqttDataSources();
    syncGpioDataSources();
    return res.json({ items: blocks.map(serializeAutomationBlock), workflow: serializeAutomationWorkflow(getAutomationWorkflow(workflow.id)!) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Could not reorder blocks" });
  }
});

automationRouter.post("/workflows/:id/rules", requireRole("admin"), (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const type = typeof req.body?.type === "string" ? req.body.type : "";
  if (type !== "stamp_integritas") return res.status(400).json({ error: "Only Integritas stamping rules can be added in this compatibility endpoint" });
  const block = setStampBlock(workflow.id, true);
  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ item: serializeAutomationBlock(block!), workflow: serializeAutomationWorkflow(getAutomationWorkflow(workflow.id)!) });
});

automationRouter.delete("/workflows/:workflowId/blocks/:blockId", requireRole("admin"), (req, res) => {
  const deleted = deleteAutomationBlock(req.params.workflowId, req.params.blockId);
  if (!deleted) return res.status(404).json({ error: "Block not found" });
  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ deleted: true, workflow: serializeAutomationWorkflow(getAutomationWorkflow(req.params.workflowId)!) });
});

automationRouter.delete("/workflows/:workflowId/rules/:ruleId", requireRole("admin"), (req, res) => {
  const deleted = deleteAutomationBlock(req.params.workflowId, req.params.ruleId);
  if (!deleted) return res.status(400).json({ error: "Rule cannot be deleted" });
  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ deleted: true, workflow: serializeAutomationWorkflow(getAutomationWorkflow(req.params.workflowId)!) });
});

automationRouter.delete("/workflows/:id", requireRole("admin"), (req, res) => {
  deleteAutomationWorkflow(req.params.id);
  syncMqttDataSources();
  syncGpioDataSources();
  res.json({ deleted: true });
});

automationRouter.post("/workflows/:id/run", requireRole("admin"), async (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const startBlock = listAutomationBlocks(workflow.id)[0];
  const startConfig = startBlock ? JSON.parse(startBlock.config_json) as { sourceId?: string } : {};
  const hasCustomPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, "triggerPayload");
  const triggerPayload = hasCustomPayload ? req.body.triggerPayload as unknown : defaultManualTriggerPayload(workflow.id, workflow.name);

  if (hasCustomPayload && !isJsonCompatible(triggerPayload)) return res.status(400).json({ error: "triggerPayload must be JSON-compatible" });

  try {
    const validation = await validateAutomationWorkflow(workflow.id);
    if (!validation.ok) return res.status(400).json({ error: "Workflow validation failed", validation });
    const result = await runAutomationWorkflow(req.params.id, {
      type: "manual",
      sourceId: startConfig.sourceId,
      payload: triggerPayload
    });
    return res.json(result);
  } catch (error) {
    const errorWorkflow = error && typeof error === "object" && "workflow" in error ? (error as { workflow: unknown }).workflow : null;
    return res.status(502).json({ error: error instanceof Error ? error.message : "Automation workflow failed", workflow: errorWorkflow });
  }
});

function defaultManualTriggerPayload(workflowId: string, workflowName: string) {
  return {
    source: "run-now",
    workflowId,
    workflowName,
    triggeredAt: new Date().toISOString(),
    note: "Manual workflow test run from the Automation page"
  };
}

function isJsonCompatible(value: unknown) {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function legacyBlocksForWorkflow(sourceId: string, sourceType: string, pollingIntervalSeconds: number) {
  const blocks: { type: AutomationBlockType; config: unknown }[] = [];
  if (sourceType === "gpio-input") blocks.push({ type: "gpio_event_start", config: { sourceId, activeOnly: false } }, { type: "record_trigger_event", config: {} });
  else if (sourceType === "webhook") blocks.push({ type: "webhook_event_start", config: { sourceId } }, { type: "record_trigger_event", config: {} });
  else if (sourceType === "mqtt") blocks.push({ type: "mqtt_event_start", config: { sourceId } }, { type: "record_trigger_event", config: {} });
  else blocks.push({ type: "schedule_start", config: { intervalSeconds: pollingIntervalSeconds } }, { type: "fetch_data_source", config: { sourceId } });
  return blocks;
}

function parseWorkflowBlocks(value: unknown[]) {
  if (value.length === 0) throw new Error("At least one block is required");
  const blocks = value.map((item) => {
    const block = item as { type?: unknown; config?: unknown; enabled?: unknown; parentBlockId?: unknown; clientId?: unknown };
    const type = typeof block.type === "string" ? block.type : "";
    if (!isAutomationBlockType(type)) throw new Error(`Invalid block type: ${type || "missing"}`);
    const config = block.config && typeof block.config === "object" && !Array.isArray(block.config) ? block.config as Record<string, unknown> : {};
    validateBlockConfig(type, config);
    const parentBlockId = typeof block.parentBlockId === "string" ? block.parentBlockId : null;
    const clientId = typeof block.clientId === "string" ? block.clientId : null;
    return { type, config, enabled: block.enabled === false ? false : true, parentBlockId, clientId };
  });

  const mainBlocks = blocks.filter((block) => !block.parentBlockId);
  if (!mainBlocks[0]?.type.endsWith("_start")) throw new Error("The first workflow block must be a start block");
  if (mainBlocks.slice(1).some((block) => block.type.endsWith("_start"))) throw new Error("Only the first workflow block can be a start block");
  for (const block of blocks.filter((item) => item.parentBlockId)) {
    if (block.type !== "stamp_integritas") throw new Error("Only Integritas stamp blocks can be attached to another block");
    const parent = blocks.find((item) => item.clientId && item.clientId === block.parentBlockId);
    if (!parent || (parent.type !== "record_trigger_event" && parent.type !== "fetch_data_source")) throw new Error("Integritas stamp blocks must be attached to a record or fetch block");
  }
  return blocks;
}

function parseDraftValidationBlocks(value: unknown): AutomationDraftValidationBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const block = item as { type?: unknown; config?: unknown; enabled?: unknown; parentBlockId?: unknown; clientId?: unknown };
    const type = typeof block.type === "string" ? block.type : "";
    if (!isAutomationBlockType(type)) return [];
    const config = block.config && typeof block.config === "object" && !Array.isArray(block.config) ? block.config as Record<string, unknown> : {};
    return [{
      type,
      config,
      enabled: block.enabled === false ? false : true,
      parentBlockId: typeof block.parentBlockId === "string" ? block.parentBlockId : null,
      clientId: typeof block.clientId === "string" ? block.clientId : null
    }];
  });
}

function validateBlockConfig(type: AutomationBlockType, config: Record<string, unknown>) {
  if (type === "schedule_start") {
    const intervalSeconds = Number(config.intervalSeconds);
    if (!Number.isFinite(intervalSeconds) || intervalSeconds < 10) throw new Error("Schedule start requires intervalSeconds of at least 10");
    config.intervalSeconds = intervalSeconds;
    return;
  }

  if (type === "gpio_event_start" || type === "webhook_event_start" || type === "mqtt_event_start" || type === "fetch_data_source") {
    const sourceId = typeof config.sourceId === "string" ? config.sourceId : "";
    const source = getDataSource(sourceId);
    if (!source) throw new Error(`${type} requires a valid sourceId`);
    if (type === "gpio_event_start" && source.type !== "gpio-input") throw new Error("GPIO start requires a GPIO input source");
    if (type === "webhook_event_start" && source.type !== "webhook") throw new Error("Webhook start requires a webhook source");
    if (type === "mqtt_event_start" && source.type !== "mqtt") throw new Error("MQTT start requires an MQTT source");
    if (type === "fetch_data_source" && (source.type === "gpio-input" || source.type === "gpio-output" || source.type === "webhook" || source.type === "mqtt" || source.type === "http-output" || source.type === "mqtt-output")) throw new Error("Fetch block requires an HTTP JSON source");
    return;
  }

  if (type === "wait") {
    const durationMs = Number(config.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 60000) throw new Error("Wait block requires durationMs between 0 and 60000");
    config.durationMs = durationMs;
  }

  if (type === "if_payload_field_equals") {
    validateFieldCondition(config, "Condition block");
    return;
  }

  if (type === "stamp_integritas") {
    if (config.condition === undefined || config.condition === null) return;
    if (typeof config.condition !== "object" || Array.isArray(config.condition)) throw new Error("Stamp condition must be an object");
    validateFieldCondition(config.condition as Record<string, unknown>, "Stamp condition");
    return;
  }

  if (type === "control_output") {
    const targetId = typeof config.targetId === "string" ? config.targetId : "";
    const target = getDataSource(targetId);
    if (!target || !isOutputTarget(target.type)) throw new Error("Control output requires an output target");
    if (target.type === "gpio-output") {
      const targetConfig = parseGpioOutputConfig(JSON.parse(target.config) as unknown);
      if (targetConfig.profile !== "led") throw new Error("Only LED output targets are supported");
      if (config.action !== "pulse") throw new Error("GPIO output action must be pulse");
      const durationMs = Number(config.durationMs);
      if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > 60000) throw new Error("Pulse duration must be between 1 and 60000 ms");
      config.durationMs = durationMs;
      return;
    }
    if (target.type === "http-output" && config.action !== "send_request") throw new Error("HTTP output action must be send_request");
    if (target.type === "mqtt-output" && config.action !== "publish") throw new Error("MQTT output action must be publish");
    validateOutputBodyConfig(config, target.type);
    delete config.durationMs;
    return;
  }

  if (type === "send_transaction") {
    const recipientAddressBookId = typeof config.recipientAddressBookId === "string" ? config.recipientAddressBookId : "";
    if (!recipientAddressBookId || !getAddressBookEntryById(recipientAddressBookId)) throw new Error("Send transaction requires an address book recipient");
    const tokenId = typeof config.tokenId === "string" ? config.tokenId.trim() : "0x00";
    if (tokenId.toLowerCase() !== "0x00") throw new Error("Send transaction currently supports only native MINIMA tokenid 0x00");
    const amount = typeof config.amount === "string" ? config.amount.trim() : "";
    if (!isPositiveDecimal(amount)) throw new Error("Send transaction requires a positive amount");
    config.recipientAddressBookId = recipientAddressBookId;
    config.tokenId = "0x00";
    config.amount = amount;
  }
}

function nextRunAtForBlocks(blocks: { type: AutomationBlockType; config: unknown }[]) {
  const start = blocks[0];
  if (start.type !== "schedule_start") return null;
  const intervalSeconds = Number((start.config as { intervalSeconds?: unknown }).intervalSeconds);
  return Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? new Date(Date.now() + intervalSeconds * 1000).toISOString() : null;
}

function setStampBlock(workflowId: string, enabled: boolean) {
  const blocks = listAutomationBlocks(workflowId);
  const parent = blocks.find((block) => !block.parent_block_id && (block.type === "record_trigger_event" || block.type === "fetch_data_source"));
  if (!parent) {
    if (enabled) throw new Error("Add a record or fetch block before adding Integritas stamping");
    return undefined;
  }
  const existing = blocks.find((block) => block.type === "stamp_integritas" && block.parent_block_id === parent.id);
  if (enabled && existing) return existing;
  if (enabled) return createAutomationBlock(workflowId, { type: "stamp_integritas", config: {}, parentBlockId: parent.id });
  if (existing) deleteAutomationBlock(workflowId, existing.id);
  return undefined;
}

function validateBlockAttachment(workflowId: string, type: AutomationBlockType, parentBlockId: string | null) {
  if (type !== "stamp_integritas" && parentBlockId) throw new Error("Only Integritas stamp blocks can be attached to another block");
  if (type === "stamp_integritas" && !parentBlockId) throw new Error("Integritas stamp blocks must be attached to a record or fetch block");
  if (!parentBlockId) return;
  const parent = listAutomationBlocks(workflowId).find((block) => block.id === parentBlockId);
  if (!parent || parent.parent_block_id) throw new Error("Attached block parent not found");
  if (parent.type !== "record_trigger_event" && parent.type !== "fetch_data_source") throw new Error("Integritas can only be attached to record or fetch blocks");
  const existing = listAutomationBlocks(workflowId).find((block) => block.type === "stamp_integritas" && block.parent_block_id === parentBlockId);
  if (existing) throw new Error("This block already has an Integritas stamp attached");
}

function isAutomationBlockType(type: string): type is AutomationBlockType {
  return type === "manual_start"
    || type === "schedule_start"
    || type === "gpio_event_start"
    || type === "webhook_event_start"
    || type === "mqtt_event_start"
    || type === "record_trigger_event"
    || type === "fetch_data_source"
    || type === "if_payload_field_equals"
    || type === "wait"
    || type === "stamp_integritas"
    || type === "control_output"
    || type === "send_transaction";
}

function isOutputTarget(type: string) {
  return type === "gpio-output" || type === "http-output" || type === "mqtt-output";
}

function validateOutputBodyConfig(config: Record<string, unknown>, targetType: string) {
  const bodyMode = typeof config.bodyMode === "string" ? config.bodyMode : "workflow_context";
  if (bodyMode !== "custom" && bodyMode !== "workflow_context" && bodyMode !== "trigger_payload" && bodyMode !== "latest_data" && bodyMode !== "none") throw new Error("Output body mode is invalid");
  if (targetType === "mqtt-output" && bodyMode === "none") throw new Error("MQTT output requires a message body");
  config.bodyMode = bodyMode;
  if (bodyMode === "custom") {
    const text = typeof config.bodyTemplateText === "string" ? config.bodyTemplateText : JSON.stringify(config.bodyTemplate ?? {});
    try {
      JSON.parse(text) as unknown;
    } catch {
      throw new Error("Custom output body must be valid JSON");
    }
    config.bodyTemplateText = text;
  } else {
    delete config.bodyTemplateText;
    delete config.bodyTemplate;
  }
}

function isPositiveDecimal(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value)) return false;
  return Number(value) > 0;
}

function isSafeFieldPath(path: string) {
  return /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(path);
}

function validateFieldCondition(config: Record<string, unknown>, label: string) {
  if (config.source !== undefined && config.source !== "trigger" && config.source !== "data") throw new Error(`${label} source must be trigger or data`);
  const fieldPath = typeof config.fieldPath === "string" ? config.fieldPath.trim() : "";
  if (!fieldPath) throw new Error(`${label} requires a field path`);
  if (!isSafeFieldPath(fieldPath)) throw new Error("Field path can only contain letters, numbers, underscores, dashes, and dots");
  if (!isConditionOperator(config.operator)) throw new Error(`${label} requires a valid operator`);
  if (config.operator !== "exists" && config.operator !== "does_not_exist" && !Object.prototype.hasOwnProperty.call(config, "value")) throw new Error(`${label} requires a compare value`);
  config.fieldPath = fieldPath;
}

function isConditionOperator(value: unknown) {
  return value === "equals"
    || value === "not_equals"
    || value === "greater_than"
    || value === "greater_than_or_equals"
    || value === "less_than"
    || value === "less_than_or_equals"
    || value === "exists"
    || value === "does_not_exist";
}

function limitFromQuery(value: unknown, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, Math.trunc(parsed)));
}
