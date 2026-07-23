import { Pencil, Play, Trash2, Zap } from "lucide-react";
import {
  DataTable,
  EmptyTableState,
  RowActions,
  TableCard,
  TableIconButton,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from "../../components/DataTable";
import { JsonPreview } from "../../components/JsonPreview";
import { ErrorDetails } from "../../components/ErrorDetails";
import { MutedText } from "../../components/Text";
import type { DataSource, DataSourceHealthStatus } from "./dataSourceTypes";

export function DataSourcesList({
  items,
  healthStatuses,
  busy,
  onRead,
  onTestOutput,
  onEdit,
  onDelete,
}: {
  items: DataSource[];
  healthStatuses: Record<string, DataSourceHealthStatus>;
  busy: boolean;
  onRead: (source: DataSource) => void;
  onTestOutput: (source: DataSource) => void;
  onEdit: (source: DataSource) => void;
  onDelete: (source: DataSource) => void;
}) {
  return (
    <TableCard title="Configured devices" description="Input sources, capture devices, and output targets saved in SQLite.">
      <TableWrap>
        <DataTable className="min-w-[980px]">
          <thead>
            <tr className={tableHeadRowClass}>
              <th className={tableHeaderCellClass}>Name</th>
              <th className={tableHeaderCellClass}>Direction</th>
              <th className={tableHeaderCellClass}>Type</th>
              <th className={tableHeaderCellClass}>Endpoint</th>
              <th className={tableHeaderCellClass}>Health</th>
              <th className={tableHeaderCellClass}>Last hash</th>
              <th className={tableHeaderCellClass}>Last preview</th>
              <th className={tableHeaderCellClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((source) => (
              <tr key={source.id} className={tableRowClass}>
                <td className={tableCellClass}>
                  <strong>{source.name}</strong>
                  <MutedText className="m-0 mt-1">{source.description}</MutedText>
                </td>
                <td className={tableCellClass}>{source.type === "pi-camera" ? "Capture" : isInputSource(source) ? "Input" : "Output"}</td>
                <td className={tableCellClass}>{sourceTypeLabel(source)}</td>
                <td className={tableCellClass}>
                  <code>{source.type === "webhook" ? webhookUrl(source) : source.type === "mqtt" || source.type === "mqtt-output" ? mqttEndpoint(source) : source.type === "gpio-input" ? gpioEndpoint(source) : source.type === "gpio-output" ? gpioOutputEndpoint(source) : source.type === "pi-camera" ? cameraEndpoint(source) : source.config.url}</code>
                </td>
                <td className={tableCellClass}>
                  <HealthCell source={source} status={healthStatuses[source.id]} />
                </td>
                <td className={tableCellClass}>
                  {source.lastHash ? (
                    <code>{source.lastHash}</code>
                  ) : (
                    <span className="text-slate-500">Not read yet</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  {source.lastPreview ? (
                    <JsonPreview value={source.lastPreview} />
                  ) : source.lastError ? (
                    <span className="grid gap-2"><HealthStatus ok={false}>Device error</HealthStatus><ErrorDetails error={source.lastErrorDetails ?? source.lastError} label="View error" /></span>
                  ) : (
                    <span className="text-slate-500">No preview</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <RowActions>
                    <TableIconButton
                      type="button"
                       disabled={busy || source.type === "webhook" || source.type === "mqtt" || source.type === "gpio-input" || source.type === "gpio-output" || source.type === "pi-camera" || source.type === "http-output" || source.type === "mqtt-output"}
                      title="Trigger manually"
                      aria-label={`Trigger ${source.name} manually`}
                      onClick={() => onRead(source)}
                    >
                      <Play size={16} />
                    </TableIconButton>
                    {(source.type === "gpio-output" || source.type === "http-output" || source.type === "mqtt-output") && (
                      <TableIconButton
                        type="button"
                        disabled={busy}
                        title={source.type === "gpio-output" ? "Test pulse" : "Test output"}
                        aria-label={`Test output ${source.name}`}
                        onClick={() => onTestOutput(source)}
                      >
                        <Zap size={16} />
                      </TableIconButton>
                    )}
                    <TableIconButton
                      type="button"
                      disabled={busy}
                      title="Edit device"
                      aria-label={`Edit ${source.name}`}
                      onClick={() => onEdit(source)}
                    >
                      <Pencil size={16} />
                    </TableIconButton>
                    <TableIconButton
                      danger
                      type="button"
                      disabled={busy}
                      title="Delete source"
                      aria-label={`Delete ${source.name}`}
                      onClick={() => onDelete(source)}
                    >
                      <Trash2 size={16} />
                    </TableIconButton>
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrap>
      {items.length === 0 && (
        <EmptyTableState>No devices added yet.</EmptyTableState>
      )}
    </TableCard>
  );
}

function webhookUrl(source: DataSource) {
  return source.config.webhookToken ? `${window.location.origin}/api/data-source-webhooks/${source.config.webhookToken}` : "Generated after save";
}

function mqttEndpoint(source: DataSource) {
  return `${source.config.brokerUrl ?? "mqtt://"} ${source.config.topic ?? ""}`;
}

function gpioEndpoint(source: DataSource) {
  return `${source.config.profile === "pir-motion" ? "PIR motion " : ""}${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"} ${source.config.edge ?? "both"}`;
}

function sourceTypeLabel(source: DataSource) {
  if (source.type === "gpio-input" && source.config.profile === "pir-motion") return "PIR Motion Sensor";
  return source.type;
}

function gpioOutputEndpoint(source: DataSource) {
  return `${source.config.profile ?? "led"} ${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? "?"} active:${source.config.activeState ?? "high"}`;
}

function cameraEndpoint(source: DataSource) {
  return `${source.config.mode ?? "photo"} ${source.config.width ?? 1280}x${source.config.height ?? 720}${source.config.mode === "video" ? ` ${source.config.durationMs ?? 5000}ms @ ${source.config.fps ?? 30}fps` : ""}`;
}

function isInputSource(source: DataSource) {
  return source.type === "json-api" || source.type === "internal-json-api" || source.type === "webhook" || source.type === "mqtt" || source.type === "gpio-input";
}

function HealthCell({ source, status }: { source: DataSource; status?: DataSourceHealthStatus }) {
  if (source.type === "webhook" || source.type === "mqtt" || source.type === "gpio-input" || source.type === "gpio-output" || source.type === "pi-camera" || source.type === "http-output" || source.type === "mqtt-output") return <span className="text-slate-500">Automation controlled</span>;
  if (!source.config.healthStatusUrl) return <span className="text-slate-500">Not configured</span>;
  if (!status) return <HealthStatus pending>Checking</HealthStatus>;

  return (
    <div className="grid gap-2">
      <HealthStatus ok={status.ok}>{status.ok ? "Online" : "Error"}{status.status ? ` HTTP ${status.status}` : ""}</HealthStatus>
      {status.body !== undefined ? <JsonPreview value={status.body} label="View response" /> : status.error ? <JsonPreview value={{ error: status.error }} label="View error" /> : null}
    </div>
  );
}

function HealthStatus({ children, ok, pending }: { children: React.ReactNode; ok?: boolean; pending?: boolean }) {
  const dotClass = pending ? "bg-amber-500" : ok ? "bg-emerald-600" : "bg-red-600";
  return <span className="inline-flex items-center gap-2 text-[0.86rem] font-extrabold text-slate-600"><span className={`inline-block size-2.5 rounded-full ${dotClass}`} />{children}</span>;
}
