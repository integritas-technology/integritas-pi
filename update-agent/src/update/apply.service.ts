import { recordAppliedManifest } from "../manifest/manifest-state.js";
import { getUpdateStatus } from "../status/status.service.js";
import { updateService } from "./service-update.js";
import type { ServiceUpdateResult } from "./update.types.js";

export async function applyUpdates(): Promise<ServiceUpdateResult[]> {
  const { manifest, services } = await getUpdateStatus();
  const results: ServiceUpdateResult[] = [];

  for (const status of services) {
    if (status.upToDate) {
      results.push({ service: status.service, updated: false, reason: "already up to date" });
      continue;
    }

    console.log(`[update-agent] ${status.service}: updating to ${status.targetImage}`);

    const result = await updateService(status.service, status.targetImage);

    console.log(`[update-agent] ${status.service}: ${result.updated ? "updated" : "not updated"} — ${result.reason}`);

    results.push(result);
  }

  // Only record the manifest as applied if nothing failed — a partial
  // failure must remain retryable against the same manifest.
  const anyFailed = results.some((result) => !result.updated && result.reason !== "already up to date");
  if (!anyFailed) {
    await recordAppliedManifest(manifest.createdAt);
  }

  return results;
}
