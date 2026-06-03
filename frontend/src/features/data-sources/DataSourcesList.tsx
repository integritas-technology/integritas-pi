import { JsonPreview } from "../../components/JsonPreview";
import type { DataSource } from "./dataSourceTypes";

export function DataSourcesList({ items, busy, onRead, onDelete }: { items: DataSource[]; busy: boolean; onRead: (source: DataSource) => void; onDelete: (source: DataSource) => void }) {
  return (
    <section className="card data-source-list">
      <div><strong>Added data sources</strong><p className="muted">JSON API sources saved in SQLite.</p></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>URL</th><th>Last hash</th><th>Last preview</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((source) => (
              <tr key={source.id}>
                <td><strong>{source.name}</strong><p className="muted">{source.description}</p></td>
                <td>{source.type}</td>
                <td><code>{source.config.url}</code></td>
                <td>{source.lastHash ? <code>{source.lastHash}</code> : <span className="muted">Not read yet</span>}</td>
                <td>{source.lastPreview ? <JsonPreview value={source.lastPreview} /> : source.lastError ? <p className="error-text">{source.lastError}</p> : <span className="muted">No preview</span>}</td>
                <td><div className="row-actions"><button type="button" disabled={busy} onClick={() => onRead(source)}>Read JSON</button><button type="button" disabled={busy} onClick={() => onDelete(source)}>Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <p className="muted">No data sources added yet.</p>}
    </section>
  );
}
