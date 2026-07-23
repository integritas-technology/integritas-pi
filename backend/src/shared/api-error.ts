import type { Response } from "express";
import { appError, systemError, type StructuredError } from "./structured-error.js";

export function sendApiError(res: Response, status: number, error: StructuredError, extra: Record<string, unknown> = {}) {
  return res.status(status).json({ ...extra, error: error.message, errorDetails: error });
}

export function badRequest(res: Response, message: string, context?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return sendApiError(res, 400, appError({ type: "bad_request", message, context }), extra);
}

export function validationFailed(res: Response, message: string, fieldErrors?: Record<string, string>, extra: Record<string, unknown> = {}) {
  return sendApiError(res, 400, appError({ type: "validation_failed", message, context: fieldErrors ? { fieldErrors } : undefined }), extra);
}

export function unauthorized(res: Response, message = "Unauthorized", extra: Record<string, unknown> = {}) {
  return sendApiError(res, 401, appError({ type: "unauthorized", message }), extra);
}

export function forbidden(res: Response, message = "Forbidden", extra: Record<string, unknown> = {}) {
  return sendApiError(res, 403, appError({ type: "forbidden", message }), extra);
}

export function notFound(res: Response, message: string, extra: Record<string, unknown> = {}) {
  return sendApiError(res, 404, appError({ type: "not_found", message }), extra);
}

export function conflict(res: Response, message: string, context?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return sendApiError(res, 409, appError({ type: "conflict", message, context }), extra);
}

export function dependencyUnavailable(res: Response, message: string, nativeMessage?: string, context?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return sendApiError(res, 502, systemError({ type: "dependency_unavailable", message, nativeMessage, context }), extra);
}

export function unexpected(res: Response, message: string, nativeError?: unknown, context?: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const nativeMessage = nativeError instanceof Error ? nativeError.message : undefined;
  return sendApiError(res, 500, systemError({ type: "unexpected", message, nativeMessage, context }), extra);
}

export function apiErrorFromStatus(res: Response, status: number, message: string, extra: Record<string, unknown> = {}) {
  if (status === 400) return badRequest(res, message, undefined, extra);
  if (status === 401) return unauthorized(res, message, extra);
  if (status === 403) return forbidden(res, message, extra);
  if (status === 404) return notFound(res, message, extra);
  if (status === 409) return conflict(res, message, undefined, extra);
  return sendApiError(res, status, status >= 500 ? systemError({ type: "unexpected", message }) : appError({ type: "bad_request", message }), extra);
}
