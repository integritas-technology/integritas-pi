import type { IntegritasProofRecord } from "./integritasTypes";

export async function getHistory() {
  const response = await fetch("/api/integritas/history");
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { items: IntegritasProofRecord[] };
}

export async function stampFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/integritas/stamp-file", { method: "POST", body: form });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { record: IntegritasProofRecord };
}

export async function pollRecord(id: string) {
  const response = await fetch(`/api/integritas/history/${id}/poll`, { method: "POST" });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { record: IntegritasProofRecord };
}

export async function verifyRecord(id: string) {
  const response = await fetch(`/api/integritas/history/${id}/verify`, { method: "POST" });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { record: IntegritasProofRecord; response: unknown };
}

export async function verifyProofFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/integritas/verify-proof-file", { method: "POST", body: form });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as { response: unknown };
}

export async function deleteSelected(ids: string[]) {
  const response = await fetch("/api/integritas/history/delete-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed;
}

export async function downloadSelected(ids: string[]) {
  const response = await fetch("/api/integritas/history/export-selected", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
  if (!response.ok) {
    const parsed = await response.json();
    throw new Error(parsed?.error || `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "integritas-proofs.json";
  link.click();
  URL.revokeObjectURL(url);
}
