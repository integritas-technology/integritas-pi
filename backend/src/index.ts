import "./config/loadEnv.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/database.js";
import { createApp } from "./app.js";
import { startAutomationScheduler } from "./features/automation/automation.service.js";
import { startIntegritasProofPoller } from "./features/integritas/integritas-poll.service.js";

if (env.appSecret === "dev-change-me") {
  console.warn("WARNING: APP_SECRET is set to the default dev-change-me value. Change it before production use.");
}

runMigrations();
startAutomationScheduler();
startIntegritasProofPoller();

const app = createApp();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`integritas-pi backend listening on port ${env.port}`);
  console.log(`File access root: ${env.hostFilesRoot}`);
  console.log(`Minima status URL: ${env.minimaStatusUrl}`);
  console.log(`Integritas base URL: ${env.integritasBaseUrl}`);
  console.log(`SQLite database path: ${env.databasePath}`);
});
