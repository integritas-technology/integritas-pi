import os from "os";
import fs from "fs";
import crypto from "crypto";
import { getSetting, saveSetting } from "../settings/settings.repository.js";

const DEVICE_ID_KEY = "device_id";

export async function ensureDeviceId(): Promise<void> {
  const existing = getSetting(DEVICE_ID_KEY);
  if (!existing) {
    saveSetting(DEVICE_ID_KEY, crypto.randomUUID());
  }
}

function getDiskInfo(path: string) {
  try {
    const stat = fs.statfsSync(path);
    const totalBytes = stat.blocks * stat.bsize;
    const freeBytes = stat.bfree * stat.bsize;
    return { path, totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
  } catch {
    return null;
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
    cpuCount: os.cpus().length,
    memory: {
      totalBytes,
      freeBytes,
      usedBytes: totalBytes - freeBytes
    },
    loadAvg: os.loadavg() as [number, number, number],
    disk: getDiskInfo("/data") ?? getDiskInfo("/")
  };
}
