import "./config/loadEnv.js";
import { env } from "./config/env.js";
import { db, runMigrations } from "./db/database.js";
import { createApp } from "./app.js";
import { startAutomationScheduler, stopAutomationScheduler } from "./features/automation/automation.service.js";
import { startIntegritasProofPoller, stopIntegritasProofPoller } from "./features/integritas/integritas-poll.service.js";
import { startMinimaHealthPoller, stopMinimaHealthPoller } from "./features/minima/minima-poll.service.js";
import { startMqttIngestion, stopMqttIngestion } from "./features/data-sources/mqttIngestion.service.js";
import { ensureDeviceId } from "./features/status/device.service.js";

if (env.appSecret === "dev-change-me") {
  console.warn("WARNING: APP_SECRET is set to the default dev-change-me value. Change it before production use.");
}

runMigrations();
await ensureDeviceId();
startAutomationScheduler();
startIntegritasProofPoller();
startMinimaHealthPoller();
startMqttIngestion();

const app = createApp();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`integritas-pi backend listening on port ${env.port}`);
  console.log(`File access root: ${env.hostFilesRoot}`);
  console.log(`Minima status URL: ${env.minimaStatusUrl}`);
  console.log(`Integritas base URL: ${env.integritasBaseUrl}`);
  console.log(`SQLite database path: ${env.databasePath}`);
});

function shutdown() {
  stopAutomationScheduler();
  stopIntegritasProofPoller();
  stopMinimaHealthPoller();
  stopMqttIngestion();
  db.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
