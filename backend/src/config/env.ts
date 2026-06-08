import path from "node:path";

export const env = {
  port: Number(process.env.PORT ?? 3000),
  hostFilesRoot: path.resolve(process.env.HOST_FILES_ROOT ?? "/host-files"),
  minimaStatusUrl: process.env.MINIMA_STATUS_URL ?? "http://minima:9005/status",
  integritasBaseUrl: process.env.INTEGRITAS_BASE_URL ?? "https://integritas.technology/core",
  integritasRequestId: process.env.INTEGRITAS_REQUEST_ID ?? "integritas-pi",
  integritasApiKeyFallback: process.env.INTEGRITAS_API_KEY ?? "",
  databasePath: process.env.DATABASE_PATH ?? "/data/integritas-pi.db",
  dataDir: process.env.DATA_DIR_IN_CONTAINER ?? "/data",
  appSecret: process.env.APP_SECRET ?? "dev-change-me",
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieSameSite: "strict" as const,
  sessionCookieName: "session",
  sessionMaxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS ?? 7),
  sessionIdleHours: Number(process.env.SESSION_IDLE_HOURS ?? 24)
};
