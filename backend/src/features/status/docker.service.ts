import http from "node:http";
import fs from "node:fs/promises";
import { env } from "../../config/env.js";
import { formatBytes } from "../../shared/format.js";

type DockerContainer = {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  SizeRootFs?: number;
  Labels?: Record<string, string>;
};

type DockerStats = {
  cpu_stats?: { cpu_usage?: { total_usage?: number; percpu_usage?: number[] }; system_cpu_usage?: number; online_cpus?: number };
  precpu_stats?: { cpu_usage?: { total_usage?: number }; system_cpu_usage?: number };
  memory_stats?: { usage?: number; limit?: number; stats?: { cache?: number } };
};

function dockerRequest<T>(pathName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath: env.dockerSocketPath, path: pathName, method: "GET" }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Docker API returned HTTP ${response.statusCode}: ${body}`));
          return;
        }

        try {
          resolve(JSON.parse(body) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(5000, () => request.destroy(new Error("Docker API request timed out")));
    request.end();
  });
}

function cpuPercent(stats: DockerStats) {
  const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta = (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;

  if (cpuDelta <= 0 || systemDelta <= 0) return 0;
  return Number(((cpuDelta / systemDelta) * onlineCpus * 100).toFixed(2));
}

const composeProject = "integritas-pi";

function isComposeContainer(container: DockerContainer) {
  return container.Labels?.["com.docker.compose.project"] === composeProject;
}

export async function getComposeServiceContainer(serviceName: string) {
  const containers = await dockerRequest<DockerContainer[]>("/containers/json?all=1");
  return (
    containers.find(
      (container) => isComposeContainer(container) && container.Labels?.["com.docker.compose.service"] === serviceName
    ) ?? null
  );
}

export async function dockerServiceResources() {
  const containers = await dockerRequest<DockerContainer[]>("/containers/json?all=1&size=1");
  const appContainers = containers.filter(isComposeContainer);

  return Promise.all(appContainers.map(async (container) => {
    const stats = container.State === "running" ? await dockerRequest<DockerStats>(`/containers/${container.Id}/stats?stream=false`) : null;
    const memoryUsage = stats?.memory_stats?.usage ?? 0;
    const memoryCache = stats?.memory_stats?.stats?.cache ?? 0;
    const memoryWorkingSet = Math.max(memoryUsage - memoryCache, 0);

    return {
      service: container.Labels?.["com.docker.compose.service"] ?? container.Names[0]?.replace(/^\//, "") ?? container.Id.slice(0, 12),
      containerId: container.Id.slice(0, 12),
      state: container.State,
      status: container.Status,
      cpuPercent: stats ? cpuPercent(stats) : null,
      memory: stats ? { usageBytes: memoryWorkingSet, usage: formatBytes(memoryWorkingSet), limitBytes: stats.memory_stats?.limit, limit: formatBytes(stats.memory_stats?.limit) } : null,
      disk: { rootFsBytes: container.SizeRootFs, rootFs: formatBytes(container.SizeRootFs) }
    };
  }));
}

export async function diskUsage(targetPath: string) {
  const stats = await fs.statfs(targetPath);
  const total = stats.blocks * stats.bsize;
  const free = stats.bavail * stats.bsize;
  const used = total - free;

  return { path: targetPath, totalBytes: total, total: formatBytes(total), usedBytes: used, used: formatBytes(used), freeBytes: free, free: formatBytes(free), usedPercent: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0 };
}
