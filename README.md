# Integritas Pi

Integritas Pi is a learning prototype for a Raspberry Pi application that can be installed with one command, started with Docker Compose, and opened from a browser on the local network.

The current prototype contains:

- A GitHub-based installer: `install.sh`
- A Docker Compose application
- A React frontend on port `8080`
- A TypeScript/Express backend
- A Minima node container
- Integritas stamping and verification proxy endpoints
- Data source read history with links to automated Integritas stamps
- SQLite persistence for local settings
- Read-only file browsing for a configured host directory
- A simple architecture that can grow with more services later

## Installation On Raspberry Pi

Run:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo bash
```

To install from a branch before it is merged to `main`, pass `APP_BRANCH`:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo env APP_BRANCH=<branch-name> bash
```

To enable Raspberry Pi GPIO input sources during install, pass `ENABLE_GPIO=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo env ENABLE_GPIO=true bash
```

`ENABLE_GPIO=true` writes `/opt/integritas-pi/docker-compose.override.yml` with `/dev/gpiochip0` mounted into the backend container and detects the host GPIO group id. Leave it disabled unless this deployment needs GPIO hardware ingestion.

To enable Raspberry Pi camera capture devices during install, pass `ENABLE_CAMERA=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo env ENABLE_CAMERA=true bash
```

`ENABLE_CAMERA=true` installs and starts a host-side `integritas-pi-camera-helper` systemd service, generates a `CAMERA_HELPER_TOKEN`, and writes backend configuration so the Docker backend can call the helper through the fixed Integritas Pi Compose gateway. Leave it disabled unless this deployment needs camera capture workflows.

`ENABLE_CAMERA=true` does not install host camera drivers or enable the Raspberry Pi camera stack. Before using camera workflows, verify the Pi host can see the camera with `libcamera-still --list-cameras` or `rpicam-still --list-cameras`. Camera Module 3 (`imx708`) requires a host OS/kernel/libcamera stack that supports it. The helper uses the host camera tools, not camera binaries inside the backend container.

To enable the optional local MQTT broker during install, pass `ENABLE_MQTT_BROKER=true`:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo env ENABLE_MQTT_BROKER=true bash
```

The broker is exposed on `${MQTT_PUBLIC_PORT:-1883}` for trusted LAN devices and is available to backend containers as `mqtt://mqtt:1883`. It is disabled by default.

The installer will:

- Check that it runs as root or through `sudo`
- Check that the machine is Linux
- Warn if the architecture does not look like Raspberry Pi/ARM
- Install required host packages
- Install Docker if Docker is missing
- Verify Docker Compose
- Clone this repository to `/opt/integritas-pi`
- Write `/opt/integritas-pi/.env`
- Generate a self-signed TLS certificate in `DATA_DIR/certs`
- Start the app with `docker compose up -d --build`

Open the UI at:

```txt
https://<pi-ip>:8080
```

Or locally on the Pi:

```txt
https://localhost:8080
```

Your browser will warn about the self-signed certificate. That is expected — choose Advanced / Continue. Traffic is encrypted after that.

## Configuration

Runtime configuration is stored in `.env`:

