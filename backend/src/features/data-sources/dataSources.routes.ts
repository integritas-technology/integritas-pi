import { Router } from "express";
import { env } from "../../config/env.js";
import { requireRole } from "../auth/auth.middleware.js";
import { createDataSourceRead } from "../data-reads/dataReads.repository.js";
import { getEnabledAutomationWorkflowForDataSource } from "../automation/automation.repository.js";
import { recordPushAutomationPayload } from "../automation/automation.service.js";
import { createDataSource, deleteDataSource, findWebhookDataSource, getDataSource, listDataSources, updateDataSource, updateDataSourceReadResult } from "./dataSources.repository.js";
import { syncMqttDataSources } from "./mqttIngestion.service.js";
import { getGpioInputCapability, syncGpioDataSources } from "./gpioIngestion.service.js";
import { pulseGpioOutput } from "./gpioOutput.service.js";
import { publishMqttOutput } from "./mqttOutput.service.js";
import { getCameraCapability } from "./cameraCapture.service.js";
import { checkDataSourceHealth, parseDataSourceConfig, parseGpioInputConfig, parseGpioOutputConfig, parseHttpOutputConfig, parseJsonApiConfig, processWebhookPayload, readJsonApiSource, sendHttpOutput, serializeDataSource } from "./dataSources.service.js";

export const dataSourcesRouter = Router();
export const dataSourcesWebhookRouter = Router();

