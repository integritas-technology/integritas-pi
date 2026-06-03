import type { DataSource } from "./dataSourceTypes";

export async function listDataSources() {
  const response = await fetch("/api/data-sources");
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { items: DataSource[] };
}

export async function createDataSource(input: { name: string; type: DataSource["type"]; description: string; config: DataSource["config"] }) {
  const response = await fetch("/api/data-sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { item: DataSource };
}

export async function deleteDataSource(id: string) {
  const response = await fetch(`/api/data-sources/${id}`, { method: "DELETE" });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed;
}

export async function readDataSource(id: string) {
  const response = await fetch(`/api/data-sources/${id}/read`, { method: "POST" });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { item: DataSource; result: unknown };
}
