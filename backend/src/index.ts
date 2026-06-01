import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const hostFilesRoot = path.resolve(
  process.env.HOST_FILES_ROOT ?? "/host-files",
);
const minimaStatusUrl =
  process.env.MINIMA_STATUS_URL ?? "http://minima:9005/status";
const integritasBaseUrl =
  process.env.INTEGRITAS_BASE_URL ?? "https://integritas.technology/core";
const integritasRequestId =
  process.env.INTEGRITAS_REQUEST_ID ?? "integritas-pi";
const integritasApiKeyFallback = process.env.INTEGRITAS_API_KEY ?? "";
const databasePath = process.env.DATABASE_PATH ?? "/data/integritas-pi.db";
const appSecret = process.env.APP_SECRET ?? "dev-change-me";
const dockerSocketPath =
  process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const db = new Database(databasePath);

type FileItem = {
  name: string;
  type: "file" | "directory" | "other";
  size?: number;
};

type IntegritasStatusItem = {
  uid?: string;
  onchain?: boolean;
  address?: string;
  data?: string;
  proof?: string;
  root?: string;
  status?: boolean;
  error?: string;
};

type EncryptedSecret = {
  iv: string;
  tag: string;
  value: string;
};

type ServiceStatus = {
  name: string;
  ok: boolean;
  status: string;
  details?: unknown;
  error?: string;
};

type DockerContainer = {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  SizeRootFs?: number;
  Labels?: Record<string, string>;
};

type DockerStats = {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number; percpu_usage?: number[] };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: {
    usage?: number;
    limit?: number;
    stats?: { cache?: number };
  };
};

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json({ limit: "2mb" }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/api/health", (_req, res) => {
  // TODO: Add authentication before exposing this beyond a trusted local network.
  res.json({ status: "ok", service: "integritas-pi-backend" });
});

