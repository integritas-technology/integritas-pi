import { useEffect, useState } from "react";

type Page = "status" | "minima" | "integritas" | "files";

type Health = {
  status: string;
  service: string;
};

type FileItem = {
  name: string;
  type: "file" | "directory" | "other";
  size?: number;
};

type FilesResponse = {
  path: string;
  items: FileItem[];
};

type MinimaStatus = {
  ok: boolean;
  status?: number;
  source: string;
  body?: unknown;
  error?: string;
};

type IntegritasConfig = {
  baseUrl: string;
  requestId: string;
  hasApiKey: boolean;
  apiKeySource: "database" | "environment" | "none";
};

const navItems: Array<{ page: Page; label: string }> = [
  { page: "status", label: "App status" },
  { page: "minima", label: "Minima" },
  { page: "integritas", label: "Integritas" },
  { page: "files", label: "File explorer" }
];

function joinPath(currentPath: string, child: string) {
  return currentPath === "/" ? `/${child}` : `${currentPath}/${child}`;
}

function parentPath(currentPath: string) {
  if (currentPath === "/") return "/";
  const parts = currentPath.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

function formatSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const parsed = await response.json();
  if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
  return parsed as T;
}

function JsonPreview({ value }: { value: unknown }) {
  return <pre className="json-preview">{JSON.stringify(value, null, 2)}</pre>;
}

export default function App() {
  const [page, setPage] = useState<Page>("status");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span>Raspberry Pi prototype</span>
          <strong>Integritas Pi</strong>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => setPage(item.page)} type="button">
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {page === "status" && <StatusPage />}
        {page === "minima" && <MinimaPage />}
        {page === "integritas" && <IntegritasPage />}
        {page === "files" && <FilesPage />}
      </main>
    </div>
  );
}

function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: Error) => setHealthError(err.message));
  }, []);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">System overview</p>
        <h1>App status</h1>
        <p>Kontrollera att backend och appens grundläggande tjänster svarar.</p>
      </header>
      <section className="panel">
        <div className="status-row">
          <strong>Backend health</strong>
          <span className={health?.status === "ok" ? "status ok" : "status error"}>
            {health ? `${health.status} (${health.service})` : healthError ? `error: ${healthError}` : "checking..."}
          </span>
        </div>
      </section>
    </>
  );
}

function MinimaPage() {
  const [minimaStatus, setMinimaStatus] = useState<MinimaStatus | null>(null);
  const [minimaError, setMinimaError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/minima/status")
      .then((response) => response.json() as Promise<MinimaStatus>)
      .then(setMinimaStatus)
      .catch((err: Error) => setMinimaError(err.message));
  }, []);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Node runtime</p>
        <h1>Minima</h1>
        <p>Visar svaret från Minima RPC via backendens interna Docker-nätverksanrop.</p>
      </header>
      <section className="panel">
        <div className="status-row">
          <strong>Minima status</strong>
          <span className={minimaStatus?.ok ? "status ok" : "status error"}>
            {minimaStatus ? `HTTP ${minimaStatus.status}` : minimaError ? `error: ${minimaError}` : "checking..."}
          </span>
        </div>
        {minimaStatus?.source && <code>{minimaStatus.source}</code>}
        {minimaStatus?.error && <p className="error-text">{minimaStatus.error}</p>}
        {minimaStatus?.body !== undefined && <JsonPreview value={minimaStatus.body} />}
      </section>
    </>
  );
}

