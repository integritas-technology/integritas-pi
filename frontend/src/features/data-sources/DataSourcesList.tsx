import { Pencil, Play, Trash2 } from "lucide-react";
import { JsonPreview } from "../../components/JsonPreview";
import type { DataSource, DataSourceHealthStatus } from "./dataSourceTypes";

export function DataSourcesList({
  items,
  healthStatuses,
  busy,
  onRead,
  onEdit,
  onDelete,
}: {
  items: DataSource[];
  healthStatuses: Record<string, DataSourceHealthStatus>;
  busy: boolean;
  onRead: (source: DataSource) => void;
  onEdit: (source: DataSource) => void;
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
              <th>Endpoint</th>
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
                  <code>{source.type === "webhook" ? webhookUrl(source) : source.type === "mqtt" ? mqttEndpoint(source) : source.config.url}</code>
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
                    <span className="health-cell"><span className="health-status"><span className="health-dot error" />Read failed</span><JsonPreview value={{ error: source.lastError }} label="View error" /></span>
                  ) : (
                    <span className="muted">No preview</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-action-button"
                      type="button"
                      disabled={busy || source.type === "webhook" || source.type === "mqtt"}
                      title="Trigger manually"
                      aria-label={`Trigger ${source.name} manually`}
                      onClick={() => onRead(source)}
                    >
                      <Play size={16} />
                    </button>
                    <button
                      className="icon-action-button"
                      type="button"
                      disabled={busy}
                      title="Edit source"
                      aria-label={`Edit ${source.name}`}
                      onClick={() => onEdit(source)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-action-button danger"
                      type="button"
                      disabled={busy}
                      title="Delete source"
                      aria-label={`Delete ${source.name}`}
                      onClick={() => onDelete(source)}
                    >
                      <Trash2 size={16} />
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

function webhookUrl(source: DataSource) {
  return source.config.webhookToken ? `${window.location.origin}/api/data-source-webhooks/${source.config.webhookToken}` : "Generated after save";
}

function mqttEndpoint(source: DataSource) {
  return `${source.config.brokerUrl ?? "mqtt://"} ${source.config.topic ?? ""}`;
}

function HealthCell({ source, status }: { source: DataSource; status?: DataSourceHealthStatus }) {
  if (source.type === "webhook" || source.type === "mqtt") return <span className="muted">Automation controlled</span>;
  if (!source.config.healthStatusUrl) return <span className="muted">Not configured</span>;
  if (!status) return <span className="health-status"><span className="health-dot pending" />Checking</span>;

  return (
    <div className="health-cell">
      <span className="health-status"><span className={`health-dot ${status.ok ? "ok" : "error"}`} />{status.ok ? "Online" : "Error"}{status.status ? ` HTTP ${status.status}` : ""}</span>
      {status.body !== undefined ? <JsonPreview value={status.body} label="View response" /> : status.error ? <JsonPreview value={{ error: status.error }} label="View error" /> : null}
    </div>
  );
}
