import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { createDataSourceRead } from "../data-reads/dataReads.repository.js";
import { createDataSource, deleteDataSource, findWebhookDataSource, getDataSource, listDataSources, updateDataSource, updateDataSourceReadResult } from "./dataSources.repository.js";
import { syncMqttDataSources } from "./mqttIngestion.service.js";
import { checkDataSourceHealth, parseDataSourceConfig, parseJsonApiConfig, processWebhookPayload, readJsonApiSource, serializeDataSource } from "./dataSources.service.js";

export const dataSourcesRouter = Router();
export const dataSourcesWebhookRouter = Router();

dataSourcesWebhookRouter.post("/:token", (req, res) => {
  const record = findWebhookDataSource(req.params.token);
  if (!record) return res.status(404).json({ error: "Webhook data source not found" });

  const result = processWebhookPayload(req.body);
  const updated = updateDataSourceReadResult(record.id, { hash: result.bytesHash, preview: result.preview });
  createDataSourceRead({ dataSourceId: record.id, sourceName: record.name, sourceUrl: `/api/data-source-webhooks/${req.params.token}`, triggerType: "webhook", status: "success", hash: result.bytesHash, preview: result.preview });
  return res.json({ item: serializeDataSource(updated), result });
});

dataSourcesRouter.get("/", (_req, res) => {
  res.json({ items: listDataSources().map(serializeDataSource) });
});

dataSourcesRouter.post("/", requireRole("admin"), (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" ? req.body.type : "json-api";
  const description = typeof req.body?.description === "string" ? req.body.description : "";

  if (!name) return res.status(400).json({ error: "name is required" });
  if (type !== "json-api" && type !== "internal-json-api" && type !== "webhook" && type !== "mqtt") return res.status(400).json({ error: "Only HTTP JSON API, webhook, and MQTT sources are supported" });

  try {
    const config = parseDataSourceConfig(type, req.body?.config);
    const record = createDataSource({ name, type, description, config });
    syncMqttDataSources();
    return res.json({ item: serializeDataSource(record) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data source" });
  }
});

dataSourcesRouter.delete("/:id", requireRole("admin"), (req, res) => {
  deleteDataSource(req.params.id);
  syncMqttDataSources();
  res.json({ deleted: true });
});

dataSourcesRouter.patch("/:id", requireRole("admin"), (req, res) => {
  const existing = getDataSource(req.params.id);
  if (!existing) return res.status(404).json({ error: "Data source not found" });

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" ? req.body.type : "json-api";
  const description = typeof req.body?.description === "string" ? req.body.description : "";

  if (!name) return res.status(400).json({ error: "name is required" });
  if (type !== "json-api" && type !== "internal-json-api" && type !== "webhook" && type !== "mqtt") return res.status(400).json({ error: "Only HTTP JSON API, webhook, and MQTT sources are supported" });

  try {
    const config = parseDataSourceConfig(type, req.body?.config, JSON.parse(existing.config) as unknown);
    const record = updateDataSource(req.params.id, { name, type, description, config });
    syncMqttDataSources();
    return res.json({ item: serializeDataSource(record!) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data source" });
  }
});

dataSourcesRouter.get("/:id/health", async (req, res) => {
  const record = getDataSource(req.params.id);
  if (!record) return res.status(404).json({ error: "Data source not found" });
  if (record.type === "webhook" || record.type === "mqtt") return res.status(400).json({ error: "Push sources do not have a health URL" });

  try {
    const config = parseJsonApiConfig(JSON.parse(record.config) as unknown);
    const result = await checkDataSourceHealth(config);
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Failed to check data source health" });
  }
});

dataSourcesRouter.post("/:id/read", requireRole("admin"), async (req, res) => {
  const record = getDataSource(req.params.id);
  if (!record) return res.status(404).json({ error: "Data source not found" });
  if (record.type === "webhook" || record.type === "mqtt") return res.status(400).json({ error: "Push sources receive data and cannot be triggered manually" });

  try {
    const config = parseJsonApiConfig(JSON.parse(record.config) as unknown);
    const result = await readJsonApiSource(config);
    const updated = updateDataSourceReadResult(req.params.id, { hash: result.bytesHash, preview: result.preview });
    createDataSourceRead({ dataSourceId: record.id, sourceName: record.name, sourceUrl: config.url, triggerType: "manual", status: "success", hash: result.bytesHash, preview: result.preview });
    return res.json({ item: serializeDataSource(updated), result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read data source";
    const config = parseJsonApiConfig(JSON.parse(record.config) as unknown);
    const updated = updateDataSourceReadResult(req.params.id, { error: message });
    createDataSourceRead({ dataSourceId: record.id, sourceName: record.name, sourceUrl: config.url, triggerType: "manual", status: "failed", error: message });
    return res.status(502).json({ error: updated.last_error, item: serializeDataSource(updated) });
  }
});
