import { getDataSource, updateDataSourceReadResult } from "../data-sources/dataSources.repository.js";
import { parseJsonApiConfig, readJsonApiSource, serializeDataSource } from "../data-sources/dataSources.service.js";
import { createDataSourceRead, linkDataSourceReadProof } from "../data-reads/dataReads.repository.js";
import { createProofRecord } from "../integritas/integritas.repository.js";
import {
  isIntegritasUnauthorizedErrorCode,
  isTransientIntegritasErrorCode,
  requestProofUid
} from "../integritas/integritas.service.js";
import type { IntegritasApiFailure } from "../integritas/integritas.types.js";
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
  let readId: string | null = null;
  let dataSourceSnapshot: { id: string; name: string; url: string } | null = null;
  try {
    const dataSource = getDataSource(workflow.data_source_id);
    if (!dataSource) throw new Error("Data source not found");
    if (dataSource.type === "webhook" || dataSource.type === "mqtt") throw new Error("Push-source workflows run when matching data is received");
    const config = parseJsonApiConfig(JSON.parse(dataSource.config) as unknown);
    dataSourceSnapshot = { id: dataSource.id, name: dataSource.name, url: config.url };

    const readResult = await readJsonApiSource(config);
    const updatedSource = updateDataSourceReadResult(dataSource.id, { hash: readResult.bytesHash, preview: readResult.preview });
    lastHash = readResult.bytesHash;
    const readRecord = createDataSourceRead({ dataSourceId: dataSource.id, workflowId: workflow.id, sourceName: dataSource.name, sourceUrl: config.url, triggerType: "automation", status: "success", hash: readResult.bytesHash, preview: readResult.preview });
    readId = readRecord.id;

    if (workflow.stamp_with_integritas) {
      const apiKey = getIntegritasApiKey();
      if (!apiKey) throw new Error("Integritas API key is not configured");

      const stamp = await requestProofUid({ apiKey, hash: readResult.bytesHash });
      if (!stamp.ok) {
        const stampFailure = handleAutomationStampFailure(id, stamp, readResult.bytesHash, updatedSource);
        if (stampFailure) return stampFailure;
        throw new Error(formatIntegritasStampError(stamp));
      }

      const proof = createProofRecord({ fileName: `Automation: ${dataSource.name}`, fileSize: Buffer.byteLength(readResult.canonicalBytes, "utf8"), hash: readResult.bytesHash, proofUid: stamp.proofUid, proofStatus: "pending" });
      proofId = proof.id;
      linkDataSourceReadProof(readId, proof.id);
    }

    const updatedWorkflow = updateAutomationRunSuccess(id, { hash: readResult.bytesHash, proofId });
    return { workflow: serializeAutomationWorkflow(updatedWorkflow), dataSource: serializeDataSource(updatedSource), proofId };
  } catch (error) {
    if (!readId && dataSourceSnapshot) {
      createDataSourceRead({ dataSourceId: dataSourceSnapshot.id, workflowId: workflow.id, sourceName: dataSourceSnapshot.name, sourceUrl: dataSourceSnapshot.url, triggerType: "automation", status: "failed", hash: lastHash, error: error instanceof Error ? error.message : "Automation workflow failed" });
    }
    const updatedWorkflow = updateAutomationRunError(id, error instanceof Error ? error.message : "Automation workflow failed", { hash: lastHash, proofId });
    throw Object.assign(error instanceof Error ? error : new Error("Automation workflow failed"), { workflow: serializeAutomationWorkflow(updatedWorkflow) });
  } finally {
    runningWorkflowIds.delete(id);
  }
}

