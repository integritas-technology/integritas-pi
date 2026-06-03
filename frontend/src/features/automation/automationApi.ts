import type { AutomationWorkflow } from "./automationTypes";

async function parseResponse<T>(response: Response): Promise<T> {
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as T;
}

export async function listAutomationWorkflows() {
  return parseResponse<{ items: AutomationWorkflow[] }>(await fetch("/api/automation/workflows"));
}

export async function createAutomationWorkflow(input: { name: string; dataSourceId: string; enabled: boolean; pollingIntervalSeconds: number; stampWithIntegritas: boolean }) {
  return parseResponse<{ item: AutomationWorkflow }>(await fetch("/api/automation/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}

export async function updateAutomationWorkflow(id: string, input: Partial<Pick<AutomationWorkflow, "name" | "enabled" | "pollingIntervalSeconds" | "stampWithIntegritas">>) {
  return parseResponse<{ item: AutomationWorkflow }>(await fetch(`/api/automation/workflows/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}

export async function deleteAutomationWorkflow(id: string) {
  return parseResponse<{ deleted: boolean }>(await fetch(`/api/automation/workflows/${id}`, { method: "DELETE" }));
}

export async function runAutomationWorkflow(id: string) {
  return parseResponse<{ workflow: AutomationWorkflow; proofId: string | null }>(await fetch(`/api/automation/workflows/${id}/run`, { method: "POST" }));
}
