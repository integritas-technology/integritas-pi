import { RefreshCcwIcon } from 'lucide-react';
import { Button } from '../../components/Button';
import { ButtonRow } from '../../components/ButtonRow';
import {
  DataTable,
  EmptyTableState,
  RowActions,
  TableCard,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from '../../components/DataTable';
import { JsonPreview } from '../../components/JsonPreview';
import { Pill } from '../../components/Pill';
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
    <TableCard
      title='Proof history'
      description='Stored timestamp proof requests and status responses. Pending rows update automatically; use refresh to check Integritas now.'
      actions={
        <ButtonRow>
          <Button
            type='button'
            disabled={busy || pendingTotal === 0}
            onClick={onRefreshPending}
          >
            <RefreshCcwIcon size={20} />
            <span className='text-sm font-medium'>({pendingTotal})</span>
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button
                type='button'
                disabled={busy}
                onClick={onDownloadSelected}
              >
                Download all selected
              </Button>
              <Button type='button' variant='danger' disabled={busy} onClick={onDeleteSelected}>
                Delete all selected
              </Button>
            </>
          )}
        </ButtonRow>
      }
    >
      <TableWrap>
        <DataTable>
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={tableHeaderCellClass}>Select</th>
              <th className={tableHeaderCellClass}>Timestamp</th>
              <th className={tableHeaderCellClass}>UID</th>
              <th className={tableHeaderCellClass}>Data hash</th>
              <th className={tableHeaderCellClass}>Status</th>
              <th className={tableHeaderCellClass}>Proof payload JSON</th>
              <th className={tableHeaderCellClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const hasPayload = Boolean(record.proof_payload);
              return (
                <tr key={record.id} className={tableRowClass}>
                  <td className={tableCellClass}>
                    <input
                      className='size-4 rounded border-slate-300'
                      type='checkbox'
                      checked={selectedIds.includes(record.id)}
                      onChange={() => onToggle(record.id)}
                    />
                  </td>
                  <td className={tableCellClass}>{record.created_at}</td>
                  <td className={tableCellClass}>{record.proof_uid ?? ''}</td>
                  <td className={tableCellClass}>
                    <code>{record.hash}</code>
                  </td>
                  <td className={tableCellClass}><ProofStatusPill status={record.proof_status} /></td>
                  <td className={tableCellClass}>
                    {hasPayload ? (
                      <JsonPreview value={JSON.parse(record.proof_payload!)} />
                    ) : (
                      <span className='text-slate-500'>Not ready</span>
                    )}
                  </td>
                  <td className={tableCellClass}>
                    <RowActions>
                      <Button
                        type='button'
                        variant='secondary'
                        disabled={busy || !hasPayload}
                        onClick={() => onVerify(record)}
                      >
                        Verify
                      </Button>
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </TableWrap>
      {records.length === 0 && (
        <EmptyTableState>{filtered ? 'No matching proof history.' : 'No proof history yet.'}</EmptyTableState>
      )}
    </TableCard>
  );
}

function ProofStatusPill({ status }: { status: string | null }) {
  const normalized = status ?? 'unknown';
  const tone = normalized === 'completed' || normalized === 'confirmed' || normalized === 'success' || normalized === 'on-chain' ? 'good' : normalized === 'failed' || normalized === 'error' ? 'warn' : 'neutral';
  return <Pill tone={tone}>{normalized}</Pill>;
}
