import { db } from "../../db/database.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { getDeviceInfo } from "../status/device.service.js";
import crypto from "node:crypto";

const DEVICE_ID_KEY = "device_id";

export type IntegritasDeviceType = "raspberry_pi" | "self_hosted";

export type IntegritasDevice = {
  deviceId: string;
  deviceName: string;
  deviceType: IntegritasDeviceType;
  createdAt: string;
  updatedAt: string;
};

type IntegritasDeviceRow = {
  device_id: string;
  device_name: string;
  device_type: string;
  created_at: string;
  updated_at: string;
};

function ensureSettingsDeviceId(): string {
  const existing = getSetting(DEVICE_ID_KEY).trim();
  if (existing) return existing;

  const deviceId = crypto.randomUUID();
  saveSetting(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function deviceTypeFromInfo(info: ReturnType<typeof getDeviceInfo>): IntegritasDeviceType {
  const arch = info.arch.toLowerCase();
  const isArm = arch === "arm" || arch === "arm64" || arch === "aarch64";
  if (info.platform === "linux" && isArm) return "raspberry_pi";
  return "self_hosted";
}

function mapDevice(row: IntegritasDeviceRow): IntegritasDevice {
  return {
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceType: row.device_type as IntegritasDeviceType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Load Integritas device row; identity matches settings.device_id (same UUID as status device info). */
export function getOrCreateDevice(): IntegritasDevice {
  const existing = db
    .prepare(
      `SELECT device_id, device_name, device_type, created_at, updated_at FROM integritas_device WHERE id = 'default'`,
    )
    .get() as IntegritasDeviceRow | undefined;

  if (existing) return mapDevice(existing);

  const deviceId = ensureSettingsDeviceId();
  const info = getDeviceInfo();
  const deviceName = `${info.hostname}`;
  const deviceType = deviceTypeFromInfo(info);
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO integritas_device (id, device_id, device_name, device_type, created_at, updated_at)
    VALUES ('default', ?, ?, ?, ?, ?)
  `,
  ).run(deviceId, deviceName, deviceType, now, now);

  return {
    deviceId,
    deviceName,
    deviceType,
    createdAt: now,
    updatedAt: now,
  };
}
