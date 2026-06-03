import type { DataSourceReadRecord } from "./dataReads.repository.js";

export function serializeDataSourceRead(record: DataSourceReadRecord) {
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
    error: record.error
  };
}
