import { getUpdateStatus } from "../status/status.service.js";
import { updateService } from "./service-update.js";
import { updateMinimaNode } from "./minima-update.js";
import type { ServiceUpdateResult } from "./update.types.js";

export async function applyUpdates(): Promise<ServiceUpdateResult[]> {
  const { services } = await getUpdateStatus();
  const results: ServiceUpdateResult[] = [];

  for (const status of services) {
    if (status.upToDate) {
      results.push({ service: status.service, updated: false, reason: "already up to date" });
      continue;
    }

    const result =
      status.service === "minima"
        ? await updateMinimaNode(status.targetImage)
        : await updateService(status.service, status.targetImage);

    results.push(result);
  }

  return results;
}
