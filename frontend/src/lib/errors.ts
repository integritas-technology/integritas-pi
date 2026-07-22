export type UiError = {
  domain: string;
  type: string;
  title: string;
  message: string;
  nativeMessage?: string;
  nativeCode?: string;
  context?: Record<string, unknown>;
  occurredAt?: string;
  raw: unknown;
};

export function normalizeError(value: unknown, fallbackTitle = "Error"): UiError {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const details = record.errorDetails && typeof record.errorDetails === "object" ? record.errorDetails as Record<string, unknown> : record;
    if (typeof details.message === "string") {
      const type = typeof details.type === "string" ? details.type : "unknown";
      return {
        domain: typeof details.domain === "string" ? details.domain : "unknown",
        type,
        title: titleFromType(type, fallbackTitle),
        message: details.message,
        nativeMessage: typeof details.nativeMessage === "string" ? details.nativeMessage : undefined,
        nativeCode: typeof details.nativeCode === "string" ? details.nativeCode : undefined,
        context: details.context && typeof details.context === "object" && !Array.isArray(details.context) ? details.context as Record<string, unknown> : undefined,
        occurredAt: typeof details.occurredAt === "string" ? details.occurredAt : undefined,
        raw: value
      };
    }
  }

  if (typeof value === "string") {
    return { domain: "unknown", type: "unknown", title: fallbackTitle, message: value, raw: value };
  }

  return { domain: "unknown", type: "unknown", title: fallbackTitle, message: "Unknown error", raw: value };
}

export function titleFromType(type: string, fallback: string) {
  if (type === "command_unavailable") return "Command unavailable";
  if (type === "hardware_unavailable") return "Hardware unavailable";
  if (type === "invalid_payload") return "Invalid payload";
  if (type === "connection_failed") return "Connection failed";
  if (type === "validation_failed") return "Validation failed";
  if (type === "not_found") return "Not found";
  if (type === "forbidden") return "Permission denied";
  if (type === "conflict") return "Conflict";
  if (type === "dependency_unavailable") return "Dependency unavailable";
  if (type === "unexpected") return "Unexpected error";
  if (type === "unknown") return fallback;
  return type.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
