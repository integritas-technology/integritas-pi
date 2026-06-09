import { deleteJson, getJson, patchJson, postJson } from "../../lib/api";
import type { DataSource, DataSourceHealthStatus } from "./dataSourceTypes";

export async function listDataSources() {
  return getJson<{ items: DataSource[] }>("/api/data-sources");
}

export async function createDataSource(input: { name: string; type: DataSource["type"]; description: string; config: DataSource["config"] }) {
  return postJson<{ item: DataSource }>("/api/data-sources", input);
}

export async function updateDataSource(id: string, input: { name: string; type: DataSource["type"]; description: string; config: DataSource["config"] }) {
  return patchJson<{ item: DataSource }>(`/api/data-sources/${id}`, input);
}

export async function deleteDataSource(id: string) {
  return deleteJson(`/api/data-sources/${id}`);
}

export async function readDataSource(id: string) {
  return postJson<{ item: DataSource; result: unknown }>(`/api/data-sources/${id}/read`);
}

export async function checkDataSourceHealth(id: string) {
  const response = await fetch(`/api/data-sources/${id}/health`, { credentials: "include" });
  return await response.json() as DataSourceHealthStatus;
}
