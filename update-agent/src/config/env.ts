export const env = {
  port: Number(process.env.PORT ?? 8081),
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
  manifestUrl: process.env.MANIFEST_URL ?? "",
  manifestPublicKey: process.env.MANIFEST_PUBLIC_KEY ?? "",
  releaseChannel: process.env.RELEASE_CHANNEL ?? "stable",
  backendInternalUrl: process.env.BACKEND_INTERNAL_URL ?? "http://backend:3000",
  minimaStatusUrl: process.env.MINIMA_STATUS_URL ?? "http://minima:9005/status",
  minimaDataDirInContainer: process.env.MINIMA_DATA_DIR_IN_CONTAINER ?? "/minima-data",
  minimaBackupDirInContainer: process.env.MINIMA_BACKUP_DIR_IN_CONTAINER ?? "/minima-backup",
  healthCheckTimeoutMs: Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? 30000),
  healthCheckIntervalMs: Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? 2000)
};
