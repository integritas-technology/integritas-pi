import { JsonPreview } from "../../components/JsonPreview";
import type { DataSource, DataSourceHealthStatus } from "./dataSourceTypes";

export function DataSourcesList({
  items,
  healthStatuses,
  busy,
  onRead,
  onDelete,
}: {
  items: DataSource[];
  healthStatuses: Record<string, DataSourceHealthStatus>;
  busy: boolean;
  onRead: (source: DataSource) => void;
  onDelete: (source: DataSource) => void;
}) {
  return (
    <section className="card data-source-list">
      <div>
        <strong>Added data sources</strong>
        <p className="muted">JSON API sources saved in SQLite.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>URL</th>
              <th>Health</th>
              <th>Last hash</th>
              <th>Last preview</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.name}</strong>
                  <p className="muted">{source.description}</p>
                </td>
                <td>{source.type}</td>
                <td>
                  <code>{source.config.url}</code>
                </td>
                <td>
                  <HealthCell source={source} status={healthStatuses[source.id]} />
                </td>
                <td>
                  {source.lastHash ? (
                    <code>{source.lastHash}</code>
                  ) : (
                    <span className="muted">Not read yet</span>
                  )}
                </td>
                <td>
                  {source.lastPreview ? (
                    <JsonPreview value={source.lastPreview} />
                  ) : source.lastError ? (
                    <p className="error-text">{source.lastError}</p>
                  ) : (
                    <span className="muted">No preview</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRead(source)}
                    >
                      Trigger manually
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(source)}
                    >
                      Delete Data Source
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <p className="muted">No data sources added yet.</p>
      )}
    </section>
  );
}

function HealthCell({ source, status }: { source: DataSource; status?: DataSourceHealthStatus }) {
  if (!source.config.healthStatusUrl) return <span className="muted">Not configured</span>;
  if (!status) return <span className="health-status"><span className="health-dot pending" />Checking</span>;

  return (
    <div className="health-cell">
      <span className="health-status"><span className={`health-dot ${status.ok ? "ok" : "error"}`} />{status.ok ? "Online" : "Error"}{status.status ? ` HTTP ${status.status}` : ""}</span>
      {status.body !== undefined ? <JsonPreview value={status.body} label="View response" /> : status.error ? <p className="error-text">{status.error}</p> : null}
    </div>
  );
}
