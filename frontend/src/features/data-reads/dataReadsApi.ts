import type { DataSourceRead } from "./dataReadTypes";

export async function listDataReads() {
  const response = await fetch("/api/data-reads");
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { items: DataSourceRead[] };
}