app.get("/api/status/overview", async (_req, res) => {
  const services: ServiceStatus[] = [
    {
      name: "backend",
      ok: true,
      status: "ok",
      details: {
        service: "integritas-pi-backend",
        databasePath,
        integritasApiKeyConfigured: Boolean(getIntegritasApiKey()),
      },
    },
  ];

  try {
    const { response, body } = await fetchJsonWithTimeout(minimaStatusUrl);
    const minimaBody = body as { status?: boolean; response?: unknown } | null;
    services.push({
      name: "minima",
      ok: response.ok && minimaBody?.status === true,
      status:
        response.ok && minimaBody?.status === true
          ? "ok"
          : `HTTP ${response.status}`,
      details: body,
    });
  } catch (error) {
    services.push({
      name: "minima",
      ok: false,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const integritasApiKey = getIntegritasApiKey();
  if (!integritasApiKey) {
    services.push({
      name: "integritas",
      ok: false,
      status: "missing_api_key",
      error: "Integritas API key is not configured",
    });
  } else {
    try {
      const { response, body } = await fetchJsonWithTimeout(
        `${integritasBaseUrl}/v1/web/check/health`,
        {
          headers: {
            "x-request-id": integritasRequestId,
            "x-api-key": integritasApiKey,
          },
        },
      );
      services.push({
        name: "integritas",
        ok: response.ok,
        status: response.ok ? "ok" : `HTTP ${response.status}`,
        details: body,
      });
    } catch (error) {
      services.push({
        name: "integritas",
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  let resources: unknown = null;
  try {
    resources = {
      containers: await dockerServiceResources(),
      disks: [await diskUsage("/data"), await diskUsage(hostFilesRoot)],
    };
  } catch (error) {
    resources = {
      error:
        error instanceof Error
          ? error.message
          : "Could not read Docker resource usage",
    };
  }

  res.json({
    generatedAt: new Date().toISOString(),
    services,
    resources,
  });
});

app.get("/api/minima/status", async (_req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(minimaStatusUrl, {
      signal: controller.signal,
    });
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
      body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res
      .status(502)
      .json({ ok: false, source: minimaStatusUrl, error: message });
  } finally {
    clearTimeout(timeout);
  }
});

function parseResponseBody(responseText: string) {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

async function fetchJsonWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return { response, body: parseResponseBody(text) };
  } finally {
    clearTimeout(timeout);
  }
}

function dockerRequest<T>(pathName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { socketPath: dockerSocketPath, path: pathName, method: "GET" },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (
            !response.statusCode ||
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            reject(
              new Error(
                `Docker API returned HTTP ${response.statusCode}: ${body}`,
              ),
            );
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(5000, () =>
      request.destroy(new Error("Docker API request timed out")),
    );
    request.end();
  });
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function cpuPercent(stats: DockerStats) {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) -
    (stats.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus =
    stats.cpu_stats?.online_cpus ||
    stats.cpu_stats?.cpu_usage?.percpu_usage?.length ||
    1;

  if (cpuDelta <= 0 || systemDelta <= 0) return 0;
  return Number(((cpuDelta / systemDelta) * onlineCpus * 100).toFixed(2));
}

async function dockerServiceResources() {
  const containers = await dockerRequest<DockerContainer[]>(
    "/containers/json?all=1&size=1",
  );
  const appContainers = containers.filter(
    (container) =>
      container.Labels?.["com.docker.compose.project"] === "integritas-pi",
  );

  return Promise.all(
    appContainers.map(async (container) => {
      const stats =
        container.State === "running"
          ? await dockerRequest<DockerStats>(
              `/containers/${container.Id}/stats?stream=false`,
            )
          : null;
      const memoryUsage = stats?.memory_stats?.usage ?? 0;
      const memoryCache = stats?.memory_stats?.stats?.cache ?? 0;
      const memoryWorkingSet = Math.max(memoryUsage - memoryCache, 0);

      return {
        service:
          container.Labels?.["com.docker.compose.service"] ??
          container.Names[0]?.replace(/^\//, "") ??
          container.Id.slice(0, 12),
        containerId: container.Id.slice(0, 12),
        state: container.State,
        status: container.Status,
        cpuPercent: stats ? cpuPercent(stats) : null,
        memory: stats
          ? {
              usageBytes: memoryWorkingSet,
              usage: formatBytes(memoryWorkingSet),
              limitBytes: stats.memory_stats?.limit,
              limit: formatBytes(stats.memory_stats?.limit),
            }
          : null,
        disk: {
          rootFsBytes: container.SizeRootFs,
          rootFs: formatBytes(container.SizeRootFs),
        },
      };
    }),
  );
}

async function diskUsage(targetPath: string) {
  const stats = await fs.statfs(targetPath);
  const total = stats.blocks * stats.bsize;
  const free = stats.bavail * stats.bsize;
  const used = total - free;

  return {
    path: targetPath,
    totalBytes: total,
    total: formatBytes(total),
    usedBytes: used,
    used: formatBytes(used),
    freeBytes: free,
    free: formatBytes(free),
    usedPercent: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0,
  };
}

function sha3HashHex(bytesOrString: string) {
  return crypto
    .createHash("sha3-256")
    .update(bytesOrString, "utf8")
    .digest("hex");
}

function encryptionKey() {
  return crypto.createHash("sha256").update(appSecret).digest();
}

function encryptSecret(value: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

function decryptSecret(secret: EncryptedSecret) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.value, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function saveSetting(key: string, value: string) {
  db.prepare(
    `
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `,
  ).run(key, value);
}

function getSetting(key: string) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

function deleteSetting(key: string) {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

function getStoredIntegritasApiKey() {
  const encryptedValue = getSetting("integritas_api_key");
  if (!encryptedValue) return "";

  try {
    return decryptSecret(JSON.parse(encryptedValue) as EncryptedSecret);
  } catch (error) {
    console.error("Failed to decrypt stored Integritas API key", error);
    return "";
  }
}

function getIntegritasApiKey() {
  return getStoredIntegritasApiKey() || integritasApiKeyFallback;
}

function requireIntegritasApiKey(res: express.Response) {
  const apiKey = getIntegritasApiKey();
  if (apiKey) return apiKey;

  res.status(400).json({
    error: "Integritas API key is not configured",
  });
  return "";
}

function proofPayloadFromStatusItem(item: IntegritasStatusItem) {
  if (!item?.uid) return null;

  if (item.proof === "[ERROR]" || item.status === false || item.error) {
    throw new Error(
      item.error || `Integritas proof failed for uid ${item.uid}`,
    );
  }

  if (!item.onchain) return null;

  return [
    {
      address: item.address || "",
      data: item.data || "",
      proof: item.proof || "",
      root: item.root || "",
    },
  ];
}

app.get("/api/integritas/config", (_req, res) => {
  res.json({
    baseUrl: integritasBaseUrl,
    requestId: integritasRequestId,
    hasApiKey: Boolean(getIntegritasApiKey()),
    apiKeySource: getStoredIntegritasApiKey()
      ? "database"
      : integritasApiKeyFallback
        ? "environment"
        : "none",
  });
});

app.post("/api/integritas/api-key", (req, res) => {
  const apiKey =
    typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }

  saveSetting("integritas_api_key", JSON.stringify(encryptSecret(apiKey)));
  res.json({ hasApiKey: true, apiKeySource: "database" });
});

app.delete("/api/integritas/api-key", (_req, res) => {
  deleteSetting("integritas_api_key");
  res.json({
    hasApiKey: Boolean(integritasApiKeyFallback),
    apiKeySource: integritasApiKeyFallback ? "environment" : "none",
  });
});

app.post("/api/integritas/hash", (req, res) => {
  const canonicalBytes =
    typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";

  if (!canonicalBytes) {
    res.status(400).json({ error: "canonicalBytes is required" });
    return;
  }

  res.json({
    hash: sha3HashHex(canonicalBytes),
    canonicalization: "integritas-pi-text-utf8-v1",
  });
});

app.post("/api/integritas/stamp", async (req, res) => {
  const integritasApiKey = requireIntegritasApiKey(res);
  if (!integritasApiKey) return;

  const canonicalBytes =
    typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  const providedHash = typeof req.body?.hash === "string" ? req.body.hash : "";
  const hash =
    providedHash || (canonicalBytes ? sha3HashHex(canonicalBytes) : "");

  if (!hash) {
    res.status(400).json({ error: "hash or canonicalBytes is required" });
    return;
  }

  const response = await fetch(`${integritasBaseUrl}/v1/timestamp/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": integritasRequestId,
      "x-api-key": integritasApiKey,
    },
    body: JSON.stringify({ hash }),
  });

  const responseText = await response.text();
  const parsed = parseResponseBody(responseText);

  if (!response.ok) {
    res
      .status(response.status)
      .json({ error: "Integritas stamp failed", responseBody: parsed });
    return;
  }

  const uid =
    typeof parsed === "object" && parsed && "data" in parsed
      ? (parsed as { data?: { uid?: string } }).data?.uid
      : "";
  res.json({
    hash,
    proofUid: uid || "",
    proofStatus: "pending",
    response: parsed,
  });
});

app.post("/api/integritas/status", async (req, res) => {
  const integritasApiKey = requireIntegritasApiKey(res);
  if (!integritasApiKey) return;

  const uids = Array.isArray(req.body?.uids)
    ? req.body.uids.filter((uid: unknown) => typeof uid === "string" && uid)
    : [];
  if (uids.length === 0) {
    res.status(400).json({ error: "uids must contain at least one UID" });
    return;
  }

  const response = await fetch(`${integritasBaseUrl}/v1/timestamp/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": integritasRequestId,
      "x-api-key": integritasApiKey,
    },
    body: JSON.stringify({ uids }),
  });

  const responseText = await response.text();
  const parsed = parseResponseBody(responseText);

  if (!response.ok) {
    res
      .status(response.status)
      .json({ error: "Integritas status check failed", responseBody: parsed });
    return;
  }

  const data =
    typeof parsed === "object" &&
    parsed &&
    "data" in parsed &&
    Array.isArray((parsed as { data?: unknown }).data)
      ? (parsed as { data: IntegritasStatusItem[] }).data
      : [];

  try {
    res.json({
      items: data,
      proofPayloads: data.map((item) => ({
        uid: item.uid,
        proofPayload: proofPayloadFromStatusItem(item),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Integritas proof status failed";
    res.status(502).json({ error: message, items: data });
  }
});

app.post("/api/integritas/verify", async (req, res) => {
  const integritasApiKey = requireIntegritasApiKey(res);
  if (!integritasApiKey) return;

  const canonicalBytes =
    typeof req.body?.canonicalBytes === "string" ? req.body.canonicalBytes : "";
  const storedHash =
    typeof req.body?.storedHash === "string" ? req.body.storedHash : "";
  const proofPayload = req.body?.proofPayload;

  if (!canonicalBytes || !storedHash) {
    res
      .status(400)
      .json({ error: "canonicalBytes and storedHash are required" });
    return;
  }

  const currentHash = sha3HashHex(canonicalBytes);
  if (currentHash !== storedHash) {
    res
      .status(400)
      .json({
        error: "The current document bytes do not match the stamped hash",
        currentHash,
        storedHash,
      });
    return;
  }

  if (!Array.isArray(proofPayload) || proofPayload.length === 0) {
    res.status(400).json({ error: "proofPayload must be a non-empty array" });
    return;
  }

  const response = await fetch(`${integritasBaseUrl}/v1/verify/post-lite-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": integritasRequestId,
      "x-report-required": "true",
      "x-api-key": integritasApiKey,
    },
    body: JSON.stringify(proofPayload),
  });

  const responseText = await response.text();
  const parsed = parseResponseBody(responseText);

  if (!response.ok) {
    res
      .status(response.status)
      .json({ error: "Integritas verification failed", responseBody: parsed });
    return;
  }

  res.json({ currentHash, response: parsed });
});

app.get("/api/files", async (req, res) => {
  const requestedPath =
    typeof req.query.path === "string" ? req.query.path : "/";
  const safePath = requestedPath.startsWith("/")
    ? requestedPath
    : `/${requestedPath}`;
  const relativePath = safePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(hostFilesRoot, relativePath);

  if (
    absolutePath !== hostFilesRoot &&
    !absolutePath.startsWith(`${hostFilesRoot}${path.sep}`)
  ) {
    res.status(403).json({ error: "Path is outside the allowed directory" });
    return;
  }

  try {
    const rootRealPath = await fs.realpath(hostFilesRoot);
    const targetRealPath = await fs.realpath(absolutePath);

    if (
      targetRealPath !== rootRealPath &&
      !targetRealPath.startsWith(`${rootRealPath}${path.sep}`)
    ) {
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
          type: entry.isDirectory()
            ? "directory"
            : entry.isFile()
              ? "file"
              : "other",
        };

        if (entry.isFile()) {
          const entryStat = await fs.lstat(entryPath);
          item.size = entryStat.size;
        }

        return item;
      }),
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
  console.log(`Integritas base URL: ${integritasBaseUrl}`);
  console.log(`SQLite database path: ${databasePath}`);
});
