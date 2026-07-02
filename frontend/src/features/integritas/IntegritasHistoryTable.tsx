import { RefreshCcwIcon } from 'lucide-react';
import { JsonPreview } from '../../components/JsonPreview';
import type { IntegritasProofRecord } from './integritasTypes';

export function IntegritasHistoryTable({
  records,
  selectedIds,
  filtered,
  pendingTotal,
  onToggle,
  onRefreshPending,
  onVerify,
  onDeleteSelected,
  onDownloadSelected,
  busy,
}: {
  records: IntegritasProofRecord[];
  selectedIds: string[];
  filtered?: boolean;
  pendingTotal: number;
  onToggle: (id: string) => void;
  onRefreshPending: () => void;
  onVerify: (record: IntegritasProofRecord) => void;
  onDeleteSelected: () => void;
  onDownloadSelected: () => void;
  busy: boolean;
}) {
  return (
    <section className='card history-card'>
      <div className='status-row'>
        <div>
          <strong>Proof history</strong>
          <p className='muted'>
            Stored timestamp proof requests and status responses. Pending rows
            update automatically; use refresh to check Integritas now.
          </p>
        </div>
        <div className='button-row'>
          <button
            className='flex items-center gap-2'
            type='button'
            disabled={busy || pendingTotal === 0}
            onClick={onRefreshPending}
          >
            <RefreshCcwIcon size={20} />
            <span className='text-sm font-medium'>({pendingTotal})</span>
          </button>
          {selectedIds.length > 0 && (
            <>
              <button
                type='button'
                disabled={busy}
                onClick={onDownloadSelected}
              >
                Download all selected
              </button>
              <button type='button' disabled={busy} onClick={onDeleteSelected}>
                Delete all selected
              </button>
            </>
          )}
        </div>
      </div>
      <div className='table-wrap'>
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Timestamp</th>
              <th>UID</th>
              <th>Data hash</th>
              <th>Status</th>
              <th>Proof payload JSON</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const hasPayload = Boolean(record.proof_payload);
              return (
                <tr key={record.id}>
                  <td>
                    <input
                      type='checkbox'
                      checked={selectedIds.includes(record.id)}
                      onChange={() => onToggle(record.id)}
                    />
                  </td>
                  <td>{record.created_at}</td>
                  <td>{record.proof_uid ?? ''}</td>
                  <td>
                    <code>{record.hash}</code>
                  </td>
                  <td>{record.proof_status}</td>
                  <td>
                    {hasPayload ? (
                      <JsonPreview value={JSON.parse(record.proof_payload!)} />
                    ) : (
                      <span className='muted'>Not ready</span>
                    )}
                  </td>
                  <td>
                    <div className='row-actions'>
                      <button
                        type='button'
                        disabled={busy || !hasPayload}
                        onClick={() => onVerify(record)}
                      >
                        Verify
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {records.length === 0 && (
        <p className='muted'>{filtered ? 'No matching proof history.' : 'No proof history yet.'}</p>
      )}
    </section>
  );
}
