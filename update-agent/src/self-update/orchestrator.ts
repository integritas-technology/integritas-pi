import { env } from "../config/env.js";
import {
  createBodyFromInspect,
  createContainer,
  inspectContainer,
  removeContainer,
  removeContainerByName,
  renameContainer,
  startContainer,
  stopContainer,
  waitForHealthy
} from "../docker/docker.service.js";

/**
 * Entry point for a one-shot container: started by a *running* update-agent
 * once it sees its own new image in the manifest, using the new image but
 * with this file as the Cmd override instead of the normal server start.
 *
 * The old update-agent never touches its own container — it only launches
 * this orchestrator and leaves it to do the swap. This process, running from
 * the new image, health-checks a candidate started from itself before ever
 * touching the old container. If the candidate never becomes healthy, the
 * old container is left completely untouched — failure is a no-op, not a
 * rollback, so there is no risk of an update-agent outage from a bad image.
 */
async function main(): Promise<void> {
  const targetImage = process.env.SELF_UPDATE_TARGET_IMAGE;
  const oldContainerId = process.env.OLD_CONTAINER_ID;
  if (!targetImage) {
    throw new Error("SELF_UPDATE_TARGET_IMAGE is required");
  }
  if (!oldContainerId) {
    throw new Error("OLD_CONTAINER_ID is required");
  }

  // Pinned to the exact container ID captured by the launcher, not
  // rediscovered by compose-service label — this orchestrator container
  // itself has that same label stripped, but the candidate below inherits it
  // until renamed, so a label-based lookup would be ambiguous for the
  // duration of this run regardless.
  const inspected = await inspectContainer(oldContainerId);

  if (inspected.Image === targetImage) {
    console.log("[update-agent self-update] already up to date, nothing to do");
    return;
  }

  const candidateName = "update-agent-self-update-candidate";
  // Clear any candidate left behind by a crash mid-update (e.g. a power cut)
  // — otherwise Docker 409s on the name conflict and every retry fails.
  await removeContainerByName(candidateName);

  // Not stripping the compose-service label here (unlike the orchestrator
  // container that spawned this process) — this candidate becomes the
  // permanent replacement once renamed below, and needs that label so future
  // getComposeServiceContainer("update-agent") lookups keep finding it. The
  // narrow window where both this candidate and the old container share the
  // label (until the old one is stopped+removed a few lines down) is an
  // acceptable race — a concurrent status check could transiently see either,
  // but nothing destructive happens from that ambiguity.
  const createBody = createBodyFromInspect(inspected, targetImage);
  const candidate = await createContainer(candidateName, createBody);

  try {
    await startContainer(candidate.Id);
    const healthy = await waitForHealthy(candidate.Id, env.healthCheckTimeoutMs, env.healthCheckIntervalMs);

    if (!healthy) {
      await stopContainer(candidate.Id).catch(() => undefined);
      await removeContainer(candidate.Id).catch(() => undefined);
      throw new Error("new update-agent container failed health check; old container left running");
    }

    const originalName = inspected.Name.replace(/^\//, "");

    await stopContainer(oldContainerId);
    await removeContainer(oldContainerId);
    await renameContainer(candidate.Id, originalName);

    console.log("[update-agent self-update] swapped to new version successfully");
  } catch (error) {
    await stopContainer(candidate.Id).catch(() => undefined);
    await removeContainer(candidate.Id).catch(() => undefined);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[update-agent self-update] failed:", error);
    process.exit(1);
  });
