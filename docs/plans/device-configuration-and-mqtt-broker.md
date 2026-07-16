# Device Configuration And MQTT Broker Plan

**Status:** V1 implemented  
**Created:** 2026-07-15  
**Goal:** Expand Devices from GPIO-only outputs to a clearer input/output/local-services model, add API and MQTT output targets, and optionally let the Raspberry Pi run a local MQTT broker for connected devices.

## Summary

The Devices page should help operators work with three related but different things:

- Input sources: endpoints, devices, or services that send data/events into Integritas Pi.
- Output targets: endpoints, devices, or services that Integritas Pi can control from workflows.
- Local services: app-provided services or connection details that help devices talk to the Pi app.

MQTT broker support belongs under local services. It does not create a third device category. MQTT input subscriptions and MQTT publish targets remain configured devices; the broker is the transport service they can use.

## Current State

- Devices are stored in the existing `data_sources` table.
- The Devices UI already separates template cards into Input sources and Output targets.
- Input source types are `json-api`, `webhook`, `mqtt`, and `gpio-input`.
- Output target support exists only for `gpio-output` with the LED pulse profile.
- Automation has a generic `control_output` block, but backend validation and execution currently accept only GPIO output targets.
- MQTT input sources require a `brokerUrl` and subscribe only while an enabled MQTT event workflow exists.
- There is no app-managed MQTT broker service.

## Target User Experience

Keep the configured-device inventory visible on the Devices page. Replace the always-visible template grid with direct actions for adding devices, plus a smaller Local services area for broker URLs and service status.

```txt
Devices
Connect inputs, outputs, and local services.

[Add input source] [Add output target]

Local services
[Local MQTT Broker]

Configured devices
Name | Direction | Type | Endpoint | Health | Last hash | Last preview | Actions
```

Clicking `Add input source` opens a modal or panel showing only input-source cards.

```txt
Add input source

[HTTP JSON API] [Webhook] [MQTT] [GPIO Input]
```

Clicking `Add output target` opens a modal or panel showing only output-target cards.

```txt
Add output target

[GPIO Output] [HTTP/API Output] [MQTT Output]
```

The Local services area should stay shallow. It is for status, URLs, copy actions, and setup guidance. Do not make it a separate device inventory unless there is a concrete future need.

### Local Services

Initial card:

```txt
Local MQTT Broker
Run a broker on this Raspberry Pi so devices can connect directly without a separate broker.

Status: Disabled / Enabled / Error
LAN URL: mqtt://<pi-host-or-ip>:1883
Internal URL: mqtt://mqtt:1883

Use the LAN URL for ESP32/sensors/devices on the local network.
Use the internal URL for Integritas Pi backend MQTT device configs.

[Enable broker] [Copy LAN URL] [Copy internal URL]
```

The broker card should not appear in the configured devices table because it is a local service, not an input source or output target.

### Add Input Source

Cards:

- HTTP JSON API
- Webhook
- MQTT
- GPIO Input

When the local MQTT broker is enabled, the MQTT input card should show a small hint and prefill the broker URL with `mqtt://mqtt:1883`.

### Add Output Target

Cards:

- GPIO Output
- HTTP/API Output
- MQTT Output

When the local MQTT broker is enabled, the MQTT output card should show a small hint and prefill the broker URL with `mqtt://mqtt:1883`.

## Device And Local Services Model

Use two configured-device directions:

| Direction | Meaning |
|---|---|
| Input source | The Pi reads from it or receives data/events from it. |
| Output target | The Pi sends commands/data to it from workflow action blocks. |

Use Local services for app-managed services or connection details:

| Local service | Meaning |
|---|---|
| Local MQTT broker | A message broker running on the Pi that external devices and backend MQTT configs can use. |

Protocol pairs should look like this:

| Protocol | Input source | Output target |
|---|---|---|
| GPIO | `gpio-input` | `gpio-output` |
| HTTP/API | `json-api` fetch | `http-output` request |
| Webhook/API push | `webhook` receive | covered by `http-output` |
| MQTT | `mqtt` subscribe | `mqtt-output` publish |

## MQTT Broker URLs

The app should expose two broker URLs when the local broker is enabled:

| URL | Used by |
|---|---|
| `mqtt://<pi-host-or-ip>:1883` | External devices on the LAN. |
| `mqtt://mqtt:1883` | Backend containers on the Docker Compose network. |

Add runtime configuration for display and install behavior:

```env
ENABLE_MQTT_BROKER=false
MQTT_PUBLIC_HOST=
MQTT_PUBLIC_PORT=1883
```

If `MQTT_PUBLIC_HOST` is empty, the frontend may fall back to the current browser hostname and show a note:

```txt
If this hostname does not resolve from your device, use the Raspberry Pi's LAN IP address.
```

## HTTP/API Output Target

Add a new output target type, likely `http-output`.

Suggested config:

```ts
type HttpOutputConfig = {
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  timeoutMs?: number;
};
```

Suggested workflow action config:

```ts
{
  targetId: string;
  action: "send_request";
  bodyMode?: "custom" | "workflow_context" | "trigger_payload" | "latest_data" | "none";
  bodyTemplateText?: string;
}
```

Initial constraints:

- Limit methods to `POST`, `PUT`, and `PATCH`.
- Use a request timeout.
- Require JSON request bodies.
- Redact sensitive headers in logs and UI.
- Keep URL validation consistent with existing data-source URL behavior.

