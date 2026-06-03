import express from "express";
import { filesRouter } from "./features/files/files.routes.js";
import { dataSourcesRouter } from "./features/data-sources/dataSources.routes.js";
import { healthRouter } from "./features/health/health.routes.js";
import { integritasRouter } from "./features/integritas/integritas.routes.js";
import { minimaRouter } from "./features/minima/minima.routes.js";
import { statusRouter } from "./features/status/status.routes.js";
import { requestLogger } from "./middleware/requestLogger.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);

  app.use("/api/health", healthRouter);
  app.use("/api/status", statusRouter);
  app.use("/api/minima", minimaRouter);
  app.use("/api/integritas", integritasRouter);
  app.use("/api/data-sources", dataSourcesRouter);
  app.use("/api/files", filesRouter);

  return app;
}
