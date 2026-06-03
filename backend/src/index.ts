import { env } from "./config/env.js";
import { runMigrations } from "./db/database.js";
import { createApp } from "./app.js";
import { startAutomationScheduler } from "./features/automation/automation.service.js";

runMigrations();
startAutomationScheduler();

const app = createApp();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`integritas-pi backend listening on port ${env.port}`);
  console.log(`File access root: ${env.hostFilesRoot}`);
  console.log(`Minima status URL: ${env.minimaStatusUrl}`);
  console.log(`Integritas base URL: ${env.integritasBaseUrl}`);
  console.log(`SQLite database path: ${env.databasePath}`);
});
