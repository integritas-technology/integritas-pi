# Data Source Rules

- Supported V1 input/capture source types are HTTP JSON API fetches, webhook JSON receives, MQTT JSON subscriptions, Raspberry Pi GPIO input events, and Pi Camera captures.
- Supported V1 output target types are GPIO LED pulses, HTTP/API JSON requests, and MQTT JSON publishes.
- Skip file-source and manual-upload source types unless explicitly requested.
- Store the latest JSON preview and latest hash on the data source.
- Pi Camera devices are capture sources, not output targets. Workflow `Capture camera` blocks hash captured media bytes and store JSON metadata as the read preview.
- Do not impose arbitrary app-level file/data limits unless required for safety.
- Webhook sources receive JSON through public `/api/data-source-webhooks/:token` endpoints generated per source. They are push-only and only record incoming data when an enabled Automation workflow exists for the source.
- MQTT sources define a broker URL/topic and expect JSON payloads. The backend only subscribes while an enabled Automation workflow exists for the MQTT source.
- GPIO input sources define a BCM pin, edge, pull resistor, debounce, and active state. They are input-only and only watch pins while an enabled Automation workflow exists for the source.
- Pi Camera capture requires explicit camera device access and must stay opt-in because it grants host camera access and can record private images/video.
- The optional local MQTT broker is a local service, not a configured device. Keep it off by default and document LAN exposure when enabling it.
