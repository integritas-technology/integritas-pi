import type { DataSource, DataSourceTemplate } from "./dataSourceTypes";

export function DataSourceForm({ template, name, setName, description, setDescription, type, setType, url, setUrl, healthStatusUrl, setHealthStatusUrl, method, setMethod, onSubmit, busy, submitLabel = "Add source" }: { template: DataSourceTemplate | null; name: string; setName: (value: string) => void; description: string; setDescription: (value: string) => void; type: DataSource["type"]; setType: (value: DataSource["type"]) => void; url: string; setUrl: (value: string) => void; healthStatusUrl: string; setHealthStatusUrl: (value: string) => void; method: "GET" | "POST"; setMethod: (value: "GET" | "POST") => void; onSubmit: () => void; busy: boolean; submitLabel?: string }) {
  return (
    <section className="form-card data-source-form">
      <div className="status-row">
        <div>
          <strong>{submitLabel}</strong>
          <p className="muted">Supported input/output for now: JSON fetched from an API response.</p>
        </div>
        {template && <span className="pill pill-neutral">{template.title}</span>}
      </div>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Source name" /></label>
      <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this source provide?" /></label>
      {type === "webhook" ? (
        <p className="muted">A receive URL will be generated after saving. POST JSON to that URL to update this source.</p>
      ) : (
        <>
          <label>URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/data.json" /></label>
          <label>Health status URL<input value={healthStatusUrl} onChange={(event) => setHealthStatusUrl(event.target.value)} placeholder="https://example.com/health" /></label>
          <label>Method<select value={method} onChange={(event) => setMethod(event.target.value as "GET" | "POST")}><option value="GET">GET</option><option value="POST">POST</option></select></label>
        </>
      )}
      <button type="button" disabled={busy || !name || (type !== "webhook" && !url)} onClick={onSubmit}>{submitLabel}</button>
    </section>
  );
}
