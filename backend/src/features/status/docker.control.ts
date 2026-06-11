import http from "node:http";
import { env } from "../../config/env.js";
import { getComposeServiceContainer } from "./docker.service.js";

function dockerPost(pathName: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath: env.dockerSocketPath, path: pathName, method: "POST" }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Docker API returned HTTP ${response.statusCode}: ${body}`));
          return;
        }
        resolve();
      });
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Docker API request timed out")));
    request.end();
  });
}

export async function restartComposeService(serviceName: string) {
  const container = await getComposeServiceContainer(serviceName);
  if (!container) {
    throw new Error(`Docker container not found for service "${serviceName}"`);
  }

  await dockerPost(`/containers/${container.Id}/restart?t=10`);
  return {
    ok: true as const,
    state: "restarting" as const,
    service: serviceName,
    containerId: container.Id.slice(0, 12)
  };
}
