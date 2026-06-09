type ApiError = Error & { status?: number };

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

async function parseResponse<T>(response: Response): Promise<T> {
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && onUnauthorized && !isPublicAuthPath(response.url)) {
      onUnauthorized();
    }
    const error = new Error(
      typeof parsed?.error === "string" ? parsed.error : `HTTP ${response.status}`
    ) as ApiError;
    error.status = response.status;
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
