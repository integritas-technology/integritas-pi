import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { Page } from "../components/Page";
import { useToast } from "../components/ToastProvider";
import { checkDataSourceHealth, createDataSource, deleteDataSource, getDataSourceCapabilities, listDataSources, readDataSource, updateDataSource } from "../features/data-sources/dataSourcesApi";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import { DataSourceTemplates } from "../features/data-sources/DataSourceTemplates";
import type { DataSource, DataSourceCapabilities, DataSourceHealthStatus, DataSourceTemplate } from "../features/data-sources/dataSourceTypes";

export function DataSourcesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<DataSource[]>([]);
  const [capabilities, setCapabilities] = useState<DataSourceCapabilities | null>(null);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DataSource["type"]>("json-api");
  const [url, setUrl] = useState("");
  const [healthStatusUrl, setHealthStatusUrl] = useState("");
  const [brokerUrl, setBrokerUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [gpioChip, setGpioChip] = useState("gpiochip0");
  const [gpioPin, setGpioPin] = useState("17");
  const [gpioPull, setGpioPull] = useState<"off" | "up" | "down">("off");
  const [gpioEdge, setGpioEdge] = useState<"rising" | "falling" | "both">("both");
  const [gpioDebounceMs, setGpioDebounceMs] = useState("100");
  const [gpioActiveState, setGpioActiveState] = useState<"high" | "low">("high");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [healthStatuses, setHealthStatuses] = useState<Record<string, DataSourceHealthStatus>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refresh().catch((err: Error) => showToast({ tone: "error", title: "Could not load devices", message: err.message }));
  }, []);

  useEffect(() => {
    refreshHealthStatuses();
    const interval = window.setInterval(refreshHealthStatuses, 60000);
    return () => window.clearInterval(interval);
  }, [items]);

  async function refresh() {
    const [response, capabilityResponse] = await Promise.all([listDataSources(), getDataSourceCapabilities()]);
    setItems(response.items);
    setCapabilities(capabilityResponse);
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
    setBrokerUrl(nextTemplate.config.brokerUrl ?? "");
    setTopic(nextTemplate.config.topic ?? "");
    setGpioChip(nextTemplate.config.chip ?? "gpiochip0");
    setGpioPin(String(nextTemplate.config.pin ?? 17));
    setGpioPull(nextTemplate.config.pull ?? "off");
    setGpioEdge(nextTemplate.config.edge ?? "both");
    setGpioDebounceMs(String(nextTemplate.config.debounceMs ?? 100));
    setGpioActiveState(nextTemplate.config.activeState ?? "high");
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
    setBrokerUrl(source.config.brokerUrl ?? "");
    setTopic(source.config.topic ?? "");
    setGpioChip(source.config.chip ?? "gpiochip0");
    setGpioPin(String(source.config.pin ?? 17));
    setGpioPull(source.config.pull ?? "off");
    setGpioEdge(source.config.edge ?? "both");
    setGpioDebounceMs(String(source.config.debounceMs ?? 100));
    setGpioActiveState(source.config.activeState ?? "high");
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
    setBrokerUrl("");
    setTopic("");
    setGpioChip("gpiochip0");
    setGpioPin("17");
    setGpioPull("off");
    setGpioEdge("both");
    setGpioDebounceMs("100");
    setGpioActiveState("high");
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
      showToast({ tone: "error", title: "Device action failed", message: err instanceof Error ? err.message : "Unknown error" });
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Devices" title="Connect inputs and outputs" desc="Add input sources for data and events, then prepare output targets for automation workflows.">
      <DataSourceTemplates capabilities={capabilities} onSelect={applyTemplate} />

      {formOpen && (
        <Modal title={editingSource ? "Edit device" : "Add device"} onClose={closeForm}>
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
            brokerUrl={brokerUrl}
            setBrokerUrl={setBrokerUrl}
            topic={topic}
            setTopic={setTopic}
            gpioChip={gpioChip}
            setGpioChip={setGpioChip}
            gpioPin={gpioPin}
            setGpioPin={setGpioPin}
            gpioPull={gpioPull}
            setGpioPull={setGpioPull}
            gpioEdge={gpioEdge}
            setGpioEdge={setGpioEdge}
            gpioDebounceMs={gpioDebounceMs}
            setGpioDebounceMs={setGpioDebounceMs}
            gpioActiveState={gpioActiveState}
            setGpioActiveState={setGpioActiveState}
            method={method}
            setMethod={setMethod}
            busy={busy}
            submitLabel={editingSource ? "Save device" : "Add device"}
            onSubmit={() => run(async () => {
              const input = { name, description, type, config: type === "webhook" ? { webhookToken: editingSource?.config.webhookToken } : type === "mqtt" ? { brokerUrl, topic } : type === "gpio-input" ? { chip: gpioChip, pin: Number(gpioPin), pull: gpioPull, edge: gpioEdge, debounceMs: Number(gpioDebounceMs), activeState: gpioActiveState } : type === "gpio-output" ? { chip: gpioChip, pin: Number(gpioPin), profile: "led" as const, activeState: gpioActiveState, initialState: "inactive" as const } : { url, method, healthStatusUrl: healthStatusUrl.trim() || undefined, headers: {} } };
              if (editingSource) await updateDataSource(editingSource.id, input);
              else await createDataSource(input);
              setFormOpen(false);
              resetForm();
            }, editingSource ? "Device updated" : "Device added")}
          />
        </Modal>
      )}

      <DataSourcesList
        items={items}
        healthStatuses={healthStatuses}
        busy={busy}
        onRead={(source) => run(() => readDataSource(source.id), "Manual read completed")}
        onEdit={editSource}
        onDelete={(source) => run(() => deleteDataSource(source.id), "Device deleted")}
      />
    </Page>
  );
}
