import { getDataSource, updateDataSourceReadResult } from "../data-sources/dataSources.repository.js";
import { parseJsonApiConfig, readJsonApiSource, serializeDataSource } from "../data-sources/dataSources.service.js";
import { createProofRecord } from "../integritas/integritas.repository.js";
import { requestProofUid } from "../integritas/integritas.service.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { getAutomationWorkflow, listDueAutomationWorkflows, updateAutomationRunError, updateAutomationRunSuccess, type AutomationWorkflowRecord } from "./automation.repository.js";

const runningWorkflowIds = new Set<string>();
let scheduler: NodeJS.Timeout | null = null;

export function serializeAutomationWorkflow(record: AutomationWorkflowRecord) {
  return {
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    name: record.name,
    dataSourceId: record.data_source_id,
    enabled: Boolean(record.enabled),
    pollingIntervalSeconds: record.polling_interval_seconds,
    stampWithIntegritas: Boolean(record.stamp_with_integritas),
    lastRunAt: record.last_run_at,
    nextRunAt: record.next_run_at,
    lastHash: record.last_hash,
    lastProofId: record.last_proof_id,
    lastError: record.last_error
  };
}

export async function runAutomationWorkflow(id: string) {
  const workflow = getAutomationWorkflow(id);
  if (!workflow) throw new Error("Automation workflow not found");
  if (runningWorkflowIds.has(id)) throw new Error("Automation workflow is already running");

  runningWorkflowIds.add(id);
  let lastHash: string | undefined;
  let proofId: string | null = null;
  try {
    const dataSource = getDataSource(workflow.data_source_id);
    if (!dataSource) throw new Error("Data source not found");

    const readResult = await readJsonApiSource(parseJsonApiConfig(JSON.parse(dataSource.config) as unknown));
    const updatedSource = updateDataSourceReadResult(dataSource.id, { hash: readResult.bytesHash, preview: readResult.preview });
    lastHash = readResult.bytesHash;

    if (workflow.stamp_with_integritas) {
      const apiKey = getIntegritasApiKey();
      if (!apiKey) throw new Error("Integritas API key is not configured");
      const stamp = await requestProofUid({ apiKey, hash: readResult.bytesHash });
      if (!stamp.ok) throw new Error(formatIntegritasStampError(stamp));
      const proof = createProofRecord({ fileName: `Automation: ${dataSource.name}`, fileSize: Buffer.byteLength(readResult.canonicalBytes, "utf8"), hash: readResult.bytesHash, proofUid: stamp.proofUid, proofStatus: "pending" });
      proofId = proof.id;
    }

    const updatedWorkflow = updateAutomationRunSuccess(id, { hash: readResult.bytesHash, proofId });
    return { workflow: serializeAutomationWorkflow(updatedWorkflow), dataSource: serializeDataSource(updatedSource), proofId };
  } catch (error) {
    const updatedWorkflow = updateAutomationRunError(id, error instanceof Error ? error.message : "Automation workflow failed", { hash: lastHash, proofId });
    throw Object.assign(error instanceof Error ? error : new Error("Automation workflow failed"), { workflow: serializeAutomationWorkflow(updatedWorkflow) });
  } finally {
    runningWorkflowIds.delete(id);
  }
}

function formatIntegritasStampError(stamp: { status: number; error: string; responseBody: unknown }) {
  return `${stamp.error}: HTTP ${stamp.status} ${JSON.stringify(stamp.responseBody)}`;
}

export function startAutomationScheduler() {
  if (scheduler) return;
  scheduler = setInterval(() => {
    const due = listDueAutomationWorkflows(new Date().toISOString()).filter((workflow) => !runningWorkflowIds.has(workflow.id));
    for (const workflow of due) {
      runAutomationWorkflow(workflow.id).catch((error: Error) => console.error(`Automation workflow ${workflow.id} failed: ${error.message}`));
    }
  }, 5000);
}
