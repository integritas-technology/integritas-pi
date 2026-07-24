export type StructuredErrorDomain = "data_source" | "workflow" | "block" | "integritas" | "app" | "system" | "unknown";

export type StructuredError = {
  domain: StructuredErrorDomain;
  type: string;
  message: string;
  nativeMessage?: string;
  nativeCode?: string;
  context?: Record<string, unknown>;
  occurredAt?: string;
};

export function structuredError(input: Omit<StructuredError, "occurredAt"> & { occurredAt?: string }): StructuredError {
  return { ...input, occurredAt: input.occurredAt ?? new Date().toISOString() };
}

export function dataSourceError(input: { type: string; message: string; nativeMessage?: string; nativeCode?: string; context?: Record<string, unknown> }) {
  return structuredError({ domain: "data_source", ...input });
}

export function workflowError(input: { type: string; message: string; nativeMessage?: string; nativeCode?: string; context?: Record<string, unknown> }) {
  return structuredError({ domain: "workflow", ...input });
}

export function blockError(input: { type: string; message: string; nativeMessage?: string; nativeCode?: string; context?: Record<string, unknown> }) {
  return structuredError({ domain: "block", ...input });
}

export function appError(input: { type: string; message: string; nativeMessage?: string; nativeCode?: string; context?: Record<string, unknown> }) {
  return structuredError({ domain: "app", ...input });
}

export function systemError(input: { type: string; message: string; nativeMessage?: string; nativeCode?: string; context?: Record<string, unknown> }) {
  return structuredError({ domain: "system", ...input });
}

export function serializeStructuredError(error: StructuredError | string | null | undefined) {
  if (error === null || error === undefined) return null;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export function parseStoredError(error: string | null | undefined): StructuredError | null {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error) as Partial<StructuredError>;
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      return {
        domain: isDomain(parsed.domain) ? parsed.domain : "unknown",
        type: typeof parsed.type === "string" ? parsed.type : "unknown",
        message: parsed.message,
        nativeMessage: typeof parsed.nativeMessage === "string" ? parsed.nativeMessage : undefined,
        nativeCode: typeof parsed.nativeCode === "string" ? parsed.nativeCode : undefined,
        context: parsed.context && typeof parsed.context === "object" && !Array.isArray(parsed.context) ? parsed.context as Record<string, unknown> : undefined,
        occurredAt: typeof parsed.occurredAt === "string" ? parsed.occurredAt : undefined
      };
    }
  } catch {
    // Legacy string error.
  }
  return { domain: "unknown", type: "unknown", message: error };
}

export function errorMessage(error: StructuredError | string | null | undefined) {
  if (!error) return null;
  return typeof error === "string" ? parseStoredError(error)?.message ?? error : error.message;
}

export function errorFromUnknown(error: unknown, fallback: string, context?: Record<string, unknown>) {
  const nativeMessage = error instanceof Error ? error.message : undefined;
  const nativeCode = error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;
  return { message: nativeMessage ?? fallback, nativeMessage, nativeCode, context };
}

function isDomain(value: unknown): value is StructuredErrorDomain {
  return value === "data_source" || value === "workflow" || value === "block" || value === "integritas" || value === "app" || value === "system" || value === "unknown";
}