dataSourcesWebhookRouter.post("/:token", async (req, res) => {
  const record = findWebhookDataSource(req.params.token);
  if (!record) return res.status(404).json({ error: "Webhook data source not found" });
  const workflow = getEnabledAutomationWorkflowForDataSource(record.id);
  if (!workflow) return res.status(409).json({ error: "Webhook ingestion is disabled. Enable an automation workflow for this source to record incoming data." });

  try {
    const result = processWebhookPayload(req.body);
    const response = await recordPushAutomationPayload({ workflow, dataSource: record, sourceUrl: `/api/data-source-webhooks/${req.params.token}`, triggerType: "webhook", result });
    return res.json({ item: response.dataSource, workflow: response.workflow, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record webhook payload";
    return res.status(502).json({ error: message });
  }
});

dataSourcesRouter.get("/", (_req, res) => {
  res.json({ items: listDataSources().map(serializeDataSource) });
});

dataSourcesRouter.get("/capabilities", (_req, res) => {
  res.json({
    gpioInput: getGpioInputCapability(),
    mqttBroker: {
      enabled: env.mqttBrokerEnabled,
      internalUrl: env.mqttInternalUrl,
      publicHost: env.mqttPublicHost,
      publicPort: env.mqttPublicPort
    },
    camera: getCameraCapability()
  });
});

dataSourcesRouter.post("/", requireRole("admin"), (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" ? req.body.type : "json-api";
  const description = typeof req.body?.description === "string" ? req.body.description : "";

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!isSupportedDeviceType(type)) return res.status(400).json({ error: "Only HTTP JSON API, webhook, MQTT, GPIO input/output, Pi Camera, HTTP output, and MQTT output devices are supported" });
  if ((type === "gpio-input" || type === "gpio-output") && !getGpioInputCapability().available) return res.status(400).json({ error: getGpioInputCapability().reason });
  if (type === "pi-camera" && !getCameraCapability().available) return res.status(400).json({ error: getCameraCapability().reason });

  try {
    const config = parseDataSourceConfig(type, req.body?.config);
    validateGpioPinAvailable(type, config, null);
    const record = createDataSource({ name, type, description, config });
    syncMqttDataSources();
    syncGpioDataSources();
    return res.json({ item: serializeDataSource(record) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data source" });
  }
});

dataSourcesRouter.delete("/:id", requireRole("admin"), (req, res) => {
  deleteDataSource(req.params.id);
  syncMqttDataSources();
  syncGpioDataSources();
  res.json({ deleted: true });
});

dataSourcesRouter.patch("/:id", requireRole("admin"), (req, res) => {
  const existing = getDataSource(req.params.id);
  if (!existing) return res.status(404).json({ error: "Data source not found" });

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" ? req.body.type : "json-api";
  const description = typeof req.body?.description === "string" ? req.body.description : "";

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!isSupportedDeviceType(type)) return res.status(400).json({ error: "Only HTTP JSON API, webhook, MQTT, GPIO input/output, Pi Camera, HTTP output, and MQTT output devices are supported" });
  if ((type === "gpio-input" || type === "gpio-output") && !getGpioInputCapability().available) return res.status(400).json({ error: getGpioInputCapability().reason });
  if (type === "pi-camera" && !getCameraCapability().available) return res.status(400).json({ error: getCameraCapability().reason });

  try {
    const config = parseDataSourceConfig(type, req.body?.config, JSON.parse(existing.config) as unknown);
    validateGpioPinAvailable(type, config, existing.id);
    const record = updateDataSource(req.params.id, { name, type, description, config });
    syncMqttDataSources();
    syncGpioDataSources();
    return res.json({ item: serializeDataSource(record!) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid data source" });
  }
});

dataSourcesRouter.get("/:id/health", async (req, res) => {
  const record = getDataSource(req.params.id);
  if (!record) return res.status(404).json({ error: "Data source not found" });
  if (record.type === "webhook" || record.type === "mqtt" || record.type === "gpio-input" || record.type === "gpio-output" || record.type === "pi-camera" || record.type === "http-output" || record.type === "mqtt-output") return res.status(400).json({ error: "This device does not have a health URL" });

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
  if (record.type === "webhook" || record.type === "mqtt" || record.type === "gpio-input" || record.type === "gpio-output" || record.type === "pi-camera" || record.type === "http-output" || record.type === "mqtt-output") return res.status(400).json({ error: "This device cannot be read manually" });

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

dataSourcesRouter.post("/:id/test-output", requireRole("admin"), async (req, res) => {
  const record = getDataSource(req.params.id);
  if (!record) return res.status(404).json({ error: "Device not found" });

  try {
    const payload = req.body?.payload ?? { test: true, deviceId: record.id, deviceName: record.name, sentAt: new Date().toISOString() };
    const result = record.type === "gpio-output"
      ? await pulseGpioOutput({ targetId: record.id, durationMs: req.body?.durationMs === undefined ? 500 : Number(req.body.durationMs) })
      : record.type === "http-output"
        ? await sendHttpOutput(parseHttpOutputConfig(JSON.parse(record.config) as unknown), payload)
        : record.type === "mqtt-output"
          ? await publishMqttOutput({ targetId: record.id, payload })
          : null;
    if (!result) return res.status(400).json({ error: "Only output devices can be tested" });
    return res.json({ item: serializeDataSource(record), result });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Failed to test output" });
  }
});

function isSupportedDeviceType(type: string) {
  return type === "json-api" || type === "internal-json-api" || type === "webhook" || type === "mqtt" || type === "gpio-input" || type === "gpio-output" || type === "pi-camera" || type === "http-output" || type === "mqtt-output";
}

function validateGpioPinAvailable(type: string, config: unknown, currentId: string | null) {
  if (type !== "gpio-input" && type !== "gpio-output") return;
  const target = type === "gpio-input" ? parseGpioInputConfig(config) : parseGpioOutputConfig(config);

  for (const source of listDataSources()) {
    if (source.id === currentId || (source.type !== "gpio-input" && source.type !== "gpio-output")) continue;
    const sourceConfig = source.type === "gpio-input" ? parseGpioInputConfig(JSON.parse(source.config) as unknown) : parseGpioOutputConfig(JSON.parse(source.config) as unknown);
    if (sourceConfig.chip === target.chip && sourceConfig.pin === target.pin) throw new Error(`${target.chip} GPIO${target.pin} is already used by ${source.name}`);
  }
}
