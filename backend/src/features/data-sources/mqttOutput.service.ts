import mqtt from "mqtt";
import { getDataSource } from "./dataSources.repository.js";
import { parseMqttOutputConfig } from "./dataSources.service.js";

export async function publishMqttOutput(input: { targetId: string; payload: unknown }) {
  const source = getDataSource(input.targetId);
  if (!source) throw new Error("MQTT output target not found");
  if (source.type !== "mqtt-output") throw new Error("Control output block requires an MQTT output target");

  const config = parseMqttOutputConfig(JSON.parse(source.config) as unknown);
  const payload = config.payloadTemplate === undefined ? input.payload : config.payloadTemplate;
  const body = JSON.stringify(payload);

  await new Promise<void>((resolve, reject) => {
    const client = mqtt.connect(config.brokerUrl, { reconnectPeriod: 0, connectTimeout: 5000 });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      client.end(true, () => error ? reject(error) : resolve());
    };

    client.on("connect", () => {
      client.publish(config.topic, body, { qos: config.qos, retain: config.retain }, (error) => finish(error ?? undefined));
    });
    client.on("error", (error) => finish(new Error(`MQTT output publish failed: ${error.message}`)));
  });

  return { targetId: source.id, targetName: source.name, brokerUrl: config.brokerUrl, topic: config.topic, qos: config.qos, retain: config.retain, publishedAt: new Date().toISOString() };
}
