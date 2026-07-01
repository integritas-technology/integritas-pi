import { JsonPreview } from "../../components/JsonPreview";
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
    <section className="card data-read-list">
      <div><strong>Read history</strong></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Read time</th><th>Source</th><th>Trigger</th><th>Status</th><th>Hash</th><th>Integritas proof</th><th>Preview / error</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><TimeStack value={item.createdAt} /></td>
                <td><strong>{item.sourceName}</strong><p className="muted"><code>{item.sourceUrl}</code></p></td>
                <td><span className="pill pill-neutral">{item.triggerType}</span></td>
                <td>{item.status === "success" ? <span className="pill pill-good">Success</span> : <span className="pill pill-warn">Failed</span>}</td>
                <td>{item.hash ? <code>{item.hash}</code> : <span className="muted">No hash</span>}</td>
                <td>{item.integritasProofId ? <code>{item.integritasProofId}</code> : <span className="muted">No proof</span>}</td>
                <td>{item.preview ? <JsonPreview value={item.preview} /> : item.error ? <p className="error-text">{item.error}</p> : <span className="muted">No data</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <p className="muted">{filtered ? 'No matching read history.' : 'No reads recorded yet.'}</p>
      )}
    </section>
  );
}

function TimeStack({ value }: { value: string }) {
  return (
    <div className="time-stack">
      <strong>{formatLocalTime(value)} local</strong>
      <span>UTC: {formatUtcTime(value)}</span>
    </div>
  );
}
