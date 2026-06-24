import crypto from "node:crypto";
import { sha3HashHex } from "../../shared/crypto.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import type { DataSourceRecord } from "./dataSources.repository.js";

export type JsonApiConfig = {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  healthStatusUrl?: string;
  body?: unknown;
};

export type WebhookConfig = {
  webhookToken: string;
};

export type MqttConfig = {
  brokerUrl: string;
  topic: string;
};

export type GpioInputConfig = {
  chip: string;
  pin: number;
  pull: "off" | "up" | "down";
  edge: "rising" | "falling" | "both";
  debounceMs: number;
  activeState: "high" | "low";
};

export function serializeDataSource(record: DataSourceRecord) {
  return {
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    name: record.name,
    type: record.type,
    status: record.status,
    description: record.description,
    config: JSON.parse(record.config) as unknown,
    lastReadAt: record.last_read_at,
    lastError: record.last_error,
    lastPreview: record.last_preview ? JSON.parse(record.last_preview) as unknown : null,
    lastHash: record.last_hash
  };
}

export function parseJsonApiConfig(value: unknown): JsonApiConfig {
  const config = value as Partial<JsonApiConfig> | undefined;
  const url = typeof config?.url === "string" ? config.url.trim() : "";
  const method = config?.method === "POST" ? "POST" : "GET";
  const headers = config?.headers && typeof config.headers === "object" && !Array.isArray(config.headers) ? config.headers as Record<string, string> : {};
  const healthStatusUrl = typeof config?.healthStatusUrl === "string" ? config.healthStatusUrl.trim() : "";

  if (!url) throw new Error("config.url is required");

  return { url, method, headers, healthStatusUrl: healthStatusUrl || undefined, body: config?.body };
}

export function parseDataSourceConfig(type: string, value: unknown, existingConfig?: unknown) {
  if (type === "webhook") return parseWebhookConfig(value, existingConfig);
  if (type === "mqtt") return parseMqttConfig(value);
  if (type === "gpio-input") return parseGpioInputConfig(value);
  return parseJsonApiConfig(value);
}

export function parseWebhookConfig(value: unknown, existingConfig?: unknown): WebhookConfig {
  const config = value as Partial<WebhookConfig> | undefined;
  const existing = existingConfig as Partial<WebhookConfig> | undefined;
  const webhookToken = typeof config?.webhookToken === "string" && config.webhookToken ? config.webhookToken : typeof existing?.webhookToken === "string" && existing.webhookToken ? existing.webhookToken : crypto.randomUUID();
  return { webhookToken };
}

export function parseMqttConfig(value: unknown): MqttConfig {
  const config = value as Partial<MqttConfig> | undefined;
  const brokerUrl = typeof config?.brokerUrl === "string" ? config.brokerUrl.trim() : "";
  const topic = typeof config?.topic === "string" ? config.topic.trim() : "";
  if (!brokerUrl) throw new Error("config.brokerUrl is required");
  if (!topic) throw new Error("config.topic is required");
  return { brokerUrl, topic };
}

export function parseGpioInputConfig(value: unknown): GpioInputConfig {
  const config = value as Partial<GpioInputConfig> | undefined;
  const chip = typeof config?.chip === "string" && config.chip.trim() ? config.chip.trim() : "gpiochip0";
  const pin = Number(config?.pin);
  const pull = config?.pull === "up" || config?.pull === "down" || config?.pull === "off" ? config.pull : "off";
  const edge = config?.edge === "rising" || config?.edge === "falling" || config?.edge === "both" ? config.edge : "both";
  const debounceMs = Number(config?.debounceMs ?? 100);
  const activeState = config?.activeState === "low" ? "low" : "high";

  if (!/^gpiochip\d+$/.test(chip) && !/^\/dev\/gpiochip\d+$/.test(chip)) throw new Error("config.chip must be gpiochipN or /dev/gpiochipN");
  if (!Number.isInteger(pin) || pin < 0 || pin > 27) throw new Error("config.pin must be a BCM GPIO number from 0 to 27");
  if (!Number.isFinite(debounceMs) || debounceMs < 0 || debounceMs > 60000) throw new Error("config.debounceMs must be between 0 and 60000");

  return { chip, pin, pull, edge, debounceMs, activeState };
}

export async function checkDataSourceHealth(config: JsonApiConfig) {
  if (!config.healthStatusUrl) throw new Error("Data source has no health status URL configured");
  const { response, body } = await fetchJsonWithTimeout(config.healthStatusUrl);
  return { ok: response.ok, status: response.status, source: config.healthStatusUrl, body, checkedAt: new Date().toISOString() };
}

export async function readJsonApiSource(config: JsonApiConfig) {
  let response: Response;

  try {
    response = await fetch(config.url, {
      method: config.method,
      headers: { ...config.headers, "Content-Type": "application/json" },
      body: config.method === "POST" && config.body !== undefined ? JSON.stringify(config.body) : undefined
    });
  } catch (error) {
    throw new Error(`Could not fetch ${config.url}: ${describeFetchError(error)}`);
  }

  const text = await response.text();
  let json: unknown;

  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Response was not valid JSON");
  }

  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);

  const canonical = `${JSON.stringify(json, null, 2)}\n`;
  return { contentType: "application/json", bytesHash: sha3HashHex(canonical), canonicalBytes: canonical, preview: json, fetchedAt: new Date().toISOString() };
}

export function processWebhookPayload(payload: unknown) {
  const canonical = `${JSON.stringify(payload, null, 2)}\n`;
  return { contentType: "application/json", bytesHash: sha3HashHex(canonical), canonicalBytes: canonical, preview: payload, receivedAt: new Date().toISOString() };
}

export function processMqttPayload(payload: unknown) {
  const canonical = `${JSON.stringify(payload, null, 2)}\n`;
  return { contentType: "application/json", bytesHash: sha3HashHex(canonical), canonicalBytes: canonical, preview: payload, receivedAt: new Date().toISOString() };
}

export function processGpioPayload(payload: unknown) {
  const canonical = `${JSON.stringify(payload, null, 2)}\n`;
  return { contentType: "application/json", bytesHash: sha3HashHex(canonical), canonicalBytes: canonical, preview: payload, receivedAt: new Date().toISOString() };
}

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const details = cause as { code?: string; address?: string; port?: number; message?: string };
    return [details.code, details.address, details.port, details.message].filter(Boolean).join(" ") || error.message;
  }
  return error.message;
}
