import { getJson, postForm, postJson } from "../../lib/api";
import { buildListQueryString, type ListQueryParams } from "../../lib/paginated";
import type { IntegritasApiKeyCheck, IntegritasHistoryPage, IntegritasProofRecord } from "./integritasTypes";

export async function checkIntegritasApiKey() {
  return postJson<IntegritasApiKeyCheck>("/api/integritas/api-key/check");
}

export async function getHistory(params: ListQueryParams = { page: 1, pageSize: 50 }) {
  return getJson<IntegritasHistoryPage>(`/api/integritas/history${buildListQueryString(params)}`);
}

export async function getHistoryRecord(id: string) {
  return getJson<{ record: IntegritasProofRecord }>(`/api/integritas/history/${id}`);
}

export async function stampFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return postForm<{ record: IntegritasProofRecord }>("/api/integritas/stamp-file", form);
}

export async function pollPendingRecords(params: ListQueryParams = { page: 1, pageSize: 50 }) {
  return postJson<IntegritasHistoryPage>(
    `/api/integritas/history/poll-pending${buildListQueryString(params)}`,
  );
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
