export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as T;
}