## MQTT Output Target

Add a new output target type, likely `mqtt-output`.

Suggested config:

```ts
type MqttOutputConfig = {
  brokerUrl: string;
  topic: string;
  qos?: 0 | 1;
  retain?: boolean;
};
```

Suggested workflow action config:

```ts
{
  targetId: string;
  action: "publish";
  bodyMode?: "custom" | "workflow_context" | "trigger_payload" | "latest_data";
  bodyTemplateText?: string;
}
```

Initial constraints:

- Publish JSON payloads only.
- Default QoS to `0`.
- Default retain to `false`.
- Publish per workflow action and close the client after completion unless persistent clients become necessary.
- Choose the message payload per workflow block, not on the shared output target.

## Backend Plan

1. Extend data-source config parsing with `http-output` and `mqtt-output` config parsers.
2. Update data-source type unions and serialization consumers to recognize the new output target types.
3. Generalize automation validation for `control_output` so it accepts output-capable device types instead of only `gpio-output`.
4. Dispatch `control_output` execution by target type:
   - `gpio-output` -> existing LED pulse path.
   - `http-output` -> HTTP request executor.
   - `mqtt-output` -> MQTT publish executor.
5. Add test actions for output targets where useful:
   - GPIO output: keep test pulse.
   - HTTP output: test request with a small JSON payload.
   - MQTT output: test publish with a small JSON payload.
6. Add MQTT broker capability/status endpoint data so the frontend can show enabled/disabled/error state and broker URLs.

## Docker And Install Plan

Add optional Mosquitto support without changing the default deployment.

1. Add `ENABLE_MQTT_BROKER=false` to `.env.example` and install-generated `.env`.
2. When enabled, add a Mosquitto service through the same install/override pattern used for optional GPIO host access or through an explicit Compose profile.
3. Use service name `mqtt` so backend containers can connect to `mqtt://mqtt:1883`.
4. Expose `${MQTT_PUBLIC_PORT:-1883}:1883` only when the broker is enabled.
5. Store broker config/data under `${DATA_DIR}`.
6. Keep anonymous LAN access as a deliberate decision before implementation; prefer username/password if the implementation remains simple enough.

## Frontend Plan

1. Replace the always-visible template grid on the Devices page with `Add input source` and `Add output target` actions.
2. Add a shallow Local services area near those actions.
3. Move existing input template cards into the `Add input source` modal/panel.
4. Move existing GPIO Output card into the `Add output target` modal/panel.
5. Add HTTP/API Output and MQTT Output cards.
6. Add a Local MQTT Broker service card with status, LAN URL, internal URL, and copy actions.
7. Prefill MQTT input/output broker URL with `mqtt://mqtt:1883` when local broker is enabled.
8. Keep the configured devices table visible as the operator inventory.
9. Update table direction, endpoint rendering, health text, and row actions for the new output target types.

## Security And Documentation Requirements

When implementing this plan, update:

- `README.md` for MQTT broker env vars, device configuration flow, and API/MQTT output usage.
- `SECURITY.md` and `docs/security/data-sources-and-automation.md` for LAN MQTT broker exposure, outbound HTTP/API actions, MQTT publish actions, and credential/header handling.
- `CHANGELOG.md` under `[Unreleased]` for user-facing UI, Docker/env, and automation-output changes.
- `.agents/rules/data-sources.md` if the supported data-source/output-target rules change.
- `.agents/rules/docker.md` if broker deployment becomes part of supported Docker topology.

Security-sensitive decisions to make before implementation:

- Whether local broker supports anonymous LAN access in V1.
- Whether username/password is required for broker connections.
- Whether MQTT over TLS is explicitly deferred.
- Whether retained MQTT messages are allowed.
- Whether HTTP output targets need stricter URL restrictions than HTTP input sources.

## Implementation Phases

### Phase 1: UI Model And Documentation

Status: Implemented.

- Add direct `Add input source` and `Add output target` actions.
- Keep existing input/output device behavior unchanged.
- Add the Local services area with an informational broker card if backend broker status is not implemented yet.

### Phase 2: Output Target Expansion

Status: Implemented for HTTP/API JSON requests and MQTT JSON publishes.

- Add `http-output` and `mqtt-output` types.
- Generalize `control_output` validation and execution.
- Add output test actions.

### Phase 3: Local MQTT Broker

Status: Implemented as an optional Docker Compose `mqtt` profile with anonymous Mosquitto for trusted local networks.

- Add optional Mosquitto service support.
- Add broker status/capability API data.
- Wire broker URL display and MQTT template prefill.
- Update install, README, and security docs.

## Verification For Implementation

For implementation PRs, run:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

For container-impacting broker changes, also run:

```bash
docker compose build
```

For installer changes, also run:

```bash
bash -n install.sh
bash -n bin/integritas-pi
```

Manual checks for the completed feature:

- Add an HTTP/API output target and trigger it from a workflow.
- Add an MQTT output target and publish JSON from a workflow.
- Add an MQTT input source using the local broker and trigger a workflow from a published message.
- Confirm external-device instructions show the LAN URL, not the Docker-only `mqtt://mqtt:1883` URL.
- Confirm the broker is not listed as a configured device.
- Confirm GPIO output test pulse still works.
