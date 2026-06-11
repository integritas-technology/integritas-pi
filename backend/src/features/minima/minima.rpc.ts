import { env } from "../../config/env.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";

export type MinimaRpcResult = {
  ok: boolean;
  status: number;
  source: string;
  command: string;
  body: unknown;
};

export async function fetchMinimaStatus(timeoutMs = 5000): Promise<MinimaRpcResult> {
  const { response, body } = await fetchJsonWithTimeout(env.minimaStatusUrl, {}, timeoutMs);
  return {
    ok: response.ok,
    status: response.status,
    source: env.minimaStatusUrl,
    command: "status",
    body
  };
}

export async function runMinimaPathCommand(command: string, timeoutMs = 5000): Promise<MinimaRpcResult> {
  const url = new URL(env.minimaStatusUrl);
  url.pathname = `/${encodeURIComponent(command)}`;
  url.search = "";

  const { response, body } = await fetchJsonWithTimeout(url.toString(), {}, timeoutMs);
  return {
    ok: response.ok,
    status: response.status,
    source: url.toString(),
    command,
    body
  };
}
