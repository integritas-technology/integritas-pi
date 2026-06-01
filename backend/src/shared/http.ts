export function parseResponseBody(responseText: string) {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

export async function fetchJsonWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { response, body: parseResponseBody(text) };
  } finally {
    clearTimeout(timeout);
  }
}
