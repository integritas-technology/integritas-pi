import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { FileItem, FilesResponse } from "../../app/types";
import { Card } from "../../components/Card";
import { formatSize } from "../../lib/format";
import { joinPath, parentPath } from "../../lib/paths";

export function FilesPanel() {
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
    <Card>
      <div className="status-row">
        <div><strong>File explorer</strong><code>{currentPath}</code></div>
        <button type="button" onClick={() => setCurrentPath(parentPath(currentPath))} disabled={currentPath === "/"}>Back</button>
      </div>
      {loading && <p className="muted">Loading files...</p>}
      {error && <p className="error-text">{error}</p>}
      <ul className="file-list">
        {items.map((item) => (
          <li key={`${item.type}-${item.name}`}>
            {item.type === "directory" ? <button type="button" className="file-button" onClick={() => setCurrentPath(joinPath(currentPath, item.name))}><span>Directory</span><strong>{item.name}</strong><ChevronRight size={17} /></button> : <div className="file-row"><span>{item.type}</span><strong>{item.name}</strong><small>{formatSize(item.size)}</small></div>}
          </li>
        ))}
      </ul>
      {!loading && items.length === 0 && !error && <p className="muted">No files found in this directory.</p>}
    </Card>
  );
}
