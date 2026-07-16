import http from "node:http";
import { env } from "../config/env.js";

export function dockerRequest<T>(
  method: "GET" | "POST" | "DELETE",
  pathName: string,
  body?: unknown,
  timeoutMs = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const request = http.request(
      {
        socketPath: env.dockerSocketPath,
        path: pathName,
        method,
        headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : undefined
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Docker API ${method} ${pathName} returned HTTP ${response.statusCode}: ${responseBody}`));
            return;
          }

          if (!responseBody) {
            resolve(undefined as T);
            return;
          }

          try {
            resolve(JSON.parse(responseBody) as T);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Docker API ${method} ${pathName} timed out`)));
    if (payload) request.write(payload);
    request.end();
  });
}

export type DockerProgressLine = {
  status?: string;
  id?: string;
  progressDetail?: { current?: number; total?: number };
  error?: string;
};

/**
 * Streams a newline-delimited-JSON Docker API response (used by /images/create)
 * to completion, rejecting if any progress event reports an error. Each
 * parsed line is handed to onProgress as it arrives, not just at the end.
 */
export function dockerRequestStream(
  pathName: string,
  timeoutMs = 300000,
  onProgress?: (line: DockerProgressLine) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let trailing = "";
    let lastBody = "";

    const request = http.request(
      { socketPath: env.dockerSocketPath, path: pathName, method: "POST" },
      (response) => {
        response.setEncoding("utf8");

        response.on("data", (chunk: string) => {
          if (settled) return;
          lastBody += chunk;
          trailing += chunk;

          const lines = trailing.split("\n");
          trailing = lines.pop() ?? "";

          for (const line of lines) {
            if (!line) continue;
            try {
              const parsed = JSON.parse(line) as DockerProgressLine;
              if (parsed.error) {
                settled = true;
                reject(new Error(parsed.error));
                request.destroy();
                return;
              }
              onProgress?.(parsed);
            } catch {
              // non-JSON progress line, ignore
            }
          }
        });

        response.on("end", () => {
          if (settled) return;
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            settled = true;
            reject(new Error(`Docker API POST ${pathName} returned HTTP ${response.statusCode}: ${lastBody}`));
            return;
          }
          settled = true;
          resolve();
        });
      }
    );

    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.setTimeout(timeoutMs, () => {
      if (settled) return;
      settled = true;
      request.destroy(new Error(`Docker API POST ${pathName} timed out`));
    });
    request.end();
  });
}
