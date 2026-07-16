import path from "node:path";

const repoRoot = process.env.INTEGRITAS_PI_ROOT ?? process.cwd();

function resolveConfigPath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function resolveDatabasePath() {
  if (process.env.DATABASE_PATH) {
    return resolveConfigPath(process.env.DATABASE_PATH);
  }

  if (process.env.DATA_DIR) {
    return resolveConfigPath(path.join(process.env.DATA_DIR, "integritas-pi.db"));
  }

  return "/data/integritas-pi.db";
}

function resolveDataDir(databasePath: string) {
  if (process.env.DATA_DIR_IN_CONTAINER) {
    return process.env.DATA_DIR_IN_CONTAINER;
  }

  if (process.env.DATA_DIR) {
    return resolveConfigPath(process.env.DATA_DIR);
  }

  return path.dirname(databasePath);
}

function resolveHostFilesRoot() {
  const configured = process.env.HOST_FILES_ROOT ?? process.env.HOST_FILES_DIR;
  if (configured) {
    return resolveConfigPath(configured);
  }

  return "/host-files";
}

function resolveMinimaStatusUrl() {
  if (process.env.MINIMA_STATUS_URL) {
    return process.env.MINIMA_STATUS_URL;
  }

  const rpcPort = process.env.MINIMA_RPC_PORT ?? "9005";
  return `http://127.0.0.1:${rpcPort}/status`;
}

const databasePath = resolveDatabasePath();

export const env = {
  port: Number(process.env.PORT ?? 3000),
  hostFilesRoot: resolveHostFilesRoot(),
  minimaStatusUrl: resolveMinimaStatusUrl(),
  integritasBaseUrl: process.env.INTEGRITAS_BASE_URL ?? "https://integritas.technology/core",
  integritasRequestId: process.env.INTEGRITAS_REQUEST_ID ?? "integritas-pi",
  integritasRequestTimeoutMs: Number(process.env.INTEGRITAS_REQUEST_TIMEOUT_MS ?? 15000),
  integritasPollIntervalSeconds: Number(process.env.INTEGRITAS_POLL_INTERVAL_SECONDS ?? 30),
  integritasProofPollTimeoutMinutes: Number(process.env.INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES ?? 5),
  integritasPortalUrl: process.env.INTEGRITAS_PORTAL_URL ?? "",
  integritasApiKeyFallback: process.env.INTEGRITAS_API_KEY ?? "",
  databasePath,
  dataDir: resolveDataDir(databasePath),
  appSecret: process.env.APP_SECRET ?? "dev-change-me",
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieSameSite: "strict" as const,
  sessionCookieName: "session",
  sessionMaxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS ?? 7),
  sessionIdleHours: Number(process.env.SESSION_IDLE_HOURS ?? 24),
  minimaHealthPollIntervalSeconds: Number(process.env.MINIMA_HEALTH_POLL_INTERVAL_SECONDS ?? 60),
  minimaStallBlockAgeSeconds: Number(process.env.MINIMA_STALL_BLOCK_AGE_SECONDS ?? 300),
  minimaAutoResync: process.env.MINIMA_AUTO_RESYNC === "true",
  minimaAutoResyncCooldownMinutes: Number(process.env.MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES ?? 30),
  mqttBrokerEnabled: process.env.ENABLE_MQTT_BROKER === "true",
  mqttPublicHost: process.env.MQTT_PUBLIC_HOST ?? "",
  mqttPublicPort: Number(process.env.MQTT_PUBLIC_PORT ?? 1883),
  mqttInternalUrl: process.env.MQTT_INTERNAL_URL ?? "mqtt://mqtt:1883"
};
