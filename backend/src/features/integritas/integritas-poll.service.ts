import { env } from "../../config/env.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { listPendingProofRecords } from "./integritas.repository.js";
import { applyPollResultToRecord, pollProofStatus } from "./integritas.service.js";

const POLL_BATCH_SIZE = 50;

let poller: NodeJS.Timeout | null = null;
let pollRunning = false;

export async function pollPendingProofRecords() {
  if (pollRunning) return;

  const apiKey = getIntegritasApiKey();
  if (!apiKey) return;

  pollRunning = true;
  try {
    const pending = listPendingProofRecords();
    if (pending.length === 0) return;

    for (let offset = 0; offset < pending.length; offset += POLL_BATCH_SIZE) {
      const batch = pending.slice(offset, offset + POLL_BATCH_SIZE);
      const uids = batch.map((record) => record.proof_uid).filter((uid): uid is string => Boolean(uid));
      if (uids.length === 0) continue;

      const result = await pollProofStatus({ apiKey, uids });
      if (!result.ok) {
        console.error(`Integritas proof poller: ${result.error} (${result.errorCode}): HTTP ${result.status}`);
        continue;
      }

      for (const record of batch) {
        if (!record.proof_uid) continue;

        try {
          applyPollResultToRecord(record.id, record.proof_uid, result);
        } catch (error) {
          console.error(
            `Integritas proof poller: failed to update record ${record.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }
  } finally {
    pollRunning = false;
  }
}

export function startIntegritasProofPoller() {
  if (poller) return;

  const intervalMs = env.integritasPollIntervalSeconds * 1000;
  poller = setInterval(() => {
    pollPendingProofRecords().catch((error) => {
      console.error("Integritas proof poller failed:", error instanceof Error ? error.message : error);
    });
  }, intervalMs);
}