```env
HOST_FILES_DIR=/home/pi
FRONTEND_PORT=8080
DATA_DIR=./data
APP_SECRET=dev-change-me
DOCKER_GID=0
ENABLE_GPIO=false
GPIO_GID=0
ENABLE_CAMERA=false
CAMERA_CAPTURE_DIR=/data/captures
CAMERA_HELPER_URL=http://172.30.0.1:38180
CAMERA_HELPER_TOKEN=
CAMERA_HELPER_PORT=38180
CAMERA_MAX_DURATION_SECONDS=30
CAMERA_RETENTION_DAYS=7
CAMERA_PHOTO_COMMAND=rpicam-still
CAMERA_VIDEO_COMMAND=rpicam-vid
INTEGRITAS_DOCKER_SUBNET=172.30.0.0/24
INTEGRITAS_DOCKER_GATEWAY=172.30.0.1
ENABLE_MQTT_BROKER=false
COMPOSE_PROFILES=
MQTT_PUBLIC_HOST=
MQTT_PUBLIC_PORT=1883
MQTT_INTERNAL_URL=mqtt://mqtt:1883
MINIMA_DATA_DIR=./minima
MINIMA_BACKUP_DIR=./minima-backup
MINIMA_P2P_PORT=9003
MINIMA_RPC_BIND=127.0.0.1
MINIMA_RPC_PORT=9005
MINIMA_HEALTH_POLL_INTERVAL_SECONDS=60
MINIMA_STALL_BLOCK_AGE_SECONDS=300
MINIMA_AUTO_RESYNC=false
MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES=30
INTEGRITAS_CONNECT_BASE_URL=https://integritas.technology
INTEGRITAS_BASE_URL=https://integritas.technology/core
INTEGRITAS_REQUEST_ID=integritas-pi
INTEGRITAS_REQUEST_TIMEOUT_MS=15000
INTEGRITAS_POLL_INTERVAL_SECONDS=30
INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES=5
INTEGRITAS_DEVICE_POLL_INTERVAL_SECONDS=5
INTEGRITAS_PORTAL_URL=
COOKIE_SECURE=true
SESSION_MAX_AGE_DAYS=7
SESSION_IDLE_HOURS=24
MANIFEST_URL=
RELEASE_CHANNEL=stable
UPDATE_HEALTH_CHECK_TIMEOUT_MS=60000
UPDATE_HEALTH_CHECK_INTERVAL_MS=2000
UPDATE_PULL_TIMEOUT_MS=300000
UPDATE_AGENT_STATE_DIR=./update-agent-state
```

The installer sets `COOKIE_SECURE=true` for the default HTTPS Docker deploy. Use `COOKIE_SECURE=false` only for native `npm run dev` (HTTP on port 5173).

`HOST_FILES_DIR` is mounted into the backend container as `/host-files:ro`. The `:ro` flag is intentional for this prototype.

`MINIMA_DATA_DIR` is mounted into the Minima container as `/home/minima/data` so node data survives container restarts and updates. `MINIMA_BACKUP_DIR` is a separate host path `update-agent` copies that data into before a Minima update, and restores from if the update fails its health check. `UPDATE_AGENT_STATE_DIR` persists `update-agent`'s own bookkeeping (currently just the last successfully applied manifest's timestamp, used to reject replayed or downgraded manifests) across container restarts.

`MINIMA_RPC_BIND` defaults to `127.0.0.1`, which means Minima RPC is only exposed on the Pi itself. Set it to `0.0.0.0` only on a trusted network.

The backend runs a Minima health poller on `MINIMA_HEALTH_POLL_INTERVAL_SECONDS` (default 60s). It detects chain stalls when the last block age exceeds `MINIMA_STALL_BLOCK_AGE_SECONDS` (default 300s) while the node is running. Optional auto-resync is **off by default**; set `MINIMA_AUTO_RESYNC=true` to allow the poller to call Megammr resync (see `SECURITY.md`).

`DATA_DIR` is mounted into the backend container as `/data` and stores the SQLite database.

`APP_SECRET` is used by the backend to encrypt local secrets before storing them in SQLite. The installer generates this automatically and preserves it on updates. If it changes, previously encrypted secrets cannot be decrypted.

`DOCKER_GID` lets the non-root backend user read Docker status through `/var/run/docker.sock`. The installer detects this automatically from the socket group id.

`ENABLE_GPIO=true` lets the installer create a Docker Compose override that mounts `/dev/gpiochip0` for GPIO input sources. `GPIO_GID` is detected from `/dev/gpiochip0` or the host `gpio` group when possible. GPIO stays disabled by default because it grants the backend container host hardware access.

