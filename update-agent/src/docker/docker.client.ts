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

/**
 * Streams a newline-delimited-JSON Docker API response (used by /images/create)
 * to completion, rejecting if any progress event reports an error.
 */
export function dockerRequestStream(pathName: string, timeoutMs = 300000): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { socketPath: env.dockerSocketPath, path: pathName, method: "POST" },
      (response) => {
        let buffered = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          buffered += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Docker API POST ${pathName} returned HTTP ${response.statusCode}: ${buffered}`));
            return;
          }

          const lines = buffered.split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as { error?: string };
              if (parsed.error) {
                reject(new Error(parsed.error));
                return;
              }
            } catch {
              // non-JSON progress line, ignore
            }
          }
          resolve();
        });
      }
    );

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Docker API POST ${pathName} timed out`)));
    request.end();
  });
}
