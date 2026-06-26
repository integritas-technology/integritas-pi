import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = path.resolve(__dirname, "..");
const certDir = path.join(repoRoot, "data/certs");

function devHttpsOptions(mode: string) {
  if (mode !== "https") {
    return undefined;
  }

  const keyPath = path.join(certDir, "server.key");
  const certPath = path.join(certDir, "server.crt");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(
      "HTTPS dev requires TLS certs in data/certs. Run from the repo root: bash scripts/generate-tls-cert.sh"
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const backendTarget = `http://localhost:${env.PORT || "3000"}`;
  const https = devHttpsOptions(mode);
  const proxy = {
    "/api": backendTarget,
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      https,
      proxy,
    },
    preview: {
      host: "0.0.0.0",
      https,
      proxy,
    },
  };
});
