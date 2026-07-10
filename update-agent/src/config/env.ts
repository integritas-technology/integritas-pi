import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readManifestPublicKey(): string {
  const keyPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../manifest-public-key.pem");
  try {
    return readFileSync(keyPath, "utf8");
  } catch {
    return "";
  }
}

export const env = {
  port: Number(process.env.PORT ?? 8081),
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
  manifestUrl: process.env.MANIFEST_URL ?? "",
  manifestPublicKey: readManifestPublicKey(),
  releaseChannel: process.env.RELEASE_CHANNEL ?? "stable",
  backendInternalUrl: process.env.BACKEND_INTERNAL_URL ?? "http://backend:3000",
  minimaStatusUrl: process.env.MINIMA_STATUS_URL ?? "http://minima:9005/status",
  minimaDataDirInContainer: process.env.MINIMA_DATA_DIR_IN_CONTAINER ?? "/minima-data",
  minimaBackupDirInContainer: process.env.MINIMA_BACKUP_DIR_IN_CONTAINER ?? "/minima-backup",
  stateDirInContainer: process.env.STATE_DIR_IN_CONTAINER ?? "/state",
  healthCheckTimeoutMs: Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? 60000),
  healthCheckIntervalMs: Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? 2000),
  pullTimeoutMs: Number(process.env.PULL_TIMEOUT_MS ?? 300000),
  statusPollIntervalMs: Number(process.env.STATUS_POLL_INTERVAL_MS ?? 86400000)
};
