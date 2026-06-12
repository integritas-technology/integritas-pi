import os from "os";
import crypto from "crypto";
import { getSetting, saveSetting } from "../settings/settings.repository.js";

const DEVICE_ID_KEY = "device_id";

export async function ensureDeviceId(): Promise<void> {
  const existing = getSetting(DEVICE_ID_KEY);
  if (!existing) {
    saveSetting(DEVICE_ID_KEY, crypto.randomUUID());
  }
}

export function getDeviceInfo() {
  const id = getSetting(DEVICE_ID_KEY);
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  return {
    id,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: os.uptime(),
    memory: {
      totalBytes,
      freeBytes,
      usedBytes: totalBytes - freeBytes
    },
    loadAvg: os.loadavg() as [number, number, number]
  };
}
