import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const STATE_FILE = "last-applied-manifest.json";

function statePath(): string {
  return path.join(env.stateDirInContainer, STATE_FILE);
}

/**
 * Returns the createdAt (epoch ms) of the last manifest whose update was
 * successfully applied, or null if none has been recorded yet.
 */
export async function getLastAppliedManifestTimestamp(): Promise<number | null> {
  try {
    const raw = await readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as { createdAt?: string };
    if (!parsed.createdAt) return null;
    const timestamp = Date.parse(parsed.createdAt);
    return Number.isNaN(timestamp) ? null : timestamp;
  } catch {
    return null;
  }
}

export async function recordAppliedManifest(createdAt: string): Promise<void> {
  await mkdir(env.stateDirInContainer, { recursive: true });
  await writeFile(statePath(), JSON.stringify({ createdAt }, null, 2));
}
