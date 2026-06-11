import type { ApiError } from "../../lib/api";

export function integritasErrorToast(error: unknown): { title: string; message: string } {
  const err = error as ApiError;

  if (err.errorCode === "unauthorized") {
    return {
      title: "Integritas API key rejected",
      message: "The stored API key is no longer valid. Open Configure Integritas and save a current key. Your login session is unchanged."
    };
  }

  if (err.errorCode === "rate_limited") {
    return {
      title: "Integritas rate limit",
      message: err.message || "Integritas asked us to wait before retrying. Try again shortly."
    };
  }

  if (err.errorCode === "upstream_unavailable") {
    return {
      title: "Integritas temporarily unavailable",
      message: err.message || "The Integritas service could not be reached. Try again shortly."
    };
  }

  return {
    title: "Integritas action failed",
    message: err instanceof Error ? err.message : "Unknown error"
  };
}
