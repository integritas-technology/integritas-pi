import { JsonPreview } from "../../components/JsonPreview";
import type { IntegritasProofRecord } from "./integritasTypes";

export function IntegritasHistoryTable({ records, selectedIds, onToggle, onPoll, onVerify, onDeleteSelected, onDownloadSelected, busy }: { records: IntegritasProofRecord[]; selectedIds: string[]; onToggle: (id: string) => void; onPoll: (record: IntegritasProofRecord) => void; onVerify: (record: IntegritasProofRecord) => void; onDeleteSelected: () => void; onDownloadSelected: () => void; busy: boolean }) {
  return (
    <section className="card history-card">
      <div className="status-row">
        <div><strong>Proof history</strong><p className="muted">Stored timestamp proof requests and status responses.</p></div>
        {selectedIds.length > 0 && <div className="button-row"><button type="button" disabled={busy} onClick={onDownloadSelected}>Download all selected</button><button type="button" disabled={busy} onClick={onDeleteSelected}>Delete all selected</button></div>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Select</th><th>Timestamp</th><th>UID</th><th>Data hash</th><th>Status</th><th>Proof payload JSON</th><th>Actions</th></tr></thead>
          <tbody>
            {records.map((record) => {
              const hasPayload = Boolean(record.proof_payload);
              return (
                <tr key={record.id}>
                  <td><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => onToggle(record.id)} /></td>
                  <td>{record.created_at}</td>
                  <td>{record.proof_uid ?? ""}</td>
                  <td><code>{record.hash}</code></td>
                  <td>{record.proof_status}</td>
                  <td>{hasPayload ? <JsonPreview value={JSON.parse(record.proof_payload!)} /> : <span className="muted">Not ready</span>}</td>
                  <td><div className="row-actions"><button type="button" disabled={busy || !record.proof_uid} onClick={() => onPoll(record)}>Poll proof status</button><button type="button" disabled={busy || !hasPayload} onClick={() => onVerify(record)}>Verify</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {records.length === 0 && <p className="muted">No proof history yet.</p>}
    </section>
  );
}
