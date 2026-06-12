import { Router } from "express";
import { env } from "../../config/env.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import { getMinimaNodeStatus } from "../minima/minima.service.js";
import { dockerServiceResources, diskUsage } from "./docker.service.js";
import { getDeviceInfo } from "./device.service.js";
import { getLastMinimaPollerState } from "../minima/minima-monitoring.js";
import { isSetupComplete } from "../auth/setup.service.js";

type ServiceStatus = {
  name: string;
  ok: boolean;
  status: string;
  details?: unknown;
  error?: string;
};

export const statusRouter = Router();

let integritasConnectionCache: { connected: boolean; checkedAt: number } | null = null;
const INTEGRITAS_CACHE_TTL_MS = 30_000;
const INTEGRITAS_CHECK_TIMEOUT_MS = 3_000;

async function getIntegritasConnected(apiKey: string): Promise<boolean> {
  if (integritasConnectionCache && Date.now() - integritasConnectionCache.checkedAt < INTEGRITAS_CACHE_TTL_MS) {
    return integritasConnectionCache.connected;
  }
  try {
    const { response } = await fetchJsonWithTimeout(
      `${env.integritasBaseUrl}/v1/web/check/health`,
      { headers: { "x-request-id": env.integritasRequestId, "x-api-key": apiKey } },
      INTEGRITAS_CHECK_TIMEOUT_MS
    );
    integritasConnectionCache = { connected: response.ok, checkedAt: Date.now() };
    return response.ok;
  } catch {
    integritasConnectionCache = { connected: false, checkedAt: Date.now() };
    return false;
  }
}

statusRouter.get("/", async (_req, res) => {
  const device = getDeviceInfo();
  const node = getLastMinimaPollerState();
  const integritasApiKey = getIntegritasApiKey();

  let integritasConnected: boolean | null = null;
  if (integritasApiKey) {
    integritasConnected = await getIntegritasConnected(integritasApiKey);
  }

  res.json({
    checkedAt: new Date().toISOString(),
    device,
    app: {
      running: true as const,
      setupComplete: isSetupComplete(),
      integritasConfigured: Boolean(integritasApiKey),
      integritasConnected
    },
    node
  });
});

statusRouter.get("/overview", async (_req, res) => {
  const services: ServiceStatus[] = [
    {
      name: "backend",
      ok: true,
      status: "ok",
      details: {
        service: "integritas-pi-backend",
        databasePath: env.databasePath,
        integritasApiKeyConfigured: Boolean(getIntegritasApiKey())
      }
    }
  ];

  try {
    const nodeStatus = await getMinimaNodeStatus();
    services.push({
      name: "minima",
      ok: nodeStatus.state === "running",
      status: nodeStatus.state === "running" ? "ok" : nodeStatus.state,
      details: { sync: nodeStatus.sync, health: nodeStatus.health, container: nodeStatus.container }
    });
  } catch (error) {
    services.push({ name: "minima", ok: false, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
  }

  const integritasApiKey = getIntegritasApiKey();
  if (!integritasApiKey) {
    services.push({ name: "integritas", ok: false, status: "missing_api_key", error: "Integritas API key is not configured" });
  } else {
    try {
      const { response, body } = await fetchJsonWithTimeout(`${env.integritasBaseUrl}/v1/web/check/health`, {
        headers: { "x-request-id": env.integritasRequestId, "x-api-key": integritasApiKey }
      });
      services.push({ name: "integritas", ok: response.ok, status: response.ok ? "ok" : `HTTP ${response.status}`, details: body });
    } catch (error) {
      services.push({ name: "integritas", ok: false, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  let resources: unknown = null;
  try {
    resources = { containers: await dockerServiceResources(), disks: [await diskUsage("/data"), await diskUsage(env.hostFilesRoot)] };
  } catch (error) {
    resources = { error: error instanceof Error ? error.message : "Could not read Docker resource usage" };
  }

  res.json({ generatedAt: new Date().toISOString(), services, resources });
});