export async function recordPushAutomationPayload(input: {
  workflow: AutomationWorkflowRecord;
  dataSource: { id: string; name: string };
  sourceUrl: string;
  triggerType: "webhook" | "mqtt";
  result: { bytesHash: string; preview: unknown; canonicalBytes: string };
}) {
  let proofId: string | null = null;
  const updatedSource = updateDataSourceReadResult(input.dataSource.id, { hash: input.result.bytesHash, preview: input.result.preview });
  const readRecord = createDataSourceRead({ dataSourceId: input.dataSource.id, workflowId: input.workflow.id, sourceName: input.dataSource.name, sourceUrl: input.sourceUrl, triggerType: input.triggerType, status: "success", hash: input.result.bytesHash, preview: input.result.preview });

  try {
    if (input.workflow.stamp_with_integritas) {
      const apiKey = getIntegritasApiKey();
      if (!apiKey) throw new Error("Integritas API key is not configured");

      const stamp = await requestProofUid({ apiKey, hash: input.result.bytesHash });
      if (!stamp.ok) {
        const stampFailure = handleAutomationStampFailure(input.workflow.id, stamp, input.result.bytesHash, updatedSource);
        if (stampFailure) return stampFailure;
        throw new Error(formatIntegritasStampError(stamp));
      }

      const proof = createProofRecord({ fileName: `Automation: ${input.dataSource.name}`, fileSize: Buffer.byteLength(input.result.canonicalBytes, "utf8"), hash: input.result.bytesHash, proofUid: stamp.proofUid, proofStatus: "pending" });
      proofId = proof.id;
      linkDataSourceReadProof(readRecord.id, proof.id);
    }

    const updatedWorkflow = updateAutomationRunSuccess(input.workflow.id, { hash: input.result.bytesHash, proofId });
    return { workflow: serializeAutomationWorkflow(updatedWorkflow), dataSource: serializeDataSource(updatedSource), proofId };
  } catch (error) {
    const updatedWorkflow = updateAutomationRunError(input.workflow.id, error instanceof Error ? error.message : "Push workflow failed", { hash: input.result.bytesHash, proofId });
    throw Object.assign(error instanceof Error ? error : new Error("Push workflow failed"), { workflow: serializeAutomationWorkflow(updatedWorkflow) });
  }
}

export function recordPushAutomationError(input: { workflow: AutomationWorkflowRecord; dataSource: { id: string; name: string }; sourceUrl: string; triggerType: "webhook" | "mqtt"; error: string }) {
  updateDataSourceReadResult(input.dataSource.id, { error: input.error });
  createDataSourceRead({ dataSourceId: input.dataSource.id, workflowId: input.workflow.id, sourceName: input.dataSource.name, sourceUrl: input.sourceUrl, triggerType: input.triggerType, status: "failed", error: input.error });
  const updatedWorkflow = updateAutomationRunError(input.workflow.id, input.error);
  return { workflow: serializeAutomationWorkflow(updatedWorkflow) };
}

function handleAutomationStampFailure(
  workflowId: string,
  stamp: IntegritasApiFailure,
  hash: string,
  updatedSource: ReturnType<typeof updateDataSourceReadResult>
) {
  const message = formatIntegritasStampError(stamp);

  if (isTransientIntegritasErrorCode(stamp.errorCode)) {
    const updatedWorkflow = updateAutomationRunSuccess(workflowId, {
      hash,
      proofId: null,
      lastError: `${message} Stamp will retry on the next scheduled run.`
    });
    return { workflow: serializeAutomationWorkflow(updatedWorkflow), dataSource: serializeDataSource(updatedSource), proofId: null, stampRetryPending: true };
  }

  if (isIntegritasUnauthorizedErrorCode(stamp.errorCode)) {
    const updatedWorkflow = updateAutomationRunSuccess(workflowId, {
      hash,
      proofId: null,
      lastError: "Integritas API key rejected. Update the API key before stamping can succeed."
    });
    return { workflow: serializeAutomationWorkflow(updatedWorkflow), dataSource: serializeDataSource(updatedSource), proofId: null, stampRetryPending: false };
  }

  return null;
}

function formatIntegritasStampError(stamp: IntegritasApiFailure) {
  return `${stamp.error} (${stamp.errorCode}): HTTP ${stamp.status} ${JSON.stringify(stamp.responseBody)}`;
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

export function stopAutomationScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}
