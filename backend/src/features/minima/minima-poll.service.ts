import { env } from "../../config/env.js";
import {
  canAutoResync,
  detectStall,
  recordAutoResync,
  recordPollerCheck,
  recordStallDetected
} from "./minima-monitoring.js";
import { parseMegammrResyncMessage } from "./minima.parse.js";
import { getMinimaNodeStatus, resyncMegammr } from "./minima.service.js";

let poller: NodeJS.Timeout | null = null;
let pollRunning = false;

export async function pollMinimaHealth() {
  if (pollRunning) return;

  pollRunning = true;
  try {
    const status = await getMinimaNodeStatus();
    recordPollerCheck(status.checkedAt, status.state);

    if (!detectStall(status)) return;

    recordStallDetected();
    const blockAge = status.sync.blockAgeSeconds ?? "unknown";
    console.warn(`Minima health poller: chain stall detected (block age ${blockAge}s, threshold ${env.minimaStallBlockAgeSeconds}s)`);

    if (!env.minimaAutoResync) return;
    if (!canAutoResync()) {
      console.warn("Minima health poller: auto-resync skipped (cooldown active)");
      return;
    }

    try {
      const result = await resyncMegammr();
      const parsed = parseMegammrResyncMessage(result.body);
      const message = parsed.message || (result.ok ? "resync completed" : "resync failed");
      recordAutoResync(message);
      console.log(`Minima health poller: auto-resync completed (${message})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "resync failed";
      recordAutoResync(message);
      console.error(`Minima health poller: auto-resync failed (${message})`);
    }
  } catch (error) {
    console.error("Minima health poller failed:", error instanceof Error ? error.message : error);
  } finally {
    pollRunning = false;
  }
}

export function startMinimaHealthPoller() {
  if (poller) return;

  const intervalMs = env.minimaHealthPollIntervalSeconds * 1000;
  const runPoll = () => {
    pollMinimaHealth().catch((error) => {
      console.error("Minima health poller failed:", error instanceof Error ? error.message : error);
    });
  };

  runPoll();
  poller = setInterval(runPoll, intervalMs);
}

export function stopMinimaHealthPoller() {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }
}
