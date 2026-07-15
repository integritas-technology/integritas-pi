import { getPullProgress, type PullProgress } from "../docker/pull-progress.js";
import { applyUpdates } from "./apply.service.js";
import type { ServiceUpdateResult } from "./update.types.js";

type JobState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "succeeded"; results: ServiceUpdateResult[] }
  | { state: "failed"; error: string };

export type ApplyJobStatus =
  | { state: "idle" }
  | { state: "running"; progress: PullProgress | null }
  | { state: "succeeded"; results: ServiceUpdateResult[] }
  | { state: "failed"; error: string };

// Single-process in-memory job state — valid because update-agent always runs as exactly one container.
let job: JobState = { state: "idle" };

export function getApplyJobStatus(): ApplyJobStatus {
  if (job.state === "running") {
    return { state: "running", progress: getPullProgress() };
  }
  return job;
}

/**
 * Starts an update run in the background and returns immediately. The
 * frontend service may restart mid-run, which would kill an in-flight HTTP
 * response — callers must poll getApplyJobStatus() instead of awaiting this.
 */
export function startApplyJob(): { started: boolean } {
  if (job.state === "running") {
    return { started: false };
  }

  job = { state: "running" };
  console.log("[update-agent] apply started");

  applyUpdates()
    .then((results) => {
      job = { state: "succeeded", results };
      console.log("[update-agent] apply finished");
    })
    .catch((error) => {
      console.error("[update-agent] apply failed:", error);
      job = { state: "failed", error: "Update failed unexpectedly — check update-agent's logs for details" };
    });

  return { started: true };
}
