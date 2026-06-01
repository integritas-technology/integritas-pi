import { useEffect, useState } from "react";

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

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimaStatus, setMinimaStatus] = useState<MinimaStatus | null>(null);
  const [minimaError, setMinimaError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: Error) => setHealthError(err.message));
  }, []);

  useEffect(() => {
    fetch("/api/minima/status")
      .then((response) => response.json() as Promise<MinimaStatus>)
      .then(setMinimaStatus)
      .catch((err: Error) => setMinimaError(err.message));
  }, []);

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
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Raspberry Pi prototype</p>
        <h1>Integritas Pi</h1>
        <p className="intro">
          Browserbaserad prototyp som visar hur en Pi-app kan installeras, startas och läsa en begränsad katalog.
        </p>
      </section>

      <section className="panel">
        <div className="status-row">
          <strong>Backend health</strong>
          <span className={health?.status === "ok" ? "status ok" : "status error"}>
            {health ? `${health.status} (${health.service})` : healthError ? `error: ${healthError}` : "checking..."}
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="status-row">
          <strong>Minima status</strong>
          <span className={minimaStatus?.ok ? "status ok" : "status error"}>
            {minimaStatus ? `HTTP ${minimaStatus.status}` : minimaError ? `error: ${minimaError}` : "checking..."}
          </span>
        </div>
        {minimaStatus?.source && <code>{minimaStatus.source}</code>}
        {minimaStatus?.error && <p className="error-text">{minimaStatus.error}</p>}
        {minimaStatus?.body !== undefined && (
          <pre className="json-preview">{JSON.stringify(minimaStatus.body, null, 2)}</pre>
        )}
      </section>

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
    </main>
  );
}