When GPIO is not enabled or `/dev/gpiochip0` is unavailable in the backend container, the GPIO Input card is disabled in the Data Sources page.

GPIO input/output settings for tested button and LED wiring, plus suggested untested device profiles, are documented in [`docs/guides/gpio-device-settings.md`](./docs/guides/gpio-device-settings.md).

`ENABLE_CAMERA=true` lets the installer create a host-side Python camera helper service. The Devices page enables the Pi Camera capture device type only when the helper reports usable host camera commands and at least one detected camera. Camera support stays disabled by default because it grants the app a way to trigger host camera capture and captured images/video may contain private data.

Pi Camera devices are capture/input devices, not generic output targets. Automation workflows use a `Capture camera` data block to capture a photo or short video clip, hash the captured media bytes, store capture metadata in read history, and optionally attach `Stamp data` to create an Integritas proof for the media hash. Captured media is stored locally under `CAMERA_CAPTURE_DIR` (`/data/captures` in Docker, mapped to the host data directory for the helper). `CAMERA_MAX_DURATION_SECONDS` limits per-capture video duration. `CAMERA_PHOTO_COMMAND` and `CAMERA_VIDEO_COMMAND` default to `rpicam-still` and `rpicam-vid`; the Python helper also falls back to `libcamera-still` and `libcamera-vid`. `INTEGRITAS_DOCKER_SUBNET` and `INTEGRITAS_DOCKER_GATEWAY` pin the Compose network so the backend has a stable route to the host helper after reboot/redeploy. The helper uses only Python's standard library and is intended as the extension point for future USB/RTSP/HTTP camera backends.

`INTEGRITAS_CONNECT_BASE_URL` is the Integritas Connect host used for device activation and account linking (default `https://integritas.technology`).

`INTEGRITAS_BASE_URL` is the Integritas core host used for proof stamping (default `https://integritas.technology/core`).

Proof stamping uses the Integritas Connect account API key stored encrypted in `integritas_auth.api_key_enc` after device linking. Link Integritas Connect from Auth Settings or during first-run setup. API keys are never exposed in the frontend bundle.

`INTEGRITAS_DEVICE_POLL_INTERVAL_SECONDS` is how often the Pi polls Connect while device activation is pending (default `5`).
`ENABLE_MQTT_BROKER=true` enables the optional local Mosquitto broker when `COMPOSE_PROFILES=mqtt` is also set. The installer sets both values when launched with `ENABLE_MQTT_BROKER=true`. The Devices page shows the LAN broker URL for external devices and the internal Docker URL for Integritas Pi MQTT input/output configs.

The backend polls Integritas for pending proof UIDs in the background (`INTEGRITAS_POLL_INTERVAL_SECONDS`, default 30). Pending proofs that never reach on-chain status are marked failed after `INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES` (default 5). Automation workflows retry Integritas stamps on the next run after transient upstream errors. Manual poll in Diagnostics still works and uses the same refresh logic.

On the Integritas page, stamping a file opens a result modal with proof UID, hash, and on-chain status (with optional live status refresh). The Configure Integritas modal links to the cloud portal API logs tab (`INTEGRITAS_PORTAL_URL`, default `https://integritas.technology/profile?tab=apilogs`).

The Minima page also stores its Megammr host URL in SQLite through the Configure Minima modal. If no value has been saved, it defaults to `megammr.minima.global:9001`.

The Minima page exposes an allowlisted Megammr resync action. The browser calls the backend, and the backend calls Minima RPC internally with `megammrsync action:resync host:<configured-megammr-host>`.

The Wallet page exposes allowlisted wallet/account actions through the backend:

- global balance via Minima `balance` (`GET /api/wallet`)
- labeled accounts mapped to the node's 64-address pool (`GET/POST /api/wallet/accounts`)
- per-account holdings via Minima `coins relevant:true`
- send history in SQLite (`GET /api/wallet/history`)
- payment submission via Minima `send` (`POST /api/wallet/send-payment`)
- seed phrase import via Minima `restore` (`POST /api/wallet/import`)