function IntegritasPage() {
  const [config, setConfig] = useState<IntegritasConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [canonicalBytes, setCanonicalBytes] = useState("{\n  \"message\": \"Hello Integritas\"\n}\n");
  const [hash, setHash] = useState("");
  const [proofUid, setProofUid] = useState("");
  const [proofPayload, setProofPayload] = useState("[]");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setError(err.message));
  }, []);

  async function refreshConfig() {
    const response = await fetch("/api/integritas/config");
    setConfig(await response.json() as IntegritasConfig);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await action();
      setResult(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Stamping and verification</p>
        <h1>Integritas</h1>
        <p>Hasha deterministiska bytes, begär timestamp UID, hämta proof och verifiera via backend.</p>
      </header>

      <section className="panel grid-panel">
        <div>
          <strong>Runtime configuration</strong>
          <code>baseUrl: {config?.baseUrl ?? "loading..."}</code>
          <code>requestId: {config?.requestId ?? "loading..."}</code>
          <code>apiKeySource: {config?.apiKeySource ?? "loading..."}</code>
        </div>
        <span className={config?.hasApiKey ? "status ok" : "status error"}>
          {config?.hasApiKey ? "API key configured" : "API key missing"}
        </span>
      </section>

      <section className="panel form-panel">
        <label>
          Integritas API key
          <input
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="Paste API key to store encrypted in SQLite"
            type="password"
          />
        </label>

        <div className="button-row">
          <button type="button" disabled={busy || !apiKeyInput} onClick={() => run(async () => {
            const response = await postJson("/api/integritas/api-key", { apiKey: apiKeyInput });
            setApiKeyInput("");
            await refreshConfig();
            return response;
          })}>
            Save API key
          </button>
          <button type="button" disabled={busy || !config?.hasApiKey} onClick={() => run(async () => {
            const response = await fetch("/api/integritas/api-key", { method: "DELETE" });
            const parsed = await response.json();
            if (!response.ok) throw new Error(parsed?.error || `HTTP ${response.status}`);
            await refreshConfig();
            return parsed;
          })}>
            Clear stored key
          </button>
        </div>

        <label>
          Canonical bytes
          <textarea value={canonicalBytes} onChange={(event) => setCanonicalBytes(event.target.value)} rows={8} />
        </label>

        <div className="button-row">
          <button type="button" disabled={busy} onClick={() => run(async () => {
            const response = await postJson<{ hash: string }>("/api/integritas/hash", { canonicalBytes });
            setHash(response.hash);
            return response;
          })}>
            Hash bytes
          </button>
          <button type="button" disabled={busy} onClick={() => run(async () => {
            const response = await postJson<{ hash: string; proofUid: string }>("/api/integritas/stamp", { canonicalBytes });
            setHash(response.hash);
            setProofUid(response.proofUid);
            return response;
          })}>
            Stamp hash
          </button>
        </div>

        <label>
          SHA3-256 hash
          <input value={hash} onChange={(event) => setHash(event.target.value)} placeholder="Generated hash" />
        </label>

        <label>
          Proof UID
          <input value={proofUid} onChange={(event) => setProofUid(event.target.value)} placeholder="UID from stamp request" />
        </label>

        <button type="button" disabled={busy || !proofUid} onClick={() => run(async () => {
          const response = await postJson<{ proofPayloads: Array<{ uid?: string; proofPayload: unknown }> }>("/api/integritas/status", {
            uids: [proofUid]
          });
          const readyPayload = response.proofPayloads.find((item) => item.proofPayload)?.proofPayload;
          if (readyPayload) setProofPayload(JSON.stringify(readyPayload, null, 2));
          return response;
        })}>
          Poll proof status
        </button>

        <label>
          Proof payload JSON
          <textarea value={proofPayload} onChange={(event) => setProofPayload(event.target.value)} rows={8} />
        </label>

        <button type="button" disabled={busy} onClick={() => run(async () => {
          return postJson("/api/integritas/verify", {
            canonicalBytes,
            storedHash: hash,
            proofPayload: JSON.parse(proofPayload)
          });
        })}>
          Verify proof
        </button>

        {error && <p className="error-text">{error}</p>}
        {result !== null && <JsonPreview value={result} />}
      </section>
    </>
  );
}

function FilesPage() {
  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/files?path=${encodeURIComponent(currentPath)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load files: HTTP ${response.status}`);
        return response.json() as Promise<FilesResponse>;
      })
      .then((data) => {
        setCurrentPath(data.path);
        setItems(data.items);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [currentPath]);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Read-only host files</p>
        <h1>File explorer</h1>
        <p>Bläddra i den katalog som backend får läsa från Pi:n.</p>
      </header>
      <section className="panel">
        <div className="browser-header">
          <div>
            <strong>Current path</strong>
            <code>{currentPath}</code>
          </div>
          <button type="button" onClick={() => setCurrentPath(parentPath(currentPath))} disabled={currentPath === "/"}>
            Back
          </button>
        </div>

        {loading && <p className="muted">Loading files...</p>}
        {error && <p className="error-text">{error}</p>}

        <ul className="file-list">
          {items.map((item) => (
            <li key={`${item.type}-${item.name}`}>
              {item.type === "directory" ? (
                <button type="button" className="file-button" onClick={() => setCurrentPath(joinPath(currentPath, item.name))}>
                  <span>Directory</span>
                  <strong>{item.name}</strong>
                </button>
              ) : (
                <div className="file-row">
                  <span>{item.type}</span>
                  <strong>{item.name}</strong>
                  <small>{formatSize(item.size)}</small>
                </div>
              )}
            </li>
          ))}
        </ul>

        {!loading && items.length === 0 && !error && <p className="muted">No files found in this directory.</p>}
      </section>
    </>
  );
}
