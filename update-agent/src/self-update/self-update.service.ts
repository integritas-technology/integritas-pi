import {
  createBodyFromInspect,
  createContainer,
  getComposeServiceContainer,
  inspectContainer,
  pullImageByDigest,
  removeContainerByName,
  startContainer
} from "../docker/docker.service.js";

const ORCHESTRATOR_NAME = "update-agent-self-update-orchestrator";

/**
 * Launches update-agent's own self-update as a one-shot container, then
 * returns — it does not wait for the orchestrator to finish, since the
 * orchestrator's job may end with this very container being stopped and
 * removed. See self-update/orchestrator.ts for the actual swap logic.
 *
 * No-op if the running update-agent is already on targetImage.
 */
export async function launchSelfUpdate(targetImage: string): Promise<void> {
  const running = await getComposeServiceContainer("update-agent");
  if (!running) {
    throw new Error('no running container found for service "update-agent"');
  }

  if (running.Image === targetImage) {
    return;
  }

  console.log(`[update-agent] self-update: launching orchestrator for ${targetImage}`);

  await pullImageByDigest(targetImage);

  const inspected = await inspectContainer(running.Id);

  // Clear any orchestrator left behind by a crash mid-update (e.g. a power
  // cut) — otherwise Docker 409s on the name conflict and every retry fails.
  await removeContainerByName(ORCHESTRATOR_NAME);

  const createBody = createBodyFromInspect(inspected, targetImage, false, {
    // OLD_CONTAINER_ID pins the orchestrator to the exact container it should
    // retire — it must not rediscover "the update-agent container" via the
    // compose-service label, since the orchestrator (and the candidate it
    // creates) inherit that same label from `inspected` and would otherwise
    // be ambiguous matches for that lookup while both are briefly running.
    extraEnv: [`SELF_UPDATE_TARGET_IMAGE=${targetImage}`, `OLD_CONTAINER_ID=${running.Id}`],
    cmd: ["node", "dist/self-update/orchestrator.js"],
    oneShot: true,
    stripComposeServiceLabel: true
  });

  const orchestrator = await createContainer(ORCHESTRATOR_NAME, createBody);
  await startContainer(orchestrator.Id);

  console.log("[update-agent] self-update: orchestrator started, handing off");
}
