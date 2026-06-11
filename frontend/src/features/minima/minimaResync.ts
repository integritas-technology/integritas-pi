import type { MinimaCommandResult } from "../../app/types";

export function parseMegammrResyncResult(result: MinimaCommandResult) {
  const body = result.body;
  const envelope = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const response = envelope?.response && typeof envelope.response === "object"
    ? (envelope.response as Record<string, unknown>)
    : null;
  const message = typeof response?.message === "string" ? response.message.trim() : "";
  const rpcOk = envelope?.status === true && result.ok;
  const needsRestart = /restart/i.test(message);
  const finished = /finish|fininshed/i.test(message);

  return { rpcOk, message, needsRestart, finished };
}

export function resyncToastForResult(
  result: MinimaCommandResult,
  options?: { restartedContainer?: boolean }
) {
  const parsed = parseMegammrResyncResult(result);

  if (!parsed.rpcOk) {
    return {
      tone: "error" as const,
      title: "Megammr resync failed",
      message: parsed.message || "Minima RPC returned an error."
    };
  }

  if (options?.restartedContainer) {
    return {
      tone: "success" as const,
      title: "Resync complete",
      message: "Minima container restarted. Node health will update shortly."
    };
  }

  if (parsed.needsRestart) {
    return {
      tone: "info" as const,
      title: "Megammr resync complete",
      message: "Restarting the Minima container…"
    };
  }

  if (parsed.finished) {
    return {
      tone: "success" as const,
      title: "Megammr resync complete",
      message: parsed.message || "Check node health for sync progress."
    };
  }

  return {
    tone: "success" as const,
    title: "Megammr resync requested",
    message: "Minima is processing the resync. Monitoring will resume shortly."
  };
}
