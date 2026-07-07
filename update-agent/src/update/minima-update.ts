import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import {
  createBodyFromInspect,
  createContainer,
  getComposeServiceContainer,
  inspectContainer,
  pullImageByDigest,
  removeContainer,
  renameContainer,
  startContainer,
  stopContainer
} from "../docker/docker.service.js";
import type { ServiceUpdateResult } from "./update.types.js";

const SERVICE_NAME = "minima";

async function isMinimaHealthy(): Promise<boolean> {
  try {
    const response = await fetch(env.minimaStatusUrl, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForMinimaHealthy(timeoutMs: number, intervalMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isMinimaHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

/**
 * Removes only the contents of a directory, leaving the directory itself
 * (and, importantly, the bind mount it may be the root of) intact.
 */
async function clearDirContents(dir: string): Promise<void> {
  const entries = await readdir(dir).catch(() => []);
  await Promise.all(entries.map((entry) => rm(path.join(dir, entry), { recursive: true, force: true })));
}

/**
 * Updates the minima-node container to a manually-approved image digest.
 * Unlike stateless services, Minima cannot run two instances against the
 * same data directory at once, so this stops the old container first, backs
 * up the (now quiescent) data directory to a host-mounted backup path, then
 * swaps in the new container — restoring the backup and restarting the old
 * image if the new one fails its health check.
 */
export async function updateMinimaNode(imageRef: string): Promise<ServiceUpdateResult> {
  const running = await getComposeServiceContainer(SERVICE_NAME);
  if (!running) {
    return { service: SERVICE_NAME, updated: false, reason: "no running container found for service \"minima\"" };
  }

  if (running.Image === imageRef) {
    return { service: SERVICE_NAME, updated: false, reason: "already up to date" };
  }

  const inspected = await inspectContainer(running.Id);
  await pullImageByDigest(imageRef);

  const originalName = inspected.Name.replace(/^\//, "");

  await stopContainer(running.Id, 30);
  await removeContainer(running.Id);

  await mkdir(env.minimaBackupDirInContainer, { recursive: true });
  await clearDirContents(env.minimaBackupDirInContainer);
  await cp(env.minimaDataDirInContainer, env.minimaBackupDirInContainer, { recursive: true });

  const createBody = createBodyFromInspect(inspected, imageRef);

  try {
    const created = await createContainer(originalName, createBody);
    await startContainer(created.Id);

    const healthy = await waitForMinimaHealthy(env.healthCheckTimeoutMs, env.healthCheckIntervalMs);
    if (!healthy) {
      await stopContainer(created.Id).catch(() => undefined);
      await removeContainer(created.Id).catch(() => undefined);
      await restoreBackupAndRestartOld(inspected, running.Image, originalName);
      return { service: SERVICE_NAME, updated: false, reason: "new container failed health check; data restored and old image restarted" };
    }

    await clearDirContents(env.minimaBackupDirInContainer);
    return { service: SERVICE_NAME, updated: true, reason: "updated and healthy" };
  } catch (error) {
    await restoreBackupAndRestartOld(inspected, running.Image, originalName);
    throw error;
  }
}

async function restoreBackupAndRestartOld(
  inspected: Awaited<ReturnType<typeof inspectContainer>>,
  oldImageRef: string,
  originalName: string
) {
  await clearDirContents(env.minimaDataDirInContainer);
  await cp(env.minimaBackupDirInContainer, env.minimaDataDirInContainer, { recursive: true });
  await clearDirContents(env.minimaBackupDirInContainer);

  const restoreBody = createBodyFromInspect(inspected, oldImageRef);
  const restored = await createContainer(originalName, restoreBody);
  await startContainer(restored.Id);
}
