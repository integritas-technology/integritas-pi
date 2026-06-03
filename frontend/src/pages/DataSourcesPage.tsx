import { useEffect, useState } from "react";
import { Page } from "../components/Page";
import { createDataSource, deleteDataSource, listDataSources, readDataSource } from "../features/data-sources/dataSourcesApi";
import { DataSourceForm } from "../features/data-sources/DataSourceForm";
import { DataSourcesList } from "../features/data-sources/DataSourcesList";
import { DataSourceTemplates } from "../features/data-sources/DataSourceTemplates";
import type { DataSource, DataSourceTemplate } from "../features/data-sources/dataSourceTypes";

export function DataSourcesPage() {
  const [items, setItems] = useState<DataSource[]>([]);
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<DataSource["type"]>("json-api");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function refresh() {
    const response = await listDataSources();
    setItems(response.items);
  }

  function applyTemplate(nextTemplate: DataSourceTemplate) {
    setTemplate(nextTemplate);
    setName(nextTemplate.title);
    setDescription(nextTemplate.description);
    setType(nextTemplate.type);
    setUrl(nextTemplate.config.url);
    setMethod(nextTemplate.config.method);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page eyebrow="Data Sources" title="Bring JSON API data into the system" desc="Start with API responses that return JSON. Templates prefill common source shapes, while Add source remains generic for any JSON API endpoint.">
      <DataSourceTemplates onSelect={applyTemplate} />

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
        method={method}
        setMethod={setMethod}
        busy={busy}
        onSubmit={() => run(async () => {
          await createDataSource({ name, description, type, config: { url, method, headers: {} } });
          setTemplate(null);
          setName("");
          setDescription("");
          setType("json-api");
          setUrl("");
          setMethod("GET");
        })}
      />

      {error && <p className="error-text">{error}</p>}

      <DataSourcesList
        items={items}
        busy={busy}
        onRead={(source) => run(() => readDataSource(source.id))}
        onDelete={(source) => run(() => deleteDataSource(source.id))}
      />
    </Page>
  );
}
