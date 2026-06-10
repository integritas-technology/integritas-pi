import { getJson, postForm, postJson } from "../../lib/api";
import type { IntegritasProofRecord } from "./integritasTypes";

export async function getHistory() {
  return getJson<{ items: IntegritasProofRecord[] }>("/api/integritas/history");
}

export async function stampFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return postForm<{ record: IntegritasProofRecord }>("/api/integritas/stamp-file", form);
}

export async function pollPendingRecords() {
  return postJson<{ items: IntegritasProofRecord[] }>("/api/integritas/history/poll-pending");
}

export async function verifyRecord(id: string) {
  return postJson<{ record: IntegritasProofRecord; response: unknown }>(`/api/integritas/history/${id}/verify`);
}

export async function verifyProofFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return postForm<{ response: unknown }>("/api/integritas/verify-proof-file", form);
}

export async function deleteSelected(ids: string[]) {
  return postJson("/api/integritas/history/delete-selected", { ids });
}

export async function downloadSelected(ids: string[]) {
  const response = await fetch("/api/integritas/history/export-selected", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
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
