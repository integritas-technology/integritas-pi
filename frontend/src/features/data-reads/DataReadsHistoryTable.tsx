import { DataTable, EmptyTableState, TableCard, TableWrap, tableCellClass, tableHeaderCellClass, tableHeadRowClass, tableRowClass } from "../../components/DataTable";
import { JsonPreview } from "../../components/JsonPreview";
import { Pill } from "../../components/Pill";
import { ErrorText, MutedText } from "../../components/Text";
import { formatLocalTime, formatUtcTime } from "../../lib/time";
import type { DataSourceRead } from "./dataReadTypes";

export function DataReadsHistoryTable({
  items,
  filtered,
}: {
  items: DataSourceRead[];
  filtered?: boolean;
}) {
  return (
    <TableCard title="Read history">
      <TableWrap>
        <DataTable>
          <thead><tr className={tableHeadRowClass}><th className={tableHeaderCellClass}>Read time</th><th className={tableHeaderCellClass}>Source</th><th className={tableHeaderCellClass}>Trigger</th><th className={tableHeaderCellClass}>Status</th><th className={tableHeaderCellClass}>Hash</th><th className={tableHeaderCellClass}>Integritas proof</th><th className={tableHeaderCellClass}>Preview / error</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={tableRowClass}>
                <td className={tableCellClass}><TimeStack value={item.createdAt} /></td>
                <td className={tableCellClass}><strong>{item.sourceName}</strong><MutedText className="m-0"><code>{item.sourceUrl}</code></MutedText></td>
                <td className={tableCellClass}><Pill>{item.triggerType}</Pill></td>
                <td className={tableCellClass}>{item.status === "success" ? <Pill tone="good">Success</Pill> : <Pill tone="warn">Failed</Pill>}</td>
                <td className={tableCellClass}>{item.hash ? <code>{item.hash}</code> : <span className="text-slate-500">No hash</span>}</td>
                <td className={tableCellClass}>{item.integritasProofId ? <code>{item.integritasProofId}</code> : <span className="text-slate-500">No proof</span>}</td>
                <td className={tableCellClass}>{item.preview ? <JsonPreview value={item.preview} /> : item.error ? <ErrorText className="m-0">{item.error}</ErrorText> : <span className="text-slate-500">No data</span>}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrap>
      {items.length === 0 && (
        <EmptyTableState>{filtered ? 'No matching read history.' : 'No reads recorded yet.'}</EmptyTableState>
      )}
    </TableCard>
  );
}

function TimeStack({ value }: { value: string }) {
  return (
    <div className="grid gap-0.5">
      <strong className="font-mono text-sm text-slate-950">{formatLocalTime(value)} local</strong>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">UTC: {formatUtcTime(value)}</span>
    </div>
  );
}
