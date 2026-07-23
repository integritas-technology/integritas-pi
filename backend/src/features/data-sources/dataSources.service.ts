import crypto from "node:crypto";
import { sha3HashHex } from "../../shared/crypto.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import { errorMessage, parseStoredError } from "../../shared/structured-error.js";
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

export type HttpOutputConfig = {
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type MqttOutputConfig = {
  brokerUrl: string;
  topic: string;
  qos: 0 | 1;
  retain: boolean;
};

export type GpioInputConfig = {
  chip: string;
  pin: number;
  profile: "generic" | "pir-motion";
  pull: "off" | "up" | "down";
  edge: "rising" | "falling" | "both";
  debounceMs: number;
  activeState: "high" | "low";
};

export type GpioOutputConfig = {
  chip: string;
  pin: number;
  profile: "led";
  activeState: "high" | "low";
  initialState: "inactive";
};

export type PiCameraConfig = {
  mode: "photo" | "video";
  width: number;
  height: number;
  durationMs: number;
  fps: number;
  outputFormat: "jpg" | "h264";
};

export function serializeDataSource(record: DataSourceRecord) {
  const lastErrorDetails = parseStoredError(record.last_error);
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
    lastError: errorMessage(record.last_error),
    lastErrorDetails,
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
  if (type === "http-output") return parseHttpOutputConfig(value);
  if (type === "mqtt-output") return parseMqttOutputConfig(value);
  if (type === "gpio-input") return parseGpioInputConfig(value);
  if (type === "gpio-output") return parseGpioOutputConfig(value);
  if (type === "pi-camera") return parsePiCameraConfig(value);
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

export function parseHttpOutputConfig(value: unknown): HttpOutputConfig {
  const config = value as Partial<HttpOutputConfig> | undefined;
  const url = typeof config?.url === "string" ? config.url.trim() : "";
  const method = config?.method === "PUT" || config?.method === "PATCH" ? config.method : "POST";
  const headers = config?.headers && typeof config.headers === "object" && !Array.isArray(config.headers) ? config.headers as Record<string, string> : {};
  const timeoutMs = Number(config?.timeoutMs ?? 5000);

  if (!url) throw new Error("config.url is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error("config.timeoutMs must be between 100 and 60000");

  return { url, method, headers, timeoutMs };
}

export function parseMqttOutputConfig(value: unknown): MqttOutputConfig {
  const config = value as Partial<MqttOutputConfig> | undefined;
  const brokerUrl = typeof config?.brokerUrl === "string" ? config.brokerUrl.trim() : "";
  const topic = typeof config?.topic === "string" ? config.topic.trim() : "";
  const qos = config?.qos === 1 ? 1 : 0;
  const retain = config?.retain === true;

  if (!brokerUrl) throw new Error("config.brokerUrl is required");
  if (!topic) throw new Error("config.topic is required");

  return { brokerUrl, topic, qos, retain };
}

export function parseGpioInputConfig(value: unknown): GpioInputConfig {
  const config = value as Partial<GpioInputConfig> | undefined;
  const chip = typeof config?.chip === "string" && config.chip.trim() ? config.chip.trim() : "gpiochip0";
  const pin = Number(config?.pin);
  const profile = config?.profile === "pir-motion" ? "pir-motion" : "generic";
  const pull = config?.pull === "up" || config?.pull === "down" || config?.pull === "off" ? config.pull : "off";
  const edge = config?.edge === "rising" || config?.edge === "falling" || config?.edge === "both" ? config.edge : "both";
  const debounceMs = Number(config?.debounceMs ?? 100);
  const activeState = config?.activeState === "low" ? "low" : "high";

  if (!/^gpiochip\d+$/.test(chip) && !/^\/dev\/gpiochip\d+$/.test(chip)) throw new Error("config.chip must be gpiochipN or /dev/gpiochipN");
  if (!Number.isInteger(pin) || pin < 0 || pin > 27) throw new Error("config.pin must be a BCM GPIO number from 0 to 27");
  if (!Number.isFinite(debounceMs) || debounceMs < 0 || debounceMs > 60000) throw new Error("config.debounceMs must be between 0 and 60000");

  return { chip, pin, profile, pull, edge, debounceMs, activeState };
}

export function parseGpioOutputConfig(value: unknown): GpioOutputConfig {
  const config = value as Partial<GpioOutputConfig> | undefined;
  const chip = typeof config?.chip === "string" && config.chip.trim() ? config.chip.trim() : "gpiochip0";
  const pin = Number(config?.pin);
  const profile = config?.profile === "led" ? config.profile : "led";
  const activeState = config?.activeState === "low" ? "low" : "high";
  const initialState = "inactive";

  if (!/^gpiochip\d+$/.test(chip) && !/^\/dev\/gpiochip\d+$/.test(chip)) throw new Error("config.chip must be gpiochipN or /dev/gpiochipN");
  if (!Number.isInteger(pin) || pin < 0 || pin > 27) throw new Error("config.pin must be a BCM GPIO number from 0 to 27");

  return { chip, pin, profile, activeState, initialState };
}

export function parsePiCameraConfig(value: unknown): PiCameraConfig {
  const config = value as Partial<PiCameraConfig> | undefined;
  const mode = config?.mode === "video" ? "video" : "photo";
  const width = Number(config?.width ?? 1280);
  const height = Number(config?.height ?? 720);
  const durationMs = Number(config?.durationMs ?? (mode === "video" ? 5000 : 1000));
  const fps = Number(config?.fps ?? 30);
  const outputFormat = mode === "video" ? "h264" : "jpg";

  if (!Number.isInteger(width) || width < 160 || width > 7680) throw new Error("config.width must be between 160 and 7680");
  if (!Number.isInteger(height) || height < 120 || height > 4320) throw new Error("config.height must be between 120 and 4320");
  if (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > 300000) throw new Error("config.durationMs must be between 100 and 300000");
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error("config.fps must be between 1 and 120");

  return { mode, width, height, durationMs, fps, outputFormat };
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

export async function sendHttpOutput(config: HttpOutputConfig, payload: unknown, hasBody = true) {
  const { response, body: responseBody } = await fetchJsonWithTimeout(config.url, {
    method: config.method,
    headers: { ...config.headers, "Content-Type": "application/json" },
    body: hasBody ? JSON.stringify(payload) : undefined
  }, config.timeoutMs ?? 5000);

  if (!response.ok) throw new Error(`HTTP output returned HTTP ${response.status}${responseBody === null ? "" : `: ${JSON.stringify(responseBody)}`}`);

  return { targetUrl: config.url, method: config.method, status: response.status, response: responseBody, sentAt: new Date().toISOString() };
}

export async function sendMultipartMediaOutput(config: HttpOutputConfig, input: { fileFieldName: string; fileName: string; mediaType: string; bytes: Buffer; jsonFieldName?: string; jsonPayload?: unknown }) {
  const form = new FormData();
  const fileBytes = input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer;
  if (input.jsonFieldName) form.append(input.jsonFieldName, JSON.stringify(input.jsonPayload ?? {}));
  form.append(input.fileFieldName, new Blob([fileBytes], { type: input.mediaType }), input.fileName);

  const headers = Object.fromEntries(Object.entries(config.headers ?? {}).filter(([key]) => key.toLowerCase() !== "content-type"));
  const response = await fetch(config.url, {
    method: config.method,
    headers,
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs ?? 5000)
  });
  const responseBody = await response.json().catch(() => null) as unknown;

  if (!response.ok) throw new Error(`HTTP output returned HTTP ${response.status}${responseBody === null ? "" : `: ${JSON.stringify(responseBody)}`}`);

  return { targetUrl: config.url, method: config.method, status: response.status, response: responseBody, sentAt: new Date().toISOString(), sentMedia: { fieldName: input.fileFieldName, fileName: input.fileName, mediaType: input.mediaType, sizeBytes: input.bytes.length }, sentJsonField: input.jsonFieldName ?? null };
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
