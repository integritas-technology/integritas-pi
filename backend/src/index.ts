import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const hostFilesRoot = path.resolve(process.env.HOST_FILES_ROOT ?? "/host-files");
const minimaStatusUrl = process.env.MINIMA_STATUS_URL ?? "http://minima:9005/status";

type FileItem = {
  name: string;
  type: "file" | "directory" | "other";
  size?: number;
};

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/api/health", (_req, res) => {
  // TODO: Add authentication before exposing this beyond a trusted local network.
  res.json({ status: "ok", service: "integritas-pi-backend" });
});

app.get("/api/minima/status", async (_req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(minimaStatusUrl, { signal: controller.signal });
    const text = await response.text();
    let body: unknown = text;

    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // Minima RPC should return JSON, but keep the raw body visible during prototyping.
    }

    res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      status: response.status,
      source: minimaStatusUrl,
      body
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ ok: false, source: minimaStatusUrl, error: message });
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/files", async (req, res) => {
  const requestedPath = typeof req.query.path === "string" ? req.query.path : "/";
  const safePath = requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`;
  const relativePath = safePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(hostFilesRoot, relativePath);

  if (absolutePath !== hostFilesRoot && !absolutePath.startsWith(`${hostFilesRoot}${path.sep}`)) {
    res.status(403).json({ error: "Path is outside the allowed directory" });
    return;
  }

  try {
    const rootRealPath = await fs.realpath(hostFilesRoot);
    const targetRealPath = await fs.realpath(absolutePath);

    if (targetRealPath !== rootRealPath && !targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
      res.status(403).json({ error: "Path is outside the allowed directory" });
      return;
    }

    const stat = await fs.stat(targetRealPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: "Path must be a directory" });
      return;
    }

    const entries = await fs.readdir(targetRealPath, { withFileTypes: true });
    const items: FileItem[] = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(targetRealPath, entry.name);
        const item: FileItem = {
          name: entry.name,
          type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
        };

        if (entry.isFile()) {
          const entryStat = await fs.lstat(entryPath);
          item.size = entryStat.size;
        }

        return item;
      })
    );

    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      if (a.type === "directory") return -1;
      if (b.type === "directory") return 1;
      return a.type.localeCompare(b.type);
    });

    res.json({ path: safePath === "/" ? "/" : `/${relativePath}`, items });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      res.status(404).json({ error: "Path not found" });
      return;
    }

    if (code === "EACCES" || code === "EPERM") {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    console.error(error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`integritas-pi backend listening on port ${port}`);
  console.log(`File access root: ${hostFilesRoot}`);
  console.log(`Minima status URL: ${minimaStatusUrl}`);
});
