import { dockerServiceResources } from "../status/docker.service.js";

const minimaDataPath = "/home/minima/data";

export async function getMinimaContainerStats() {
  const containers = await dockerServiceResources();
  const minima = containers.find((container) => container.service === "minima");
  if (!minima) return null;

  return {
    state: minima.state,
    status: minima.status,
    cpuPercent: minima.cpuPercent,
    memory: minima.memory
      ? { usage: minima.memory.usage ?? null, limit: minima.memory.limit ?? null }
      : null,
    containerDisk: minima.disk.rootFs ?? null
  };
}

export function getMinimaStorageInfo(
  containerDisk: string | null | undefined,
  input?: { dataPath?: string | null; chainDataDisk?: string | null }
) {
  return {
    dataPath: input?.dataPath?.trim() || minimaDataPath,
    containerDisk: containerDisk ?? null,
    chainDataDisk: input?.chainDataDisk ?? null
  };
}
