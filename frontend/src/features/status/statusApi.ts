import { getJson } from "../../lib/api";
import type { DeviceStatus } from "./statusTypes";

export function getDeviceStatus() {
  return getJson<DeviceStatus>("/api/status");
}
