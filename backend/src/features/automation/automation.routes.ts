import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
import { syncGpioDataSources } from "../data-sources/gpioIngestion.service.js";
import { syncMqttDataSources } from "../data-sources/mqttIngestion.service.js";
import { createAutomationBlock, createAutomationWorkflow, deleteAutomationBlock, deleteAutomationWorkflow, getAutomationWorkflow, listAutomationBlocks, listAutomationWorkflows, replaceAutomationBlocks, updateAutomationWorkflow, type AutomationBlockType } from "./automation.repository.js";
import { runAutomationWorkflow, serializeAutomationBlock, serializeAutomationWorkflow } from "./automation.service.js";

export const automationRouter = Router();

automationRouter.get("/workflows", (_req, res) => {
  res.json({ items: listAutomationWorkflows().map(serializeAutomationWorkflow) });
});

automationRouter.post("/workflows", requireRole("admin"), (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const dataSourceId = typeof req.body?.dataSourceId === "string" ? req.body.dataSourceId : "";
  const pollingIntervalSeconds = Number(req.body?.pollingIntervalSeconds);
  const enabled = Boolean(req.body?.enabled);
  const stampWithIntegritas = req.body?.stampWithIntegritas === true;

  if (!name) return res.status(400).json({ error: "name is required" });
  const dataSource = getDataSource(dataSourceId);
  if (!dataSource) return res.status(400).json({ error: "dataSourceId must reference an existing data source" });
  const isPushSource = dataSource.type === "webhook" || dataSource.type === "mqtt" || dataSource.type === "gpio-input";
  if (!isPushSource && (!Number.isFinite(pollingIntervalSeconds) || pollingIntervalSeconds < 10)) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  const workflow = createAutomationWorkflow({
    name,
    enabled,
    nextRunAt: enabled && !isPushSource ? new Date(Date.now() + pollingIntervalSeconds * 1000).toISOString() : null,
    blocks: legacyBlocksForWorkflow(dataSource.id, dataSource.type, isPushSource ? 0 : pollingIntervalSeconds, stampWithIntegritas)
  });
  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ item: serializeAutomationWorkflow(workflow) });
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
    const blocks = listAutomationBlocks(req.params.id).map((block) => ({ type: block.type, enabled: Boolean(block.enabled), config: block.type === "schedule_start" ? { intervalSeconds: nextPollingIntervalSeconds } : JSON.parse(block.config_json) as unknown }));
    replaceAutomationBlocks(req.params.id, blocks);
    if (enabled !== false) updateAutomationWorkflow(req.params.id, { nextRunAt: new Date(Date.now() + nextPollingIntervalSeconds * 1000).toISOString() });
  }

  if (typeof req.body?.stampWithIntegritas === "boolean") {
    setStampBlock(req.params.id, req.body.stampWithIntegritas);
  }

  syncMqttDataSources();
  syncGpioDataSources();
  return res.json({ item: serializeAutomationWorkflow(getAutomationWorkflow(workflow!.id)!) });
});

automationRouter.post("/workflows/:id/blocks", requireRole("admin"), (req, res) => {
  const workflow = getAutomationWorkflow(req.params.id);
  if (!workflow) return res.status(404).json({ error: "Automation workflow not found" });
  const type = typeof req.body?.type === "string" ? req.body.type as AutomationBlockType : "" as AutomationBlockType;
  try {
    const block = createAutomationBlock(workflow.id, { type, config: req.body?.config ?? {}, enabled: req.body?.enabled !== false });
    syncMqttDataSources();
    syncGpioDataSources();
    return res.json({ item: serializeAutomationBlock(block), workflow: serializeAutomationWorkflow(getAutomationWorkflow(workflow.id)!) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid block" });
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
  try {
    const result = await runAutomationWorkflow(req.params.id);
    return res.json(result);
  } catch (error) {
    const workflow = error && typeof error === "object" && "workflow" in error ? (error as { workflow: unknown }).workflow : null;
    return res.status(502).json({ error: error instanceof Error ? error.message : "Automation workflow failed", workflow });
  }
});

function legacyBlocksForWorkflow(sourceId: string, sourceType: string, pollingIntervalSeconds: number, stampWithIntegritas: boolean) {
  const blocks: { type: AutomationBlockType; config: unknown }[] = [];
  if (sourceType === "gpio-input") blocks.push({ type: "gpio_event_start", config: { sourceId, activeOnly: false } }, { type: "record_trigger_event", config: {} });
  else if (sourceType === "webhook") blocks.push({ type: "webhook_event_start", config: { sourceId } }, { type: "record_trigger_event", config: {} });
  else if (sourceType === "mqtt") blocks.push({ type: "mqtt_event_start", config: { sourceId } }, { type: "record_trigger_event", config: {} });
  else blocks.push({ type: "schedule_start", config: { intervalSeconds: pollingIntervalSeconds } }, { type: "fetch_data_source", config: { sourceId } });
  if (stampWithIntegritas) blocks.push({ type: "stamp_integritas", config: {} });
  return blocks;
}

function setStampBlock(workflowId: string, enabled: boolean) {
  const blocks = listAutomationBlocks(workflowId);
  const existing = blocks.find((block) => block.type === "stamp_integritas");
  if (enabled && existing) return existing;
  if (enabled) return createAutomationBlock(workflowId, { type: "stamp_integritas", config: {} });
  if (existing) deleteAutomationBlock(workflowId, existing.id);
  return undefined;
}
