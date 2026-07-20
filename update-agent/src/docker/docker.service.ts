import { env } from "../config/env.js";
import { dockerRequest, dockerRequestStream, type DockerProgressLine } from "./docker.client.js";
import type { DockerContainerInspect, DockerContainerSummary, DockerImageSummary } from "./docker.types.js";

const composeProject = "integritas-pi";

function isComposeContainer(container: DockerContainerSummary) {
  return container.Labels?.["com.docker.compose.project"] === composeProject;
}

export async function getComposeServiceContainer(serviceName: string): Promise<DockerContainerSummary | null> {
  const containers = await dockerRequest<DockerContainerSummary[]>("GET", "/containers/json?all=1");
  return (
    containers.find(
      (container) => isComposeContainer(container) && container.Labels?.["com.docker.compose.service"] === serviceName
    ) ?? null
  );
}

export function inspectContainer(containerId: string): Promise<DockerContainerInspect> {
  return dockerRequest<DockerContainerInspect>("GET", `/containers/${containerId}/json`);
}

export function pullImageByDigest(imageRef: string, onProgress?: (line: DockerProgressLine) => void): Promise<void> {
  return dockerRequestStream(
    `/images/create?fromImage=${encodeURIComponent(imageRef)}`,
    env.pullTimeoutMs,
    onProgress
  );
}

export async function createContainer(
  name: string,
  config: Record<string, unknown>
): Promise<{ Id: string }> {
  return dockerRequest<{ Id: string }>("POST", `/containers/create?name=${encodeURIComponent(name)}`, config);
}

/**
 * Builds a /containers/create body from a running container's inspect output,
 * substituted with a new image ref. Only forwards the fields this stack's
 * compose services actually use — not a general-purpose inspect passthrough.
 *
 * Host port bindings are omitted by default: a candidate container is started
 * alongside the still-running old one for health checking, and two containers
 * can't bind the same host port. Pass includePortBindings once the old
 * container has been stopped and the port is free.
 *
 * `extraEnv`/`cmd` let a caller start a variant of the same container with a
 * different entrypoint (e.g. update-agent's self-update orchestrator, which
 * runs from the same image/config but with a one-shot Cmd override instead of
 * the normal server start). `oneShot` overrides the inherited restart policy
 * (which would otherwise be "unless-stopped", causing Docker to relaunch a
 * job container forever) and removes the container automatically once it exits.
 * `stripComposeServiceLabel` drops the inherited `com.docker.compose.service`
 * label — needed for one-shot helper containers (the self-update orchestrator)
 * so they can't be mistaken for the real service container by
 * getComposeServiceContainer() lookups while both are briefly running.
 */
export function createBodyFromInspect(
  inspected: DockerContainerInspect,
  newImageRef: string,
  includePortBindings = false,
  options?: { extraEnv?: string[]; cmd?: string[]; oneShot?: boolean; stripComposeServiceLabel?: boolean }
) {
  const networkNames = Object.keys(inspected.NetworkSettings.Networks);
  const labels = options?.stripComposeServiceLabel
    ? Object.fromEntries(Object.entries(inspected.Config.Labels ?? {}).filter(([key]) => key !== "com.docker.compose.service"))
    : inspected.Config.Labels;

  return {
    Image: newImageRef,
    Env: [...(inspected.Config.Env ?? []), ...(options?.extraEnv ?? [])],
    Cmd: options?.cmd,
    Labels: labels,
    ExposedPorts: inspected.Config.ExposedPorts,
    HostConfig: {
      Binds: inspected.HostConfig.Binds,
      GroupAdd: inspected.HostConfig.GroupAdd,
      RestartPolicy: options?.oneShot ? { Name: "no" } : inspected.HostConfig.RestartPolicy,
      AutoRemove: options?.oneShot ? true : undefined,
      ExtraHosts: inspected.HostConfig.ExtraHosts,
      PortBindings: includePortBindings ? inspected.HostConfig.PortBindings : undefined
    },
    NetworkingConfig: {
      EndpointsConfig: Object.fromEntries(
        networkNames.map((networkName) => [
          networkName,
          { Aliases: inspected.NetworkSettings.Networks[networkName]?.Aliases ?? [] }
        ])
      )
    }
  };
}

export function startContainer(containerId: string): Promise<void> {
  return dockerRequest<void>("POST", `/containers/${containerId}/start`);
}

export function stopContainer(containerId: string, timeoutSeconds = 10): Promise<void> {
  return dockerRequest<void>("POST", `/containers/${containerId}/stop?t=${timeoutSeconds}`);
}

export function removeContainer(containerId: string): Promise<void> {
  return dockerRequest<void>("DELETE", `/containers/${containerId}?force=1`);
}

/**
 * Force-removes any container with the given name, if one exists. Used to
 * clear a stale `<service>-update-candidate` left behind by a crash mid-update
 * (e.g. a power cut) before creating a new one under that name — Docker
 * otherwise 409s on the name conflict.
 */
export async function removeContainerByName(name: string): Promise<void> {
  const containers = await dockerRequest<DockerContainerSummary[]>("GET", "/containers/json?all=1");
  const match = containers.find((container) => container.Names.includes(`/${name}`));
  if (!match) return;

  await removeContainer(match.Id);
}

export function renameContainer(containerId: string, newName: string): Promise<void> {
  return dockerRequest<void>("POST", `/containers/${containerId}/rename?name=${encodeURIComponent(newName)}`);
}

export async function isContainerHealthy(containerId: string): Promise<boolean> {
  const inspected = await inspectContainer(containerId);
  if (!inspected.State.Running) return false;
  if (!inspected.State.Health) return inspected.State.Running;
  return inspected.State.Health.Status === "healthy";
}

export async function waitForHealthy(containerId: string, timeoutMs: number, intervalMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await isContainerHealthy(containerId)) return true;
    } catch {
      // container may not exist yet or transiently fail inspect; keep polling until deadline
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function listImagesForRepo(repo: string): Promise<DockerImageSummary[]> {
  const images = await dockerRequest<DockerImageSummary[]>("GET", "/images/json?all=0");
  return images
    .filter((image) => image.RepoDigests?.some((digest) => digest.startsWith(`${repo}@`)))
    .sort((a, b) => b.Created - a.Created);
}

export function removeImage(imageId: string): Promise<void> {
  return dockerRequest<void>("DELETE", `/images/${imageId}?force=0`);
}

export async function pruneOldImages(repo: string, keep: number): Promise<void> {
  const images = await listImagesForRepo(repo);
  const stale = images.slice(keep);
  for (const image of stale) {
    try {
      await removeImage(image.Id);
    } catch {
      // best-effort cleanup; a stale image still in use by a stopped container is not fatal
    }
  }
}
