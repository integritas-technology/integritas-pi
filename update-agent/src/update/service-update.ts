import { env } from "../config/env.js";
import {
  createBodyFromInspect,
  createContainer,
  getComposeServiceContainer,
  inspectContainer,
  pruneOldImages,
  pullImageByDigest,
  removeContainer,
  renameContainer,
  startContainer,
  stopContainer,
  waitForHealthy
} from "../docker/docker.service.js";
import type { ServiceUpdateResult } from "./update.types.js";

const IMAGES_TO_KEEP = 2;

/**
 * Updates a single compose service to a new image digest: pull the image,
 * start a new container alongside the running one, health-check it, then
 * swap. On any failure the old container is left running untouched.
 */
export async function updateService(serviceName: string, imageRef: string): Promise<ServiceUpdateResult> {
  const running = await getComposeServiceContainer(serviceName);
  if (!running) {
    return { service: serviceName, updated: false, reason: `no running container found for service "${serviceName}"` };
  }

  if (running.Image === imageRef) {
    return { service: serviceName, updated: false, reason: "already up to date" };
  }

  const inspected = await inspectContainer(running.Id);
  await pullImageByDigest(imageRef);

  const candidateName = `${serviceName}-update-candidate`;
  const createBody = createBodyFromInspect(inspected, imageRef);
  const created = await createContainer(candidateName, createBody);

  try {
    await startContainer(created.Id);
    const healthy = await waitForHealthy(created.Id, env.healthCheckTimeoutMs, env.healthCheckIntervalMs);

    if (!healthy) {
      await stopContainer(created.Id).catch(() => undefined);
      await removeContainer(created.Id).catch(() => undefined);
      return { service: serviceName, updated: false, reason: "new container failed health check; old container left running" };
    }

    const originalName = inspected.Name.replace(/^\//, "");
    await stopContainer(running.Id);
    await removeContainer(running.Id);
    await renameContainer(created.Id, originalName);

    const repo = imageRef.split("@")[0];
    await pruneOldImages(repo, IMAGES_TO_KEEP);

    return { service: serviceName, updated: true, reason: "updated and healthy" };
  } catch (error) {
    await stopContainer(created.Id).catch(() => undefined);
    await removeContainer(created.Id).catch(() => undefined);
    throw error;
  }
}
