import type { DataSourceReadRecord } from "./dataReads.repository.js";
import { errorMessage, parseStoredError } from "../../shared/structured-error.js";

export function serializeDataSourceRead(record: DataSourceReadRecord) {
  const errorDetails = parseStoredError(record.error);
  return {
    id: record.id,
    createdAt: record.created_at,
    dataSourceId: record.data_source_id,
    workflowId: record.workflow_id,
    integritasProofId: record.integritas_proof_id,
    sourceName: record.source_name,
    sourceUrl: record.source_url,
    triggerType: record.trigger_type,
    status: record.status,
    hash: record.hash,
    preview: record.preview_json ? JSON.parse(record.preview_json) as unknown : null,
    error: errorMessage(record.error),
    errorDetails,
    triggerSourceId: record.trigger_source_id,
    triggerPayload: record.trigger_payload_json ? JSON.parse(record.trigger_payload_json) as unknown : null,
    blockId: record.block_id
  };
}
