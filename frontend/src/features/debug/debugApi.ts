import { getJson } from "../../lib/api";

export function getDebugPing() {
  return getJson<{ message: string }>("/api/debug/ping");
}
