import { Router } from "express";
import { createAutomationWorkflow, deleteAutomationWorkflow, getAutomationWorkflow, listAutomationWorkflows, updateAutomationWorkflow } from "./automation.repository.js";
import { runAutomationWorkflow, serializeAutomationWorkflow } from "./automation.service.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";

export const automationRouter = Router();

automationRouter.get("/workflows", (_req, res) => {
  res.json({ items: listAutomationWorkflows().map(serializeAutomationWorkflow) });
});

automationRouter.post("/workflows", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const dataSourceId = typeof req.body?.dataSourceId === "string" ? req.body.dataSourceId : "";
  const pollingIntervalSeconds = Number(req.body?.pollingIntervalSeconds);
  const enabled = Boolean(req.body?.enabled);
  const stampWithIntegritas = req.body?.stampWithIntegritas !== false;

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!getDataSource(dataSourceId)) return res.status(400).json({ error: "dataSourceId must reference an existing data source" });
  if (!Number.isFinite(pollingIntervalSeconds) || pollingIntervalSeconds < 10) return res.status(400).json({ error: "pollingIntervalSeconds must be at least 10" });

  const workflow = createAutomationWorkflow({ name, dataSourceId, enabled, pollingIntervalSeconds, stampWithIntegritas });
  return res.json({ item: serializeAutomationWorkflow(workflow) });
});

automationRouter.patch("/workflows/:id", (req, res) => {
  const current = getAutomationWorkflow(req.params.id);
  if (!current) return res.status(404).json({ error: "Automation workflow not found" });

  const workflow = updateAutomationWorkflow(req.params.id, {
    name: typeof req.body?.name === "string" ? req.body.name.trim() : undefined,
    enabled: typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined,
    pollingIntervalSeconds: Number.isFinite(Number(req.body?.pollingIntervalSeconds)) ? Number(req.body.pollingIntervalSeconds) : undefined,
    stampWithIntegritas: typeof req.body?.stampWithIntegritas === "boolean" ? req.body.stampWithIntegritas : undefined
  });
  return res.json({ item: serializeAutomationWorkflow(workflow!) });
});

automationRouter.delete("/workflows/:id", (req, res) => {
  deleteAutomationWorkflow(req.params.id);
  res.json({ deleted: true });
});

automationRouter.post("/workflows/:id/run", async (req, res) => {
  try {
    const result = await runAutomationWorkflow(req.params.id);
    return res.json(result);
  } catch (error) {
    const workflow = error && typeof error === "object" && "workflow" in error ? (error as { workflow: unknown }).workflow : null;
    return res.status(502).json({ error: error instanceof Error ? error.message : "Automation workflow failed", workflow });
  }
});
