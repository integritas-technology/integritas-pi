import mqtt, { type MqttClient } from "mqtt";
import { dataSourceError, errorFromUnknown } from "../../shared/structured-error.js";
import { listEnabledEventWorkflows, type AutomationWorkflowRecord } from "../automation/automation.repository.js";
import { recordPushAutomationPayload } from "../automation/automation.service.js";
import { createDataSourceRead } from "../data-reads/dataReads.repository.js";
import { listDataSources, updateDataSourceReadResult, type DataSourceRecord } from "./dataSources.repository.js";
import { parseMqttConfig, processMqttPayload } from "./dataSources.service.js";

type Subscription = {
  key: string;
  client: MqttClient;
};

const subscriptions = new Map<string, Subscription>();

export function startMqttIngestion() {
  syncMqttDataSources();
}

export function stopMqttIngestion() {
  for (const subscription of subscriptions.values()) {
    subscription.client.end(true);
  }
  subscriptions.clear();
}

export function syncMqttDataSources() {
  const mqttSources = new Map(listDataSources().filter((source) => source.type === "mqtt").map((source) => [source.id, source]));
  const mqttWorkflows = new Map([...mqttSources.keys()].map((sourceId) => [sourceId, listEnabledEventWorkflows("mqtt_event_start", sourceId)[0]]).filter((entry): entry is [string, AutomationWorkflowRecord] => Boolean(entry[1])));
  const activeIds = new Set(mqttWorkflows.keys());

  for (const [sourceId, subscription] of subscriptions.entries()) {
    if (!activeIds.has(sourceId)) {
      subscription.client.end(true);
      subscriptions.delete(sourceId);
    }
  }

  for (const [sourceId, workflow] of mqttWorkflows.entries()) {
    const source = mqttSources.get(sourceId)!;
    try {
      const config = parseMqttConfig(JSON.parse(source.config) as unknown);
      const key = `${workflow.id}|${workflow.updated_at}|${config.brokerUrl}|${config.topic}`;
      const existing = subscriptions.get(source.id);
      if (existing?.key === key) continue;

      existing?.client.end(true);
      subscriptions.set(source.id, { key, client: connectMqttSource(source, workflow, config) });
    } catch (error) {
      updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "configuration_invalid", ...errorFromUnknown(error, "Invalid MQTT source configuration", { sourceId: source.id }), message: error instanceof Error ? error.message : "Invalid MQTT source configuration" }) });
    }
  }
}

function connectMqttSource(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: { brokerUrl: string; topic: string }) {
  const client = mqtt.connect(config.brokerUrl, {
    clientId: `integritas-pi-${source.id}`,
    reconnectPeriod: 5000
  });

  client.on("connect", () => {
    client.subscribe(config.topic, (error) => {
      if (error) updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "connection_failed", ...errorFromUnknown(error, "MQTT subscribe failed", { sourceId: source.id, topic: config.topic }), message: "MQTT subscribe failed" }) });
    });
  });

  client.on("message", (_topic, payload) => {
    handleMqttMessage(source, workflow, config, payload).catch((error: Error) => {
      if ("code" in error && (error.code === "WORKFLOW_ALREADY_RUNNING" || error.code === "WORKFLOW_COOLDOWN_ACTIVE" || error.code === "WORKFLOW_EVENT_INACTIVE")) return;
      console.error(`MQTT workflow ${workflow.id} failed for source ${source.id}: ${error.message}`);
    });
  });

  client.on("error", (error) => {
    updateDataSourceReadResult(source.id, { error: dataSourceError({ type: "connection_failed", ...errorFromUnknown(error, "MQTT connection error", { sourceId: source.id, brokerUrl: config.brokerUrl }), message: "MQTT connection error" }) });
  });

  return client;
}

async function handleMqttMessage(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: { brokerUrl: string; topic: string }, payload: Buffer) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString("utf8")) as unknown;
  } catch (error) {
    const details = dataSourceError({ type: "invalid_payload", ...errorFromUnknown(error, "MQTT payload was not valid JSON", { sourceId: source.id, topic: config.topic }), message: "MQTT payload was not valid JSON" });
    updateDataSourceReadResult(source.id, { error: details });
    createDataSourceRead({
      dataSourceId: source.id,
      workflowId: workflow.id,
      sourceName: source.name,
      sourceUrl: `${config.brokerUrl} ${config.topic}`,
      triggerType: "mqtt",
      status: "failed",
      error: details,
      triggerSourceId: source.id
    });
    return;
  }
  const result = processMqttPayload(parsed);
  await recordPushAutomationPayload({ workflow, dataSource: source, sourceUrl: `${config.brokerUrl} ${config.topic}`, triggerType: "mqtt", result });
}
