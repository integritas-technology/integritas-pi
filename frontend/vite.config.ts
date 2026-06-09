import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const backendTarget = `http://localhost:${env.PORT || "3000"}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": backendTarget,
      },
    },
    preview: {
      host: "0.0.0.0",
      proxy: {
        "/api": backendTarget,
      },
    },
  };
});
