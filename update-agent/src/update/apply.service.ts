import { recordAppliedManifest } from "../manifest/manifest-state.js";
import { getUpdateStatus } from "../status/status.service.js";
import { launchSelfUpdate } from "../self-update/self-update.service.js";
import { updateService } from "./service-update.js";
import type { ServiceUpdateResult } from "./update.types.js";

export async function applyUpdates(): Promise<ServiceUpdateResult[]> {
  const { manifest, services } = await getUpdateStatus();
  const results: ServiceUpdateResult[] = [];

  for (const status of services) {
    // update-agent doesn't go through the generic pull/health-check/swap loop
    // — it updates itself via a separate ephemeral orchestrator, launched
    // after everything else here has finished (see below).
    if (status.service === "update-agent") continue;

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
    await recordAppliedManifest(manifest.createdAt, manifest.version);
  }

  // Fire-and-forget: launched after everything else succeeds, runs
  // independently of this request/job (it may end up killing this very
  // process). Failures are logged by the orchestrator itself and surface as
  // a stuck "not up to date" update-agent entry in the status list, not as a
  // failure of this apply job.
  if (!anyFailed) {
    void launchSelfUpdate(manifest.updateAgent).catch((error) => {
      console.error("[update-agent] self-update launch failed:", error);
    });
  }

  return results;
}
