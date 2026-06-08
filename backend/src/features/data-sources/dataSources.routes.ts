import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { createDataSourceRead } from "../data-reads/dataReads.repository.js";
import { createDataSource, deleteDataSource, getDataSource, listDataSources, updateDataSourceReadResult } from "./dataSources.repository.js";
import { parseJsonApiConfig, readJsonApiSource, serializeDataSource } from "./dataSources.service.js";

export const dataSourcesRouter = Router();

dataSourcesRouter.get("/", (_req, res) => {
  res.json({ items: listDataSources().map(serializeDataSource) });
});

dataSourcesRouter.post("/", requireRole("admin"), (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" ? req.body.type : "json-api";
  const description = typeof req.body?.description === "string" ? req.body.description : "";

  if (!name) return res.status(400).json({ error: "name is required" });
  if (type !== "json-api" && type !== "internal-json-api") return res.status(400).json({ error: "Only JSON API sources are supported" });

  try {
    const config = parseJsonApiConfig(req.body?.config);
    const record = createDataSource({ name, type, description, config });
    return res.json({ item: serializeDataSource(record) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data source" });
  }
});

dataSourcesRouter.delete("/:id", requireRole("admin"), (req, res) => {
  deleteDataSource(req.params.id);
  res.json({ deleted: true });
});

dataSourcesRouter.post("/:id/read", requireRole("admin"), async (req, res) => {
  const record = getDataSource(req.params.id);
  if (!record) return res.status(404).json({ error: "Data source not found" });

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
