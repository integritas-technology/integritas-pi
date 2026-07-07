import { dockerRequest, dockerRequestStream } from "./docker.client.js";
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

export function pullImageByDigest(imageRef: string): Promise<void> {
  return dockerRequestStream(`/images/create?fromImage=${encodeURIComponent(imageRef)}`);
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
 */
export function createBodyFromInspect(
  inspected: DockerContainerInspect,
  newImageRef: string,
  includePortBindings = false
) {
  const networkNames = Object.keys(inspected.NetworkSettings.Networks);

  return {
    Image: newImageRef,
    Env: inspected.Config.Env,
    Labels: inspected.Config.Labels,
    ExposedPorts: inspected.Config.ExposedPorts,
    HostConfig: {
      Binds: inspected.HostConfig.Binds,
      GroupAdd: inspected.HostConfig.GroupAdd,
      RestartPolicy: inspected.HostConfig.RestartPolicy,
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
