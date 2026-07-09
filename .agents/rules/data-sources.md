# Data Source Rules

- Supported V1 data source types are HTTP JSON API fetches, webhook JSON receives, MQTT JSON subscriptions, and Raspberry Pi GPIO input events.
- Skip file-source and manual-upload source types unless explicitly requested.
- Store the latest JSON preview and latest hash on the data source.
- Do not impose arbitrary app-level file/data limits unless required for safety.
- Webhook sources receive JSON through public `/api/data-source-webhooks/:token` endpoints generated per source. They are push-only and only record incoming data when an enabled Automation workflow exists for the source.
- MQTT sources define a broker URL/topic and expect JSON payloads. The backend only subscribes while an enabled Automation workflow exists for the MQTT source.
- GPIO input sources define a BCM pin, edge, pull resistor, debounce, and active state. They are input-only and only watch pins while an enabled Automation workflow exists for the source.