`POST /api/wallet/accounts` with `{ label }` creates a named account on a random default address. With `{ label, address }` it labels an existing funded address (migration/recovery). This does not create new seed material.

`GET /api/wallet/accounts` returns labeled accounts with per-address MINIMA/token balances plus `unlabeledFunded` addresses that have funds but no label yet.

Dev-only debug routes (`POST /api/wallet/debug/clear-wallet-accounts`, `clear-wallet-history`) clear SQLite wallet tables for local testing; they return 403 when `NODE_ENV=production`.

Minima RPC commands should be transmitted as a single percent-encoded URL path command, not as query parameters. For example:

```txt
http://minima:9005/megammrsync%20action%3Aresync%20host%3Amegammr.minima.global%3A9001
```

`COOKIE_SECURE` controls the session cookie `Secure` flag. The Docker deploy uses HTTPS with `COOKIE_SECURE=true` (`https://<pi-ip>:8080`). Native dev uses HTTP on `http://localhost:5173` with `COOKIE_SECURE=false`.

TLS certificates are stored in `DATA_DIR/certs` (`server.crt`, `server.key`). The installer generates them automatically. To regenerate after a Pi IP change:

```bash
cd /opt/integritas-pi
INTEGRITAS_TLS_FORCE=1 bash scripts/generate-tls-cert.sh
docker compose up -d --build frontend
```

Future versions may support custom certificates or an external reverse proxy.

`SESSION_MAX_AGE_DAYS` and `SESSION_IDLE_HOURS` control session lifetime (default 7 days max, 24 hours idle).

