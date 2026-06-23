import mqtt, { type MqttClient } from "mqtt";
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
  const mqttSources = listDataSources().filter((source) => source.type === "mqtt");
  const activeIds = new Set(mqttSources.map((source) => source.id));

  for (const [sourceId, subscription] of subscriptions.entries()) {
    if (!activeIds.has(sourceId)) {
      subscription.client.end(true);
      subscriptions.delete(sourceId);
    }
  }

  for (const source of mqttSources) {
    try {
      const config = parseMqttConfig(JSON.parse(source.config) as unknown);
      const key = `${config.brokerUrl}|${config.topic}`;
      const existing = subscriptions.get(source.id);
      if (existing?.key === key) continue;

      existing?.client.end(true);
      subscriptions.set(source.id, { key, client: connectMqttSource(source, config) });
    } catch (error) {
      updateDataSourceReadResult(source.id, { error: error instanceof Error ? error.message : "Invalid MQTT source configuration" });
    }
  }
}

function connectMqttSource(source: DataSourceRecord, config: { brokerUrl: string; topic: string }) {
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
    handleMqttMessage(source, config, payload).catch((error: Error) => {
      updateDataSourceReadResult(source.id, { error: error.message });
      createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: `${config.brokerUrl} ${config.topic}`, triggerType: "mqtt", status: "failed", error: error.message });
    });
  });

  client.on("error", (error) => {
    updateDataSourceReadResult(source.id, { error: `MQTT connection error: ${error.message}` });
  });

  return client;
}

async function handleMqttMessage(source: DataSourceRecord, config: { brokerUrl: string; topic: string }, payload: Buffer) {
  const parsed = JSON.parse(payload.toString("utf8")) as unknown;
  const result = processMqttPayload(parsed);
  updateDataSourceReadResult(source.id, { hash: result.bytesHash, preview: result.preview });
  createDataSourceRead({ dataSourceId: source.id, sourceName: source.name, sourceUrl: `${config.brokerUrl} ${config.topic}`, triggerType: "mqtt", status: "success", hash: result.bytesHash, preview: result.preview });
}
