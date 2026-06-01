import { Router } from "express";
import { env } from "../../config/env.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import { dockerServiceResources, diskUsage } from "./docker.service.js";

type ServiceStatus = {
  name: string;
  ok: boolean;
  status: string;
  details?: unknown;
  error?: string;
};

export const statusRouter = Router();

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
    const { response, body } = await fetchJsonWithTimeout(env.minimaStatusUrl);
    const minimaBody = body as { status?: boolean; response?: unknown } | null;
    services.push({
      name: "minima",
      ok: response.ok && minimaBody?.status === true,
      status: response.ok && minimaBody?.status === true ? "ok" : `HTTP ${response.status}`,
      details: body
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
