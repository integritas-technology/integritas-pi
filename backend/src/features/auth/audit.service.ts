import { insertAuditEvent } from "./auth.repository.js";

export function recordAuditEvent(action: string, options?: { userId?: string | null; detail?: string }) {
  insertAuditEvent({
    userId: options?.userId,
    action,
    detail: options?.detail
  });
}
