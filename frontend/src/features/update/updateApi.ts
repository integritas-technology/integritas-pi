import type { UpdateStatusSummary } from "../../app/types";
import { getJson } from "../../lib/api";

export function getUpdateStatusSummary() {
  return getJson<UpdateStatusSummary>("/update/status/summary");
}
