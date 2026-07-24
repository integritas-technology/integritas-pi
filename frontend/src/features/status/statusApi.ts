import { getJson } from "../../lib/api";
import type { StatusOverview } from "../../app/types";
import type { DeviceStatus } from "./statusTypes";

export function getDeviceStatus() {
  return getJson<DeviceStatus>("/api/status");
}

export function getStatusOverview() {
  return getJson<StatusOverview>("/api/status/overview");
}
