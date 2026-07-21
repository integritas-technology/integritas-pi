# Data Source And Automation Risks

Related: [SECURITY.md](../../SECURITY.md) · [qa/gaps.md](../qa/gaps.md)

## Minima RPC Exposure

Risk: Minima RPC can perform sensitive node operations depending on enabled commands. It is bound to `127.0.0.1` on the host by default but reachable from backend over Docker networking.

Impact: If backend is compromised, attacker can call Minima RPC from inside the Docker network.

Current Controls:

- Backend exposes narrow allowlisted Minima actions instead of a generic Minima command proxy.
- The Megammr resync action always calls the configured Minima RPC endpoint over the Docker network and only passes the saved Megammr host value.
- The wallet balance action only calls the Minima `balance` command and returns its response through the backend.

Plan:

- Keep host RPC bind as `127.0.0.1` by default.
- Add backend allowlist for any future Minima commands exposed through UI.
- Add auth before exposing Minima actions.
- Review Minima RPC auth/options before production.

Status: Partially mitigated by host-local bind and no arbitrary command proxy.

## Minima Auto-Resync (optional)

Risk: When `MINIMA_AUTO_RESYNC=true`, the backend health poller can trigger Megammr resync without an operator click if the chain appears stalled (block age above `MINIMA_STALL_BLOCK_AGE_SECONDS` while the node is running). Minima may respond that a container restart is required afterward.

Impact: Unexpected resync traffic, temporary Minima RPC unavailability (same as manual resync), and possible operator surprise on a production Pi.

Current Controls:

- **Disabled by default** (`MINIMA_AUTO_RESYNC=false`).
- Cooldown between auto-resync attempts (`MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES`, default 30).
- Poller logs stall detection and auto-resync actions; `GET /api/minima/status` exposes `monitoring.stallDetected`, `lastAutoResyncAt`, and related fields.
- Manual resync remains available in the UI; auto-resync reuses the same allowlisted `resyncMegammr()` path.

Status: Documented prototype tradeoff. Review before enabling on production nodes.

## Minima Container Restart (admin)

Risk: `POST /api/minima/restart` restarts the Minima Docker container. RPC and wallet operations are unavailable until the container is healthy again.

Impact: Brief node outage; if abused, repeated restarts could disrupt stamping/wallet workflows on the Pi.

Current Controls:

- Admin session required (`requireRole('admin')`).
- Audit event `minima.container.restart` with container id.
- UI confirms before restart; status polling pauses during restart.

Status: Documented prototype tradeoff.

## Minima Peer Management (admin add)

Risk: `POST /api/minima/peers/add` calls the allowlisted Minima RPC `peers action:addpeers peerslist:<host:port>`.

Impact: Misconfigured peer addresses could affect P2P connectivity; comma-separated input is validated for basic `host:port` shape only.

Current Controls:

- Admin session required.
- Audit event `minima.peers.add` with the submitted peerslist (not secrets).
- `GET /api/minima/peers` is read-only and available to any authenticated session.

Status: Documented prototype tradeoff.

## Data Source URL Fetching

Risk: Saved data source URLs and optional health status URLs are fetched by the backend. In this prototype, an admin can configure URLs that cause the backend to make outbound or Docker-network HTTP requests.

Impact: Misconfigured or malicious URLs could probe internal services, create repeated outbound traffic, or expose upstream response details in the UI.

Current Controls:

- URLs must be saved on a data source before the health poll endpoint will fetch them.
- Data-source mutation routes require admin role.
- Health status polling is narrow and read-only, and the frontend polls saved health URLs once per minute.

Plan:

- Add URL allowlists or network egress policy for production.
- Consider per-source health polling controls and rate limits.

Status: Accepted prototype risk.

## Public Data Source Webhooks

Risk: Webhook data sources expose generated public receive URLs under `/api/data-source-webhooks/:token` so external systems can POST JSON without a browser session.

TLS note: The default Docker deploy serves webhook URLs through the same self-signed HTTPS endpoint as the UI, for example `https://<pi-ip>:8080/api/data-source-webhooks/:token`. Webhook senders must use `https://` on this port. Plain `http://` requests to the HTTPS port fail with nginx's "plain HTTP request was sent to HTTPS port" error. Because the certificate is self-signed, some webhook senders will reject it unless they explicitly trust the Pi certificate or allow self-signed certificates for local prototype testing.

