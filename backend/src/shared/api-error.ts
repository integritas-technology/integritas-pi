import type { Response } from "express";
import { appError, systemError, type StructuredError } from "./structured-error.js";

export function sendApiError(res: Response, status: number, error: StructuredError, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ error: error.message, errorDetails: error, ...extra });
}

export function badRequest(res: Response, message: string, context?: Record<string, unknown>) {
  return sendApiError(res, 400, appError({ type: "bad_request", message, context }));
}

export function validationFailed(res: Response, message: string, fieldErrors?: Record<string, string>) {
  return sendApiError(res, 400, appError({ type: "validation_failed", message, context: fieldErrors ? { fieldErrors } : undefined }));
}

export function notFound(res: Response, message: string) {
  return sendApiError(res, 404, appError({ type: "not_found", message }));
}

export function conflict(res: Response, message: string, context?: Record<string, unknown>) {
  return sendApiError(res, 409, appError({ type: "conflict", message, context }));
}

export function dependencyUnavailable(res: Response, message: string, nativeMessage?: string, context?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return sendApiError(res, 502, systemError({ type: "dependency_unavailable", message, nativeMessage, context }), extra);
}
