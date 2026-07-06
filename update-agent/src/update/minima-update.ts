import { cp, rm } from "node:fs/promises";
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
const BACKUP_DIR = `${env.minimaDataDirInContainer}.update-backup`;

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
 * Updates the minima-node container to a manually-approved image digest.
 * Unlike stateless services, this backs up the data directory first and
 * restores it if the new container fails its health check, since Minima
 * cannot run two instances against the same data directory at once.
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

  await rm(BACKUP_DIR, { recursive: true, force: true });
  await cp(env.minimaDataDirInContainer, BACKUP_DIR, { recursive: true });

  const originalName = inspected.Name.replace(/^\//, "");
  await stopContainer(running.Id, 30);
  await removeContainer(running.Id);

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

    await rm(BACKUP_DIR, { recursive: true, force: true });
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
  await rm(env.minimaDataDirInContainer, { recursive: true, force: true });
  await cp(BACKUP_DIR, env.minimaDataDirInContainer, { recursive: true });
  await rm(BACKUP_DIR, { recursive: true, force: true });

  const restoreBody = createBodyFromInspect(inspected, oldImageRef);
  const restored = await createContainer(originalName, restoreBody);
  await startContainer(restored.Id);
}