Impact: Anyone with a webhook URL can submit JSON to that source. If an automation workflow is enabled for the source, submitted JSON can update its latest preview/hash and create read-history rows.

Current Controls:

- Webhook receive URLs include a generated UUID token stored in the data source config.
- Webhook URLs are per source and are not generic command execution endpoints.
- Webhook sources accept JSON only through the existing Express JSON parser.
- Admin authentication is still required to create, edit, list, or delete webhook sources.
- Incoming webhook payloads are recorded only when the source has an enabled automation workflow; otherwise the endpoint returns a disabled-ingestion error.
- HTTPS encrypts webhook payload transport by default, but self-signed certificate trust must be handled by the sending system.

Plan:

- Add optional webhook secret headers/signatures and rate limiting before production use.
- Add optional event retention limits if webhook volume grows.
- Add custom/trusted certificate support or documented reverse-proxy TLS for senders that cannot accept self-signed certificates.

Status: Accepted prototype risk.

## MQTT Data Sources

Risk: Enabled MQTT automation workflows cause the backend to open persistent connections to configured broker URLs and subscribe to configured topics.

Impact: Misconfigured or malicious broker URLs/topics could create unwanted outbound connections, ingest untrusted JSON, or generate high-volume read history.

Current Controls:

- MQTT source creation/editing requires admin role.
- MQTT subscription requires an enabled automation workflow for the MQTT source.
- MQTT sources are narrow subscriptions, not generic command execution.
- MQTT payloads must parse as JSON before they update source preview/hash.
- MQTT sources are push-only and do not use scheduled polling intervals.

Plan:

- Add broker allowlists, credentials/secrets handling, TLS/certificate options, and per-source rate limits before production use.
- Add payload size/shape controls if MQTT message volume or payload size becomes a concern.

Status: Accepted prototype risk.

## MQTT Output Targets

Risk: MQTT output targets let automation workflows publish JSON messages to configured broker URLs and topics.

Impact: Misconfigured or malicious broker URLs/topics could create unwanted outbound connections, command external devices unexpectedly, or publish sensitive workflow context to a shared broker.

Current Controls:

- MQTT output target creation/editing requires admin role.
- Output actions are allowlisted workflow blocks, not arbitrary shell commands.
- MQTT output publishes JSON only to the saved broker/topic.
- MQTT output payloads are selected per workflow block: custom JSON, workflow context, trigger payload, or latest data.
- Custom output JSON can interpolate per-run workflow variables using `{{variableName}}`; interpolation is data substitution only, not code execution.
- Output payloads must not include raw secrets such as passwords, session cookies, Integritas API keys, or wallet seed phrases.

Plan:

- Add broker allowlists, credentials/secrets handling, TLS/certificate options, and per-target rate limits before production use.
- Add dynamic payload templating with explicit redaction rules if richer payload shaping is needed.

Status: Accepted prototype risk.

## Local MQTT Broker (optional)

Risk: When `ENABLE_MQTT_BROKER=true` and the `mqtt` Compose profile is active, the app starts a local Mosquitto broker exposed on `${MQTT_PUBLIC_PORT:-1883}`. The current prototype broker allows anonymous LAN connections.

Impact: Any device that can reach the broker port on the trusted LAN can publish or subscribe to broker topics. This may expose device messages or allow unintended commands if topic names are known.

Current Controls:

- Disabled by default.
- Requires explicit install/runtime configuration.
- Shown in the Devices page as a local service, not as a workflow target itself.
- Backend MQTT inputs/outputs still require admin-created configured devices with saved broker/topic details.

Plan:

- Add broker username/password support before production use.
- Consider TLS, topic ACLs, and LAN bind controls before production use.
- Document trusted-network-only use clearly in installation guidance.

Status: Accepted prototype risk for local learning deployments only.

## HTTP/API Output Targets

Risk: HTTP/API output targets let automation workflows send JSON requests to configured URLs.

Impact: Misconfigured or malicious URLs could trigger actions on local/network services, create repeated outbound traffic, or expose workflow context to unintended systems.

Current Controls:

- HTTP/API output target creation/editing requires admin role.
- Output actions are allowlisted workflow blocks, not arbitrary shell commands.
- Supported methods are limited to `POST`, `PUT`, and `PATCH`.
- Requests use JSON bodies and bounded timeouts.
- Request bodies are selected per workflow block: custom JSON, workflow context, trigger payload, latest data, or no body.
- Custom output JSON can interpolate per-run workflow variables using `{{variableName}}`; variables may contain untrusted input from triggers or fetched data.

