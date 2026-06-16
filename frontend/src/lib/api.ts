export type ApiError = Error & { status?: number; errorCode?: string };

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function isPublicAuthPath(url: string) {
  return (
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/me") ||
    url.includes("/api/setup/")
  );
}

function shouldForceLogin(status: number, url: string, parsed: Record<string, unknown>) {
  if (status !== 401 || isPublicAuthPath(url)) return false;
  // Integritas and other app errors carry errorCode — not an expired browser session.
  if (typeof parsed.errorCode === "string") return false;
  return true;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    if (onUnauthorized && shouldForceLogin(response.status, response.url, parsed)) {
      onUnauthorized();
    }
    const error = new Error(
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed.message === "string"
          ? parsed.message
          : `HTTP ${response.status}`
    ) as ApiError;
    error.status = response.status;
    if (typeof parsed.errorCode === "string") error.errorCode = parsed.errorCode;
    throw error;
  }
  return parsed as T;
}

const defaultInit: RequestInit = {
  credentials: "include"
};

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, defaultInit);
  return parseResponse<T>(response);
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    ...defaultInit,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    ...defaultInit,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

export async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    ...defaultInit,
    method: "DELETE"
  });
  return parseResponse<T>(response);
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const response = await fetch(url, {
    ...defaultInit,
    method: "POST",
    body: form
  });
  return parseResponse<T>(response);
}
