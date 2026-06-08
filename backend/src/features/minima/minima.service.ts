import { env } from "../../config/env.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";

const megammrHostSetting = "minima_megammr_host";
const defaultMegammrHost = "megammr.minima.global:9001";

export function getMinimaConfig() {
  const storedMegammrHost = getSetting(megammrHostSetting).trim();
  return {
    megammrHost: storedMegammrHost || defaultMegammrHost,
    megammrHostSource: storedMegammrHost ? "database" : "default"
  };
}

export function saveMinimaConfig({ megammrHost }: { megammrHost: string }) {
  const trimmedMegammrHost = megammrHost.trim();
  if (!trimmedMegammrHost) throw new Error("megammrHost is required");
  saveSetting(megammrHostSetting, trimmedMegammrHost);
  return getMinimaConfig();
}

export async function getMinimaStatus() {
  const { response, body } = await fetchJsonWithTimeout(env.minimaStatusUrl);
  return {
    ok: response.ok,
    status: response.status,
    source: env.minimaStatusUrl,
    body
  };
}

export async function resyncMegammr() {
  const { megammrHost } = getMinimaConfig();
  const command = `megammrsync action:resync host:${megammrHost}`;
  const url = new URL(env.minimaStatusUrl);
  url.pathname = `/${encodeURIComponent(command)}`;
  url.search = "";

  const { response, body } = await fetchJsonWithTimeout(url.toString(), {}, 30000);
  return {
    ok: response.ok,
    status: response.status,
    source: url.toString(),
    command,
    body
  };
}