Plan:

- Add URL allowlists or network egress policy for production.
- Add credential/secret handling for headers before exposing custom headers in the UI.
- Add per-target rate limits if automation volume grows.

Status: Accepted prototype risk.

## GPIO Input Data Sources

Risk: Enabled GPIO input automation workflows allow the backend container to watch Raspberry Pi GPIO line events through `gpiomon` when `/dev/gpiochip0` is mounted into the container.

Impact: Misconfigured pins can record incorrect physical events; unsafe wiring can damage the Pi or connected hardware. GPIO device access also expands the backend container's host hardware access.

Current Controls:

- GPIO source creation/editing requires admin role.
- GPIO input sources are separate from GPIO output targets; output control is limited to the LED pulse profile documented below.
- GPIO watchers start only while an enabled automation workflow exists for the source.
- The backend uses fixed `gpiomon` arguments built from validated source config, not arbitrary shell command execution.
- GPIO config uses BCM pin numbering, explicit edge selection, and debounce controls.
- GPIO Docker device access is opt-in through `ENABLE_GPIO=true` in the installer, which writes a Compose override for `/dev/gpiochip0`.

Plan:

- Add clearer hardware availability/status reporting for missing `/dev/gpiochip0`, permission failures, and missing `gpiomon`.
- Add hardware setup documentation for common Pi OS group/device mappings.
- Keep output/control actions separate and high-risk if added later.

Status: Accepted prototype risk. Pi GPIO pins are 3.3V only; use proper level shifting, resistors, and isolation for external or industrial signals.

## GPIO Output Targets

Risk: GPIO output targets let automation workflows drive Raspberry Pi GPIO pins through `gpioset` when `/dev/gpiochip0` is mounted into the backend container.

Impact: Unsafe wiring or incorrect profiles can damage the Pi or connected components. GPIO pins are 3.3V logic and cannot safely drive motors, relays, high-current loads, or 5V signals directly.

Current Controls:

- GPIO output targets require admin role to create/edit/delete.
- V1 exposes only the LED output profile and pulse action.
- Output actions are allowlisted workflow blocks, not arbitrary shell commands.
- GPIO output config uses BCM pin numbering and validates chip/pin shape.
- The backend rejects GPIO output targets that reuse a configured GPIO input/output pin.
- GPIO device access remains opt-in through `ENABLE_GPIO=true` and `/dev/gpiochip0` mounting.

Required wiring baseline: use an LED with a 220-330 ohm resistor in series. Do not connect GPIO pins directly to 5V, motors, relays, mains voltage, or unknown modules.

Status: Accepted prototype risk for local learning hardware only.

## Pi Camera Capture Devices

Risk: Enabled Pi Camera workflows allow the backend container to access Raspberry Pi camera devices and capture photos or short video clips through configured camera commands.

Impact: Captures can contain private images/video. Camera device access expands the backend container's host hardware access, and stored captures can consume disk space if workflows run frequently.

Current Controls:

- Pi Camera device creation/editing requires admin role.
- Camera access is opt-in through `ENABLE_CAMERA=true`; the installer writes a Compose override with detected camera device nodes and `/run/udev:ro`.
- Camera capture is a narrow workflow data block, not arbitrary shell execution or a generic output target.
- Captured media stays local under the configured capture directory; read history stores JSON metadata and the media hash.
- Integritas stamping uses the captured media file hash, not the raw image/video content.
- Automation validation warns that camera workflows may record private images/video.
- Per-capture duration is bounded by `CAMERA_MAX_DURATION_SECONDS`.
- Old capture files are pruned opportunistically before new captures according to `CAMERA_RETENTION_DAYS`.

Plan:

- Add richer camera command/package detection in capability reporting.
- Add optional redaction/preview controls before exposing captured media in the browser UI.

Status: Accepted prototype risk for trusted local deployments only. Do not point cameras at private spaces without consent and clear operator intent.

## Integritas Request Proxy

Risk: Backend proxies stamp/status/verify calls to Integritas using a stored API key.

Impact: API quota/billing misuse, stamping untrusted data, leaking operational details in errors.

Plan:

- Add rate limiting.
- Add request size limits per endpoint.
- Add audit logs for stamping and verification.
- Persist stamp records with document id, hash, proof UID, status, proof, canonicalization, and errors.

Status: Open.
