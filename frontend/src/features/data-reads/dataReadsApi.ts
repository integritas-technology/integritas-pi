import { getJson } from "../../lib/api";
import type { DataSourceRead } from "./dataReadTypes";

export async function listDataReads() {
  return getJson<{ items: DataSourceRead[] }>("/api/data-reads");
}
