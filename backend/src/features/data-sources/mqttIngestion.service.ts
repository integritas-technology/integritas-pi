import mqtt, { type MqttClient } from "mqtt";
import { listEnabledEventWorkflows, type AutomationWorkflowRecord } from "../automation/automation.repository.js";
import { recordPushAutomationError, recordPushAutomationPayload } from "../automation/automation.service.js";
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
      updateDataSourceReadResult(source.id, { error: error instanceof Error ? error.message : "Invalid MQTT source configuration" });
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
      if (error) updateDataSourceReadResult(source.id, { error: `MQTT subscribe failed: ${error.message}` });
    });
  });

  client.on("message", (_topic, payload) => {
    handleMqttMessage(source, workflow, config, payload).catch((error: Error) => {
      recordPushAutomationError({ workflow, dataSource: source, sourceUrl: `${config.brokerUrl} ${config.topic}`, triggerType: "mqtt", error: error.message });
    });
  });

  client.on("error", (error) => {
    updateDataSourceReadResult(source.id, { error: `MQTT connection error: ${error.message}` });
  });

  return client;
}

async function handleMqttMessage(source: DataSourceRecord, workflow: AutomationWorkflowRecord, config: { brokerUrl: string; topic: string }, payload: Buffer) {
  const parsed = JSON.parse(payload.toString("utf8")) as unknown;
  const result = processMqttPayload(parsed);
  await recordPushAutomationPayload({ workflow, dataSource: source, sourceUrl: `${config.brokerUrl} ${config.topic}`, triggerType: "mqtt", result });
}
