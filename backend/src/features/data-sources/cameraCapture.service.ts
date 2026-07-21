import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { sha3HashHex } from "../../shared/crypto.js";
import { getDataSource } from "./dataSources.repository.js";
import { parsePiCameraConfig, type PiCameraConfig } from "./dataSources.service.js";

export type CameraCaptureResult = {
  contentType: "image/jpeg" | "video/h264";
  bytesHash: string;
  canonicalBytes: string;
  preview: CameraCapturePreview;
  sizeBytes: number;
};

type CameraCapturePreview = {
  source: "pi-camera";
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
  fps?: number;
};

export function getCameraCapability() {
  if (!env.cameraEnabled) {
    return { available: false, enabled: false, captureDir: env.cameraCaptureDir, reason: "Camera support is disabled. Set ENABLE_CAMERA=true and restart the app." };
  }

  if (!commandExists(env.cameraPhotoCommand)) {
    return { available: false, enabled: true, captureDir: env.cameraCaptureDir, reason: `Camera photo command was not found: ${env.cameraPhotoCommand}` };
  }

  if (!commandExists(env.cameraVideoCommand)) {
    return { available: false, enabled: true, captureDir: env.cameraCaptureDir, reason: `Camera video command was not found: ${env.cameraVideoCommand}` };
  }

  return { available: true, enabled: true, captureDir: env.cameraCaptureDir, reason: null };
}

export async function capturePiCamera(input: { sourceId: string; durationMs?: number }): Promise<CameraCaptureResult> {
  const capability = getCameraCapability();
  if (!capability.available) throw new Error(capability.reason ?? "Camera support is unavailable");

  const source = getDataSource(input.sourceId);
  if (!source || source.type !== "pi-camera") throw new Error("Capture camera block requires a Pi Camera device");

  const config = normalizeCaptureConfig(parsePiCameraConfig(JSON.parse(source.config) as unknown), input.durationMs);
  const capturedAt = new Date().toISOString();
  const extension = config.outputFormat;
  const fileName = `${safeFileName(source.name)}-${capturedAt.replace(/[:.]/g, "-")}.${extension}`;
  const outputPath = path.join(env.cameraCaptureDir, fileName);

  await fs.mkdir(env.cameraCaptureDir, { recursive: true });
  await pruneOldCaptures();
  await runCaptureCommand(config, outputPath);

  const [bytes, stat] = await Promise.all([fs.readFile(outputPath), fs.stat(outputPath)]);
  const hash = sha3HashHex(bytes);
  const mediaType = config.mode === "photo" ? "image/jpeg" : "video/h264";
  const preview: CameraCapturePreview = {
    source: "pi-camera",
    mode: config.mode,
    fileName,
    path: outputPath,
    mediaType,
    sizeBytes: stat.size,
    sha3: hash,
    capturedAt,
    width: config.width,
    height: config.height,
    durationMs: config.mode === "photo" ? 0 : config.durationMs,
    fps: config.mode === "video" ? config.fps : undefined
  };

  return { contentType: mediaType, bytesHash: hash, canonicalBytes: `${JSON.stringify(preview, null, 2)}\n`, preview, sizeBytes: stat.size };
}

function normalizeCaptureConfig(config: PiCameraConfig, durationMs?: number): PiCameraConfig {
  const maxDurationMs = Math.max(1, env.cameraMaxDurationSeconds) * 1000;
  const nextDurationMs = durationMs === undefined ? config.durationMs : Number(durationMs);
  if (!Number.isFinite(nextDurationMs) || nextDurationMs < 100 || nextDurationMs > maxDurationMs) throw new Error(`Camera duration must be between 100 and ${maxDurationMs} ms`);
  return { ...config, durationMs: Math.min(nextDurationMs, maxDurationMs) };
}

function runCaptureCommand(config: PiCameraConfig, outputPath: string) {
  const command = config.mode === "photo" ? env.cameraPhotoCommand : env.cameraVideoCommand;
  const args = config.mode === "photo"
    ? ["-n", "-o", outputPath, "--width", String(config.width), "--height", String(config.height), "--timeout", String(config.durationMs)]
    : ["-n", "-o", outputPath, "--width", String(config.width), "--height", String(config.height), "--timeout", String(config.durationMs), "--framerate", String(config.fps)];

  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(new Error(`Camera command failed to start (${command}): ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Camera command exited with ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

function safeFileName(value: string) {
  const name = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return name || "camera";
}

function commandExists(command: string) {
  const result = spawnSync(command, ["--help"], { shell: false, stdio: "ignore" });
  return !result.error || result.error.message !== "spawnSync ENOENT";
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
