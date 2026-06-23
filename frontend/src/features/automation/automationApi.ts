import { deleteJson, getJson, patchJson, postJson } from "../../lib/api";
import type { AutomationWorkflow } from "./automationTypes";

export async function listAutomationWorkflows() {
  return getJson<{ items: AutomationWorkflow[] }>("/api/automation/workflows");
}

export async function createAutomationWorkflow(input: { name: string; dataSourceId: string; enabled: boolean; pollingIntervalSeconds: number; stampWithIntegritas: boolean }) {
  return postJson<{ item: AutomationWorkflow }>("/api/automation/workflows", input);
}

export async function updateAutomationWorkflow(id: string, input: Partial<Pick<AutomationWorkflow, "name" | "enabled" | "pollingIntervalSeconds" | "stampWithIntegritas">>) {
  return patchJson<{ item: AutomationWorkflow }>(`/api/automation/workflows/${id}`, input);
}

export async function addAutomationRule(workflowId: string, input: { type: "stamp_integritas" }) {
  return postJson<{ item: AutomationWorkflow["rules"][number]; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/rules`, input);
}

export async function deleteAutomationRule(workflowId: string, ruleId: string) {
  return deleteJson<{ deleted: boolean; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/rules/${ruleId}`);
}

export async function deleteAutomationWorkflow(id: string) {
  return deleteJson<{ deleted: boolean }>(`/api/automation/workflows/${id}`);
}

export async function runAutomationWorkflow(id: string) {
  return postJson<{ workflow: AutomationWorkflow; proofId: string | null }>(`/api/automation/workflows/${id}/run`);
}
