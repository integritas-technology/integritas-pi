import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { createAutomationWorkflow, deleteAutomationWorkflow, getAutomationWorkflow, getEnabledAutomationWorkflowForDataSource, listAutomationWorkflows, updateAutomationWorkflow } from "./automation.repository.js";
import { runAutomationWorkflow, serializeAutomationWorkflow } from "./automation.service.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
import { syncMqttDataSources } from "../data-sources/mqttIngestion.service.js";

export const automationRouter = Router();

automationRouter.get("/workflows", (_req, res) => {
  res.json({ items: listAutomationWorkflows().map(serializeAutomationWorkflow) });
});

automationRouter.post("/workflows", requireRole("admin"), (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const dataSourceId = typeof req.body?.dataSourceId === "string" ? req.body.dataSourceId : "";
  const pollingIntervalSeconds = Number(req.body?.pollingIntervalSeconds);
  const enabled = Boolean(req.body?.enabled);
  const stampWithIntegritas = req.body?.stampWithIntegritas !== false;

  if (!name) return res.status(400).json({ error: "name is required" });
  const dataSource = getDataSource(dataSourceId);
  if (!dataSource) return res.status(400).json({ error: "dataSourceId must reference an existing data source" });
  const isPushSource = dataSource.type === "webhook" || dataSource.type === "mqtt";
  if (isPushSource && enabled && getEnabledAutomationWorkflowForDataSource(dataSource.id)) return res.status(409).json({ error: "This push source already has an enabled automation workflow" });
  if (!isPushSource && (!Number.isFinite(pollingIntervalSeconds) || pollingIntervalSeconds < 10)) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  const workflow = createAutomationWorkflow({ name, dataSourceId, enabled, pollingIntervalSeconds: isPushSource ? 0 : pollingIntervalSeconds, stampWithIntegritas });
  syncMqttDataSources();
  return res.json({ item: serializeAutomationWorkflow(workflow) });
});

automationRouter.patch("/workflows/:id", requireRole("admin"), (req, res) => {
  const current = getAutomationWorkflow(req.params.id);
  if (!current) return res.status(404).json({ error: "Automation workflow not found" });
  const dataSource = getDataSource(current.data_source_id);
  if (!dataSource) return res.status(400).json({ error: "Workflow data source no longer exists" });
  const isPushSource = dataSource.type === "webhook" || dataSource.type === "mqtt";
  const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
  if (isPushSource && enabled) {
    const existing = getEnabledAutomationWorkflowForDataSource(dataSource.id);
    if (existing && existing.id !== current.id) return res.status(409).json({ error: "This push source already has an enabled automation workflow" });
  }
  const nextPollingIntervalSeconds = Number.isFinite(Number(req.body?.pollingIntervalSeconds)) ? Number(req.body.pollingIntervalSeconds) : undefined;
  if (!isPushSource && nextPollingIntervalSeconds !== undefined && nextPollingIntervalSeconds < 10) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  const workflow = updateAutomationWorkflow(req.params.id, {
    name: typeof req.body?.name === "string" ? req.body.name.trim() : undefined,
    enabled,
    pollingIntervalSeconds: isPushSource ? 0 : nextPollingIntervalSeconds,
    stampWithIntegritas: typeof req.body?.stampWithIntegritas === "boolean" ? req.body.stampWithIntegritas : undefined
  });
  syncMqttDataSources();
  return res.json({ item: serializeAutomationWorkflow(workflow!) });
});

automationRouter.delete("/workflows/:id", requireRole("admin"), (req, res) => {
  deleteAutomationWorkflow(req.params.id);
  syncMqttDataSources();
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
