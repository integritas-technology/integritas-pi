import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { checkDataSourceHealth, createDataSource, deleteDataSource, listDataSources, readDataSource, updateDataSource } from "../features/data-sources/dataSourcesApi";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import { DataSourceTemplates } from "../features/data-sources/DataSourceTemplates";
import type { DataSource, DataSourceHealthStatus, DataSourceTemplate } from "../features/data-sources/dataSourceTypes";

export function DataSourcesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<DataSource[]>([]);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DataSource["type"]>("json-api");
  const [url, setUrl] = useState("");
  const [healthStatusUrl, setHealthStatusUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [healthStatuses, setHealthStatuses] = useState<Record<string, DataSourceHealthStatus>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refresh().catch((err: Error) => showToast({ tone: "error", title: "Could not load data sources", message: err.message }));
  }, []);

  useEffect(() => {
    refreshHealthStatuses();
    const interval = window.setInterval(refreshHealthStatuses, 60000);
    return () => window.clearInterval(interval);
  }, [items]);

  async function refresh() {
    const response = await listDataSources();
    setItems(response.items);
  }

  function refreshHealthStatuses() {
    const sourcesWithHealth = items.filter((source) => source.config.healthStatusUrl);
    if (sourcesWithHealth.length === 0) return;

    sourcesWithHealth.forEach((source) => {
      checkDataSourceHealth(source.id)
        .then((status) => setHealthStatuses((current) => ({ ...current, [source.id]: status })))
        .catch((err: Error) => setHealthStatuses((current) => ({ ...current, [source.id]: { ok: false, error: err.message } })));
    });
  }

  function applyTemplate(nextTemplate: DataSourceTemplate) {
    setEditingSource(null);
    setTemplate(nextTemplate);
    setName(nextTemplate.title);
    setDescription(nextTemplate.description);
    setType(nextTemplate.type);
    setUrl(nextTemplate.config.url ?? "");
    setHealthStatusUrl(nextTemplate.config.healthStatusUrl ?? "");
    setMethod(nextTemplate.config.method ?? "GET");
    setFormOpen(true);
  }

  function editSource(source: DataSource) {
    setEditingSource(source);
    setTemplate(null);
    setName(source.name);
    setDescription(source.description ?? "");
    setType(source.type);
    setUrl(source.config.url ?? "");
    setHealthStatusUrl(source.config.healthStatusUrl ?? "");
    setMethod(source.config.method ?? "GET");
    setFormOpen(true);
  }

  function resetForm() {
    setTemplate(null);
    setEditingSource(null);
    setName("");
    setDescription("");
    setType("json-api");
    setUrl("");
    setHealthStatusUrl("");
    setMethod("GET");
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
    resetForm();
  }

  async function run(action: () => Promise<unknown>, successTitle?: string) {
    setBusy(true);
    try {
      await action();
      await refresh();
      if (successTitle) showToast({ tone: "success", title: successTitle });
    } catch (err) {
      showToast({ tone: "error", title: "Data source action failed", message: err instanceof Error ? err.message : "Unknown error" });
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Data Sources" title="Bring JSON data into the system" desc="Add sources by protocol. Fetch JSON from HTTP APIs, or receive pushed JSON through webhooks.">
      <DataSourceTemplates onSelect={applyTemplate} />

      {formOpen && (
        <Modal title={editingSource ? "Edit source" : "Add source"} onClose={closeForm}>
          <DataSourceForm
            template={template}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            type={type}
            setType={setType}
            url={url}
            setUrl={setUrl}
            healthStatusUrl={healthStatusUrl}
            setHealthStatusUrl={setHealthStatusUrl}
            method={method}
            setMethod={setMethod}
            busy={busy}
            submitLabel={editingSource ? "Save source" : "Add source"}
            onSubmit={() => run(async () => {
              const input = { name, description, type, config: type === "webhook" ? { webhookToken: editingSource?.config.webhookToken } : { url, method, healthStatusUrl: healthStatusUrl.trim() || undefined, headers: {} } };
              if (editingSource) await updateDataSource(editingSource.id, input);
              else await createDataSource(input);
              setFormOpen(false);
              resetForm();
            }, editingSource ? "Source updated" : "Source added")}
          />
        </Modal>
      )}

      <DataSourcesList
        items={items}
        healthStatuses={healthStatuses}
        busy={busy}
        onRead={(source) => run(() => readDataSource(source.id), "Manual read completed")}
        onEdit={editSource}
        onDelete={(source) => run(() => deleteDataSource(source.id), "Source deleted")}
      />
    </Page>
  );
}
