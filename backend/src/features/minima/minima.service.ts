import { env } from "../../config/env.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";

export async function getMinimaStatus() {
  const { response, body } = await fetchJsonWithTimeout(env.minimaStatusUrl);
  return {
    ok: response.ok,
    status: response.status,
    source: env.minimaStatusUrl,
    body
  };
}
