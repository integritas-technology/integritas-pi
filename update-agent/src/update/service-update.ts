import { env } from "../config/env.js";
import {
  createBodyFromInspect,
  createContainer,
  getComposeServiceContainer,
  inspectContainer,
  pruneOldImages,
  pullImageByDigest,
  removeContainer,
  removeContainerByName,
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
 *
 * The candidate is first created without host port bindings, since the old
 * container may still be holding them. If the service publishes host ports,
 * a second create+start (with the bindings) happens after the old container
 * is stopped and removed, before the container is renamed into place.
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
  // Clear any candidate left behind by a crash mid-update (e.g. a power cut)
  // — otherwise Docker 409s on the name conflict and every retry fails.
  await removeContainerByName(candidateName);

  const createBody = createBodyFromInspect(inspected, imageRef);
  let candidate = await createContainer(candidateName, createBody);

  try {
    await startContainer(candidate.Id);
    const healthy = await waitForHealthy(candidate.Id, env.healthCheckTimeoutMs, env.healthCheckIntervalMs);

    if (!healthy) {
      await stopContainer(candidate.Id).catch(() => undefined);
      await removeContainer(candidate.Id).catch(() => undefined);
      return { service: serviceName, updated: false, reason: "new container failed health check; old container left running" };
    }

    const originalName = inspected.Name.replace(/^\//, "");
    const hasPortBindings = Object.keys(inspected.HostConfig.PortBindings ?? {}).length > 0;

    if (hasPortBindings) {
      // The health-checked candidate has no host port bindings. Stop the old
      // container to free the port, then recreate the candidate with the
      // bindings. This step can't be health-checked against a still-running
      // fallback, so on failure we best-effort restore the old container
      // from its inspect data rather than leave the service down.
      await stopContainer(running.Id);
      await removeContainer(running.Id);

      try {
        await stopContainer(candidate.Id);
        await removeContainer(candidate.Id);
        const finalBody = createBodyFromInspect(inspected, imageRef, true);
        candidate = await createContainer(candidateName, finalBody);
        await startContainer(candidate.Id);
      } catch (error) {
        const restoreBody = createBodyFromInspect(inspected, running.Image, true);
        const restored = await createContainer(originalName, restoreBody);
        await startContainer(restored.Id);
        return {
          service: serviceName,
          updated: false,
          reason: `failed to bind port on updated container; restored previous container: ${
            error instanceof Error ? error.message : String(error)
          }`
        };
      }
    } else {
      await stopContainer(running.Id);
      await removeContainer(running.Id);
    }

    await renameContainer(candidate.Id, originalName);

    const repo = imageRef.split("@")[0];
    await pruneOldImages(repo, IMAGES_TO_KEEP);

    return { service: serviceName, updated: true, reason: "updated and healthy" };
  } catch (error) {
    await stopContainer(candidate.Id).catch(() => undefined);
    await removeContainer(candidate.Id).catch(() => undefined);
    throw error;
  }
}