`MANIFEST_URL` configures the `update-agent` service: the signed update manifest URL hosted on the VPS. The Ed25519 public key used to verify its signature is baked into the `update-agent` image at build time from the committed `update-agent/manifest-public-key.pem`, not an env var. Leave `MANIFEST_URL` empty to disable update checks. The update UI is served at `https://<pi-ip>:8080/update` (same TLS cert/origin as the main app, proxied through `frontend`'s nginx — no extra browser approval). See [.agents/rules/update-agent.md](.agents/rules/update-agent.md) for the full design.

`frontend`/`backend` are `build:`-based in `docker-compose.yml`, not pinned to a digest — re-running `install.sh` (or a bare `docker compose up -d --build`) rebuilds them from this checkout's source and silently reverts any updates applied via the Update page since. `git pull` the matching release tag first if you want to keep an update, or just use the Update page instead of re-running the installer on an already-updated device.

To install with another file root or port:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo HOST_FILES_DIR=/home/pi/Documents FRONTEND_PORT=8081 bash
```

## Local Development

Copy the example environment file:

```bash
cp .env.example .env
```

For local development on a non-Pi machine, change `HOST_FILES_DIR` to a directory that exists on your machine.

### Native frontend + backend (fast iteration)

Use this when you want to change UI or API code without rebuilding Docker images.

Start both servers from the repo root:

```bash
npm install
npm run dev
```

That runs the backend API on port 3000 and the Vite dev server on port 5173 (which proxies `/api` to the backend). You can also run them separately with `npm run dev:backend` and `npm run dev:frontend` in two terminals.

Open:

```txt
http://localhost:5173
```

### HTTPS dev (matches Docker self-signed behavior)

To test secure cookies and HTTPS-only browser APIs during native dev:

```bash
npm run dev:https
```

Open `https://localhost:5173` and accept the self-signed certificate warning (same certs as `scripts/generate-tls-cert.sh` / Docker). The backend runs with `COOKIE_SECURE=true`.

Plain `npm run dev` stays on HTTP for fast iteration.

The backend loads the repo-root `.env` automatically in dev. `DATABASE_PATH`, `DATA_DIR`, and `HOST_FILES_DIR` are resolved relative to the repo root.

Frontend styling direction: component and page styling should use Tailwind utilities. Existing component-level CSS is being migrated to Tailwind as a dedicated cleanup effort; after migration, plain CSS should be limited to root/body/base global rules only.

Transient frontend errors should use the shared toast system (`ToastProvider` / `useToast`) instead of duplicating inline messages across modals and pages. Keep inline errors for form validation, row-level status, and persistent context-specific details.

Optional: run Minima in Docker while developing natively:

```bash
docker compose up -d minima
```

Without Minima, the rest of the app still works; the status overview will report Minima as unavailable.

### Full stack in Docker

Generate a TLS certificate (once per machine, or after a LAN IP change):

```bash
bash scripts/generate-tls-cert.sh
```

Start everything:

```bash
docker compose up -d --build
```

Open:

```txt
https://localhost:8080
```

Accept the browser warning for the self-signed certificate.

View logs:

```bash
docker compose logs -f
```

## Authentication

On first launch with an empty database, Edge Workbench shows a setup wizard:

1. Choose a local admin credential: a 6-digit PIN or a password with at least 8 characters, including uppercase, lowercase, a number, and a symbol
2. Create or connect the Integritas Connect account used for plan and proof usage
3. Review the connected account and finish setup

After setup, sign in with the chosen PIN or password. You can switch credential types later in Account settings. There is a single local admin account (no username to enter), and only its bcrypt hash is stored. Sessions persist across browser reloads until logout or expiry.

TOTP is temporarily disabled through `TOTP_ENABLED = false` in the backend and frontend auth constants.

Public API routes (no session required):

- `GET /api/health`
- `GET /api/setup/status`
- `POST /api/setup/*`
- `POST /api/auth/login`

All other `/api/*` routes require a valid session cookie.

## Feedback Export

Authenticated users can open the Feedback modal from the app shell sidebar. Feedback is saved locally on the Pi as one aggregate JSON file:

```txt
DATA_DIR/feedback/feedback-submissions.json
```

In the default Docker deploy this is inside the backend container at `/data/feedback/feedback-submissions.json` and on the host under the configured `DATA_DIR`.

After submitting feedback, the modal offers a download action for the same aggregate JSON file so the user can send it manually. The export includes the current page, feedback area, feedback type, optional bug/feature details, description, browser context, non-secret app/user/device metadata, and lightweight app stats. It must not include passwords, TOTP secrets, session cookies, Integritas API keys, wallet seed phrases, or raw encrypted secret values.

The CLI does not send session cookies in V1. Operational CLI commands that call protected APIs return `401 Unauthorized` until a future CLI auth story is added. Use the browser UI for authenticated operations.

## CLI

The browser UI and CLI both call the same backend API. The backend does not run arbitrary shell commands, and the CLI does not duplicate business logic.

After installation, the CLI is available on the Pi as:

```bash
integritas-pi --help
```

Operational V1 commands:

```bash
integritas-pi status
integritas-pi doctor
integritas-pi logs backend
integritas-pi data-sources list
integritas-pi data-sources read <id>
integritas-pi automation list
integritas-pi automation run <id>
integritas-pi automation pause <id>
integritas-pi automation enable <id>
integritas-pi integritas history
```

By default the CLI calls:

```txt
https://localhost:8080/api
```

Override it when calling a remote Pi:

```bash
INTEGRITAS_PI_API_URL=https://<pi-ip>:8080/api integritas-pi status
```

The CLI uses `curl -k` because the default deploy uses a self-signed certificate.

Run checks before pushing or installing on a Pi:

```bash
npm run check
docker compose build --no-cache
```

`npm run check` runs backend and frontend TypeScript checks plus moderate-level npm audits. `docker compose build --no-cache` catches Docker build issues from a clean image context.

## Troubleshooting

If the UI shows `Backend health error: HTTP 502`, check backend logs:

```bash
sudo docker compose -f /opt/integritas-pi/docker-compose.yml --project-directory /opt/integritas-pi logs --tail=100 backend
```

If logs contain `SqliteError: unable to open database file`, fix the SQLite data directory permissions:

```bash
sudo mkdir -p /opt/integritas-pi/data
sudo chown -R 1000:1000 /opt/integritas-pi/data
sudo chmod 700 /opt/integritas-pi/data
sudo docker compose -f /opt/integritas-pi/docker-compose.yml --project-directory /opt/integritas-pi restart backend
```

The backend container runs as the non-root `node` user, which uses uid `1000`. That user must be able to write to the mounted SQLite data directory.

## Stop The App

On the Pi:

```bash
cd /opt/integritas-pi
docker compose down
```

## Update The App

Run the installer again:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo bash
```

The installer preserves the existing `.env` file, SQLite data directory, and Minima data directory, then pulls the latest repository contents and recreates the containers.

You can override the branch:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo APP_BRANCH=main bash
```

## Architecture

```txt
Browser
  |
  | https://<pi-ip>:8080
  v
frontend container
  - React static app
  - Nginx
  - Proxies /api to backend:3000
  - Sidebar pages: App status, Minima, Integritas, File explorer
  |
  v
backend container
  - Express + TypeScript
  - SQLite database at /data/integritas-pi.db
  - GET /api/health
  - GET /api/status/overview
  - GET /api/files
  - GET /api/minima/status
- Integritas hash, stamp, status, verify endpoints
- Device APIs and historic read log at `/api/data-sources` and `/api/data-reads`
  - Input sources can include an optional health status URL. The browser polls saved health URLs once per minute through the backend and shows the latest status in the configured devices table.
  - Device protocols currently include HTTP JSON API fetches, webhook JSON receives, MQTT JSON subscriptions, Raspberry Pi GPIO input events, and Raspberry Pi GPIO LED output targets. Devices define connection details; Automation workflows decide whether reads are recorded, outputs are controlled, and hashes are stamped. GPIO LED output targets can also be test-pulsed from the Devices page before adding them to a workflow.
  - Automation workflows are block-based. Start blocks trigger ordered action blocks; logic blocks can stop the remaining flow when selected trigger or data fields do not match; Integritas stamping is attached as a side block to record/fetch data blocks so it stamps that block's hash without becoming the final step in the main flow. Attached stamp blocks can also have their own field condition against the trigger event or recorded/fetched data. New workflow creation uses a Scratch-inspired draft workspace with a clean Start/Data/Logic/Action block library, a visual block-chain canvas, setup inspector, and backend-powered inline validation. The draft starts empty, requires one start block first, hides start blocks after selection, and uses Reset canvas when the operator wants a different trigger. Create/edit/watch workspaces are URL-driven (`/automation?flow=build`, `/automation?flow=edit&id=...`, `/automation?flow=watch&id=...`) and render in the page rather than opening workflow editing in a modal. Build, Edit, and Watch share one workspace shell and normalized canvas renderer. Canvas blocks show validation error/warning badges in Build/Edit and selected run status/duration in Watch. Edit mode shares the builder shell, categorized block library, selected-block inspector pattern, workflow name editing, and right-side validation placement; Watch mode owns run controls, test payload execution, selected-block runtime output/error/timing, read/proof Diagnostics links, and a historic run picker that visualizes selected runs on the canvas. Draft action blocks include Pulse output and Send transaction; Integritas stamps attach as side blocks on Record/Fetch data blocks. Templates are intentionally deferred until the basic block building experience is complete. Block edits are saved per block with visible unsaved/saved feedback; add/remove/move/pause/enable actions apply immediately. Workflow validation flags broken block chains, missing devices, output/transaction risks, and missing Integritas key setup before manual runs; validation errors block `Run now` / `Run with payload`, while warnings stay visible for operator review. Workflow logs show the run trigger plus block outputs, and fetch/record blocks link their stored read preview so operators can see the JSON that conditions evaluated. Workflow lists support search, status filters, duplicate, archive, restore, and delete; archived workflows do not run automatically or manually until restored. Automation can also send native MINIMA (`0x00`) transactions to saved address book recipients through an allowlisted Send transaction block. Prototype workflows created with older equals-only condition configs should be recreated.
  - HTTP Collect data rules poll on a schedule. Webhook Collect data rules record pushed JSON at generated `/api/data-source-webhooks/:token` URLs while enabled. MQTT Collect data rules subscribe to the configured broker/topic only while enabled. GPIO Collect data rules watch configured BCM pins only while enabled.
  - Reads /host-files only
  - Reads Minima status from http://minima:9005/status
  - Calls https://integritas.technology/core with the backend-only Connect API key
  - Reads Docker resource usage through /var/run/docker.sock

minima container
  - minimaglobal/minima:dev
  - P2P port ${MINIMA_P2P_PORT:-9003}
  - RPC port ${MINIMA_RPC_PORT:-9005}
  - Persistent data in ${MINIMA_DATA_DIR:-./minima}
  |
  v
Pi host filesystem
  - ${HOST_FILES_DIR:-/home/pi} mounted read-only
  - ./data mounted read-write for SQLite
  - ./minima mounted read-write for Minima data
```

The backend never receives permission to run arbitrary shell commands. It only lists files and directories under `/host-files`.

## Backend API

Health:

```http
GET /api/health
GET /api/status/overview
```

Feedback:

```http
POST /api/feedback
GET /api/feedback/export
```

`POST /api/feedback` appends a submission to the local aggregate JSON feedback export. `GET /api/feedback/export` downloads that file as `feedback-submissions.json`. Both routes require an authenticated browser session.

`/api/status/overview` returns status for the frontend, backend, Minima node, and Integritas API, plus Docker container CPU/memory/image-size data when the Docker socket is available.

Files:

```http
GET /api/files
GET /api/files?path=/Documents
```

Example response:

```json
{
  "path": "/Documents",
  "items": [
    {
      "name": "test.txt",
      "type": "file",
      "size": 1234
    },
    {
      "name": "Pictures",
      "type": "directory"
    }
  ]
}
```

Path traversal attempts such as `../../etc/passwd` are blocked because the backend resolves the requested path and verifies that it remains inside `/host-files`.

Minima status:

```http
GET /api/minima/status
```

The backend combines Minima RPC (`http://minima:9005/status`, optional `peers`), Docker container stats for the `minima` service, and saved Megammr config into a normalized JSON response (`state`, `sync`, `health`, `container`, `storage`). Returns HTTP `200` when the check completed, even if the node is stopped or unhealthy; `502` is reserved for handler failures.

Example fields:

```json
{
  "checkedAt": "2026-06-11T12:00:00.000Z",
  "state": "running",
  "sync": { "status": "active", "block": 932067, "blockAgeSeconds": 45 },
  "health": { "peerCount": 12 },
  "container": {
    "state": "running",
    "cpuPercent": 2.5,
    "memory": { "usage": "512 MB", "limit": "4 GB" }
  },
  "monitoring": { "stallDetected": false, "autoResyncEnabled": false }
}
```

The frontend reads `/api/minima/status`, so the browser does not need direct access to Minima RPC.

Minima restart and peers (admin mutations require an admin session):

```http
POST /api/minima/restart
GET /api/minima/peers
POST /api/minima/peers/add
```

`POST /api/minima/restart` restarts the Minima Docker container via the backend Docker socket (see `SECURITY.md`). `POST /api/minima/peers/add` accepts `{ "peerslist": "host:port" }` or comma-separated addresses and calls Minima `peers action:addpeers`.

Wallet and account APIs:

```http
GET /api/wallet
GET /api/wallet/accounts
POST /api/wallet/accounts
GET /api/wallet/history
POST /api/wallet/send-payment
GET /api/wallet/payment-status/:txpowid
POST /api/wallet/import
POST /api/wallet/receive-address
```

`POST /api/wallet/accounts` creates a named account label and maps it to one random default address from the node's existing 64-address wallet pool, or labels an existing address when `address` is provided. This does not create new seed material.

`GET /api/wallet/accounts` returns the mapped accounts plus per-address MINIMA/token balances aggregated from Minima `coins relevant:true`, and `unlabeledFunded` for migration.

`GET /api/wallet/history?limit=N` returns recent send activity recorded in SQLite when payments are submitted.

`POST /api/wallet/receive-address` samples a random address from the 64-address pool (API retained; primary UI shows per-account addresses in the account detail modal).

Custom token APIs:

```http
GET /api/tokens
GET /api/tokens/create-requirements
POST /api/tokens/create
```

`GET /api/tokens` returns non-native token balances from Minima `balance`, enriched with local metadata when the token was created on this Pi (`custom_tokens` in SQLite). `POST /api/tokens/create` (admin) calls Minima `tokencreate` with `{ name, amount, decimal, fromAccountAddress }` where `fromAccountAddress` must be a **labeled** wallet account with at least `0.001` MINIMA on its address. `GET /api/tokens/create-requirements` returns cost estimates. Wallet list/send APIs are unchanged.

Integritas:

```http
GET /api/integritas/config
POST /api/integritas/hash
POST /api/integritas/stamp
POST /api/integritas/status
POST /api/integritas/verify
```

Integritas Connect (device linking):

```http
POST /api/auth/connect/start
GET /api/auth/connect/status
GET /api/user/profile
```

The frontend sends canonical bytes and proof payloads to the backend. The backend performs SHA3-256 hashing and calls Integritas with the Connect-linked API key from `integritas_auth.api_key_enc`.

The backend uses the first available source in that order. Install with a fallback Integritas API key:

```bash
curl -fsSL https://raw.githubusercontent.com/integritas-technology/integritas-pi/main/install.sh | sudo INTEGRITAS_API_KEY=your-api-key bash
```

For the preferred prototype UX, install without a key and then enter it in the Integritas page in the browser.

## Security Notes

This is a learning prototype, not a production-ready product.

See [`SECURITY.md`](./SECURITY.md) for the current risk register, known vulnerabilities, and mitigation plan.

- Backend container runs as the non-root `node` user
- Host files are mounted read-only
- Backend blocks access outside `/host-files`
- Frontend cannot trigger shell commands
- Minima RPC binds to `127.0.0.1` by default
- Integritas Connect tokens and API key are backend-only and encrypted at rest in SQLite
- Backend mounts `/var/run/docker.sock:ro` to read container status and resource usage for the App status page. This is useful for the prototype, but Docker socket access is sensitive and should be replaced with a narrower monitoring approach before production.
- GPIO input sources use the `gpiomon` tool inside the backend container and GPIO LED output targets use `gpioset`; both require explicit GPIO device access on Raspberry Pi deployments. Add an override such as `devices: ["/dev/gpiochip0:/dev/gpiochip0"]` and a suitable GPIO group when enabling GPIO hardware ingestion/control.
- Admin authentication with a 6-digit PIN or an 8+ character password containing uppercase, lowercase, a number, and a symbol, plus HttpOnly session cookies (see [Authentication](#authentication))
- HTTPS with a self-signed certificate on the default Docker deploy (`COOKIE_SECURE=true`)

## Future Services

The Docker Compose file is intentionally simple so more services can be added later, for example:

- Database
- File storage
- CLI session or API token auth
- System commands through an allowlist
- Auto updates

When new services require host packages, add them to the dependency section in `install.sh`.
