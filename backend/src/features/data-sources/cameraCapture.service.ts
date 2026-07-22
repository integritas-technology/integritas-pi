import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { sha3HashHex } from "../../shared/crypto.js";
import { getDataSource } from "./dataSources.repository.js";
import { parsePiCameraConfig } from "./dataSources.service.js";

export type CameraCaptureResult = {
  contentType: "image/jpeg" | "video/h264";
  bytesHash: string;
  canonicalBytes: string;
  preview: CameraCapturePreview;
  sizeBytes: number;
};

type CameraCapturePreview = {
  source: "pi-camera-helper";
  mode: "photo" | "video";
  fileName: string;
  path: string;
  mediaType: "image/jpeg" | "video/h264";
  sizeBytes: number;
  sha3: string;
  capturedAt: string;
  width: number;
  height: number;
  durationMs: number;
  fps?: number | null;
  command?: string;
};

export async function getCameraCapability() {
  if (!env.cameraEnabled) {
    return { available: false, enabled: false, captureDir: env.cameraCaptureDir, reason: "Camera support is disabled. Set ENABLE_CAMERA=true and restart the app." };
  }

  try {
    const response = await cameraHelperRequest("/capabilities");
    return { enabled: true, captureDir: env.cameraCaptureDir, ...response };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Camera helper is unavailable";
    return { available: false, enabled: true, captureDir: env.cameraCaptureDir, reason: `Camera helper is unavailable at ${env.cameraHelperUrl}: ${detail}` };
  }
}

export async function capturePiCamera(input: { sourceId: string; durationMs?: number }): Promise<CameraCaptureResult> {
  const capability = await getCameraCapability();
  if (!capability.available) throw new Error(capability.reason ?? "Camera support is unavailable");

  const source = getDataSource(input.sourceId);
  if (!source || source.type !== "pi-camera") throw new Error("Capture camera block requires a Pi Camera device");

  const config = parsePiCameraConfig(JSON.parse(source.config) as unknown);
  const durationMs = input.durationMs ?? config.durationMs;
  const preview = await cameraHelperRequest("/capture", {
    mode: config.mode,
    width: config.width,
    height: config.height,
    durationMs,
    fps: config.fps,
    sourceName: source.name
  }) as CameraCapturePreview;

  const filePath = resolveCapturePath(preview.path);
  const [bytes, stat] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
  const hash = sha3HashHex(bytes);
  const verifiedPreview = { ...preview, path: filePath, sizeBytes: stat.size, sha3: hash };

  await pruneOldCaptures();
  return { contentType: verifiedPreview.mediaType, bytesHash: hash, canonicalBytes: `${JSON.stringify(verifiedPreview, null, 2)}\n`, preview: verifiedPreview, sizeBytes: stat.size };
}

async function cameraHelperRequest(pathname: string, body?: unknown) {
  const response = await fetch(`${env.cameraHelperUrl.replace(/\/$/, "")}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(env.cameraHelperToken ? { Authorization: `Bearer ${env.cameraHelperToken}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `Camera helper returned HTTP ${response.status}`);
  return payload as Record<string, unknown>;
}

function resolveCapturePath(value: string) {
  const captureRoot = path.resolve(env.cameraCaptureDir);
  const filePath = path.resolve(value);
  if (filePath !== captureRoot && !filePath.startsWith(`${captureRoot}${path.sep}`)) throw new Error("Camera helper returned a path outside the capture directory");
  return filePath;
}

async function pruneOldCaptures() {
  const retentionDays = Number(env.cameraRetentionDays);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let entries: string[];
  try {
    entries = await fs.readdir(env.cameraCaptureDir);
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(env.cameraCaptureDir, entry);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile() && stat.mtimeMs < cutoffMs) await fs.unlink(filePath);
    } catch {
      // Best-effort cleanup only; capture should not fail because pruning failed.
    }
  }));
}
