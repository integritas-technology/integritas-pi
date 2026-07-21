import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { requireAdmin } from "./auth/auth.middleware.js";
import { statusRouter } from "./status/status.routes.js";
import { applyRouter } from "./update/apply.routes.js";

const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

export function createApp() {
  const app = express();

  app.use(express.json());

  // Static shell is public, like frontend's own index.html — auth happens
  // client-side against /status and /apply, same pattern as frontend's AuthProvider.
  app.use(express.static(staticDir));

  app.use("/status", requireAdmin, statusRouter);
  app.use("/apply", requireAdmin, applyRouter);

  return app;
}
