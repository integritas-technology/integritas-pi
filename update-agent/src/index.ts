import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { startStatusPoller } from "./status/status-poller.js";

const app = createApp();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`integritas-pi update-agent listening on port ${env.port}`);
});

startStatusPoller();
