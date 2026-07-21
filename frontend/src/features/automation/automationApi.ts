import { deleteJson, getJson, patchJson, postJson } from "../../lib/api";
import { buildListQueryString, DEFAULT_PAGE_SIZE, type ListQueryParams, type PaginatedResponse } from "../../lib/paginated";
import type { AutomationBlock, AutomationBlockType, AutomationRun, AutomationValidationResult, AutomationWorkflow } from "./automationTypes";

export async function listAutomationWorkflows() {
  return getJson<{ items: AutomationWorkflow[] }>("/api/automation/workflows");
}

export async function createAutomationWorkflow(input: { name: string; enabled: boolean; blocks: { type: AutomationBlockType; config?: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null; clientId?: string | null }[] } | { name: string; dataSourceId: string; enabled: boolean; pollingIntervalSeconds: number; stampWithIntegritas: boolean }) {
  return postJson<{ item: AutomationWorkflow }>("/api/automation/workflows", input);
}

export async function validateAutomationDraft(input: { blocks: { type: AutomationBlockType; config?: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null; clientId?: string | null }[] }) {
  return postJson<{ item: AutomationValidationResult }>("/api/automation/workflows/validate-draft", input);
}

export async function updateAutomationWorkflow(id: string, input: Partial<Pick<AutomationWorkflow, "name" | "enabled" | "archived" | "pollingIntervalSeconds" | "stampWithIntegritas">>) {
  return patchJson<{ item: AutomationWorkflow }>(`/api/automation/workflows/${id}`, input);
}

export async function duplicateAutomationWorkflow(id: string) {
  return postJson<{ item: AutomationWorkflow }>(`/api/automation/workflows/${id}/duplicate`);
}

export async function addAutomationRule(workflowId: string, input: { type: "stamp_integritas" }) {
  return postJson<{ item: AutomationWorkflow["rules"][number]; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/rules`, input);
}

export async function addAutomationBlock(workflowId: string, input: { type: AutomationBlockType; config?: AutomationBlock["config"]; enabled?: boolean; parentBlockId?: string | null }) {
  return postJson<{ item: AutomationBlock; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/blocks`, input);
}

export async function deleteAutomationBlock(workflowId: string, blockId: string) {
  return deleteJson<{ deleted: boolean; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/blocks/${blockId}`);
}

export async function updateAutomationBlock(workflowId: string, blockId: string, input: { config?: AutomationBlock["config"]; enabled?: boolean }) {
  return patchJson<{ item: AutomationBlock; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/blocks/${blockId}`, input);
}

export async function reorderAutomationBlocks(workflowId: string, blockIds: string[]) {
  return postJson<{ items: AutomationBlock[]; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/blocks/reorder`, { blockIds });
}

export async function deleteAutomationRule(workflowId: string, ruleId: string) {
  return deleteJson<{ deleted: boolean; workflow: AutomationWorkflow }>(`/api/automation/workflows/${workflowId}/rules/${ruleId}`);
}

export async function deleteAutomationWorkflow(id: string) {
  return deleteJson<{ deleted: boolean }>(`/api/automation/workflows/${id}`);
}

export async function runAutomationWorkflow(id: string, triggerPayload?: unknown) {
  return postJson<{ workflow: AutomationWorkflow; proofId: string | null }>(`/api/automation/workflows/${id}/run`, triggerPayload === undefined ? undefined : { triggerPayload });
}

export async function listAutomationRuns(params: ListQueryParams = { page: 1, pageSize: DEFAULT_PAGE_SIZE }) {
  return getJson<PaginatedResponse<AutomationRun>>(`/api/automation/runs${buildListQueryString(params)}`);
}

export async function listAutomationWorkflowRuns(workflowId: string, limit = 20) {
  return getJson<{ items: AutomationRun[] }>(`/api/automation/workflows/${workflowId}/runs?limit=${limit}`);
}

export async function getAutomationWorkflowValidation(workflowId: string) {
  return getJson<{ item: AutomationValidationResult }>(`/api/automation/workflows/${workflowId}/validation`);
}
