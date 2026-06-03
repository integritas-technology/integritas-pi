import { sha3HashHex } from "../../shared/crypto.js";
import type { DataSourceRecord } from "./dataSources.repository.js";

export type JsonApiConfig = {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
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

  if (!url) throw new Error("config.url is required");

  return { url, method, headers, body: config?.body };
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

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const details = cause as { code?: string; address?: string; port?: number; message?: string };
    return [details.code, details.address, details.port, details.message].filter(Boolean).join(" ") || error.message;
  }
  return error.message;
}
