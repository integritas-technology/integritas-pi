import cookieParser from "cookie-parser";
import express from "express";
import { authProtectedRouter, authPublicRouter } from "./features/auth/auth.routes.js";
import { requireAuth } from "./features/auth/auth.middleware.js";
import { setupRouter } from "./features/auth/setup.routes.js";
import { automationRouter } from "./features/automation/automation.routes.js";
import { dataReadsRouter } from "./features/data-reads/dataReads.routes.js";
import { filesRouter } from "./features/files/files.routes.js";
import { dataSourcesRouter } from "./features/data-sources/dataSources.routes.js";
import { healthRouter } from "./features/health/health.routes.js";
import { integritasRouter } from "./features/integritas/integritas.routes.js";
import { minimaRouter } from "./features/minima/minima.routes.js";
import { statusRouter } from "./features/status/status.routes.js";
import { walletRouter } from "./features/wallet/wallet.routes.js";
import { requestLogger } from "./middleware/requestLogger.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use("/api/health", healthRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/auth", authPublicRouter);

  app.use(requireAuth);

  app.use("/api/auth", authProtectedRouter);
  app.use("/api/status", statusRouter);
  app.use("/api/minima", minimaRouter);
  app.use("/api/integritas", integritasRouter);
  app.use("/api/data-sources", dataSourcesRouter);
  app.use("/api/data-reads", dataReadsRouter);
  app.use("/api/automation", automationRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/wallet", walletRouter);

  return app;
}
