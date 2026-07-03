import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
import { parseGpioOutputConfig } from "../data-sources/dataSources.service.js";
import { syncGpioDataSources } from "../data-sources/gpioIngestion.service.js";
import { syncMqttDataSources } from "../data-sources/mqttIngestion.service.js";
import { createAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationWorkflow, getAutomationWorkflow, listAutomationBlocks, listAutomationWorkflows, reorderAutomationBlocks, updateAutomationBlock, updateAutomationWorkflow, type AutomationBlockType } from "./automation.repository.js";
import { getSerializedAutomationRun, listSerializedAutomationRuns, listSerializedAutomationRunsForWorkflow, runAutomationWorkflow, serializeAutomationBlock, serializeAutomationWorkflow } from "./automation.service.js";

export const automationRouter = Router();

automationRouter.get("/workflows", (_req, res) => {
  res.json({ items: listAutomationWorkflows().map(serializeAutomationWorkflow) });
});

automationRouter.get("/runs", (req, res) => {
  const limit = limitFromQuery(req.query.limit, 100);
  res.json({ items: listSerializedAutomationRuns(limit) });
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
  const nextPollingIntervalSeconds = Number.isFinite(Number(req.body?.pollingIntervalSeconds)) ? Number(req.body.pollingIntervalSeconds) : undefined;

  if (nextPollingIntervalSeconds !== undefined && serialized.pollingIntervalSeconds > 0 && nextPollingIntervalSeconds < 10) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  const workflow = updateAutomationWorkflow(req.params.id, {
    name: typeof req.body?.name === "string" ? req.body.name.trim() : undefined,
    enabled,
    nextRunAt: enabled === false ? null : undefined
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
    const block = item as { type?: unknown; config?: unknown; enabled?: unknown };
    const type = typeof block.type === "string" ? block.type : "";
    if (!isAutomationBlockType(type)) throw new Error(`Invalid block type: ${type || "missing"}`);
    const config = block.config && typeof block.config === "object" && !Array.isArray(block.config) ? block.config as Record<string, unknown> : {};
    validateBlockConfig(type, config);
    return { type, config, enabled: block.enabled === false ? false : true };
  });

  if (!blocks[0].type.endsWith("_start")) throw new Error("The first workflow block must be a start block");
  if (blocks.slice(1).some((block) => block.type.endsWith("_start"))) throw new Error("Only the first workflow block can be a start block");
  return blocks;
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
    if (type === "fetch_data_source" && (source.type === "gpio-input" || source.type === "gpio-output" || source.type === "webhook" || source.type === "mqtt")) throw new Error("Fetch block requires an HTTP JSON source");
    return;
  }

  if (type === "wait") {
    const durationMs = Number(config.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 60000) throw new Error("Wait block requires durationMs between 0 and 60000");
    config.durationMs = durationMs;
  }

  if (type === "if_payload_field_equals") {
    validateFieldEqualsCondition(config, "Condition block");
    return;
  }

  if (type === "stamp_integritas") {
    if (config.condition === undefined || config.condition === null) return;
    if (typeof config.condition !== "object" || Array.isArray(config.condition)) throw new Error("Stamp condition must be an object");
    validateFieldEqualsCondition(config.condition as Record<string, unknown>, "Stamp condition");
    return;
  }

  if (type === "control_output") {
    const targetId = typeof config.targetId === "string" ? config.targetId : "";
    const target = getDataSource(targetId);
    if (!target || target.type !== "gpio-output") throw new Error("Control output requires a GPIO output target");
    const targetConfig = parseGpioOutputConfig(JSON.parse(target.config) as unknown);
    if (targetConfig.profile !== "led") throw new Error("Only LED output targets are supported");
    if (config.action !== "pulse") throw new Error("Only pulse output actions are supported");
    const durationMs = Number(config.durationMs);
    if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > 60000) throw new Error("Pulse duration must be between 1 and 60000 ms");
    config.durationMs = durationMs;
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
    || type === "control_output";
}

function isSafeFieldPath(path: string) {
  return /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(path);
}

function validateFieldEqualsCondition(config: Record<string, unknown>, label: string) {
  if (config.source !== undefined && config.source !== "trigger" && config.source !== "data") throw new Error(`${label} source must be trigger or data`);
  const fieldPath = typeof config.fieldPath === "string" ? config.fieldPath.trim() : "";
  if (!fieldPath) throw new Error(`${label} requires a field path`);
  if (!isSafeFieldPath(fieldPath)) throw new Error("Field path can only contain letters, numbers, underscores, dashes, and dots");
  if (!Object.prototype.hasOwnProperty.call(config, "equals")) throw new Error(`${label} requires an equals value`);
  config.fieldPath = fieldPath;
}

function limitFromQuery(value: unknown, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, Math.trunc(parsed)));
}
