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

The installer will:

- Check that it runs as root or through `sudo`
- Check that the machine is Linux
- Warn if the architecture does not look like Raspberry Pi/ARM
- Install required host packages
- Install Docker if Docker is missing
- Verify Docker Compose
- Clone this repository to `/opt/integritas-pi`
- Write `/opt/integritas-pi/.env`
- Start the app with `docker compose up -d --build`

Open the UI at:

```txt
http://<pi-ip>:8080
```

Or locally on the Pi:

```txt
http://localhost:8080
```

## Configuration

Runtime configuration is stored in `.env`:

```env
HOST_FILES_DIR=/home/pi
FRONTEND_PORT=8080
DATA_DIR=./data
APP_SECRET=dev-change-me
DOCKER_GID=0
MINIMA_DATA_DIR=./minima
MINIMA_P2P_PORT=9003
MINIMA_RPC_BIND=127.0.0.1
MINIMA_RPC_PORT=9005
MINIMA_HEALTH_POLL_INTERVAL_SECONDS=60
MINIMA_STALL_BLOCK_AGE_SECONDS=300
MINIMA_AUTO_RESYNC=false
MINIMA_AUTO_RESYNC_COOLDOWN_MINUTES=30
INTEGRITAS_BASE_URL=https://integritas.technology/core
INTEGRITAS_API_KEY=
INTEGRITAS_REQUEST_ID=integritas-pi
INTEGRITAS_REQUEST_TIMEOUT_MS=15000
INTEGRITAS_POLL_INTERVAL_SECONDS=30
INTEGRITAS_PROOF_POLL_TIMEOUT_MINUTES=5
INTEGRITAS_PORTAL_URL=
COOKIE_SECURE=false
SESSION_MAX_AGE_DAYS=7
SESSION_IDLE_HOURS=24
```

`HOST_FILES_DIR` is mounted into the backend container as `/host-files:ro`. The `:ro` flag is intentional for this prototype.

`MINIMA_DATA_DIR` is mounted into the Minima container as `/home/minima/data` so node data survives container restarts and updates.

`MINIMA_RPC_BIND` defaults to `127.0.0.1`, which means Minima RPC is only exposed on the Pi itself. Set it to `0.0.0.0` only on a trusted network.

The backend runs a Minima health poller on `MINIMA_HEALTH_POLL_INTERVAL_SECONDS` (default 60s). It detects chain stalls when the last block age exceeds `MINIMA_STALL_BLOCK_AGE_SECONDS` (default 300s) while the node is running. Optional auto-resync is **off by default**; set `MINIMA_AUTO_RESYNC=true` to allow the poller to call Megammr resync (see `SECURITY.md`).

`DATA_DIR` is mounted into the backend container as `/data` and stores the SQLite database.

`APP_SECRET` is used by the backend to encrypt local secrets before storing them in SQLite. The installer generates this automatically and preserves it on updates. If it changes, previously encrypted secrets cannot be decrypted.

`DOCKER_GID` lets the non-root backend user read Docker status through `/var/run/docker.sock`. The installer detects this automatically from the socket group id.

`INTEGRITAS_API_KEY` is optional. You can leave it empty and save the API key from the Integritas page in the UI. The key is sent to the backend once, encrypted, and stored in SQLite. It is never exposed in the frontend bundle.

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

`COOKIE_SECURE` controls the session cookie `Secure` flag. Leave `false` for the default HTTP LAN deploy (`http://<pi-ip>:8080`). Set `true` when serving the UI over HTTPS.

`SESSION_MAX_AGE_DAYS` and `SESSION_IDLE_HOURS` control session lifetime (default 7 days max, 24 hours idle).

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

The backend loads the repo-root `.env` automatically in dev. `DATABASE_PATH`, `DATA_DIR`, and `HOST_FILES_DIR` are resolved relative to the repo root.

Frontend styling direction: component and page styling should use Tailwind utilities going forward. Plain CSS should be limited to root/body/base global rules, with existing component-level CSS migrated incrementally as frontend files are touched.

Transient frontend errors should use the shared toast system (`ToastProvider` / `useToast`) instead of duplicating inline messages across modals and pages. Keep inline errors for form validation, row-level status, and persistent context-specific details.

Optional: run Minima in Docker while developing natively:

```bash
docker compose up -d minima
```

Without Minima, the rest of the app still works; the status overview will report Minima as unavailable.

### Full stack in Docker

Start everything:

```bash
docker compose up -d --build
```

Open:

```txt
http://localhost:8080
```

View logs:

```bash
docker compose logs -f
```

## Authentication

On first launch with an empty database, Edge Workbench shows a setup wizard:

1. Set the admin password (minimum 8 characters)
2. Scan the TOTP QR code and enter a 6-digit code
3. Optionally verify an Integritas API key (or skip and configure later)
4. Finish setup — you are signed in via an HttpOnly session cookie

After setup, sign in with password and TOTP. There is a single local admin account (no username to enter). Sessions persist across browser reloads until logout or expiry.

Public API routes (no session required):

- `GET /api/health`
- `GET /api/setup/status`
- `POST /api/setup/*`
- `POST /api/auth/login`

All other `/api/*` routes require a valid session cookie.

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
http://localhost:8080/api
```

Override it when calling a remote Pi:

```bash
INTEGRITAS_PI_API_URL=http://<pi-ip>:8080/api integritas-pi status
```

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
  | http://<pi-ip>:8080
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
- Data source APIs and historic read log at `/api/data-sources` and `/api/data-reads`
  - Data sources can include an optional health status URL. The browser polls saved health URLs once per minute through the backend and shows the latest status in the Added data sources table.
  - Data source protocols currently include HTTP JSON API fetches, webhook JSON receives, and MQTT JSON subscriptions. Data Sources define connection details; Automation workflows decide whether reads are recorded and stamped.
  - Automation workflows are rule collections. V1 creates a Collect data rule first, then an optional Integritas stamping rule can be added to stamp collected hashes.
  - HTTP Collect data rules poll on a schedule. Webhook Collect data rules record pushed JSON at generated `/api/data-source-webhooks/:token` URLs while enabled. MQTT Collect data rules subscribe to the configured broker/topic only while enabled.
  - Reads /host-files only
  - Reads Minima status from http://minima:9005/status
  - Calls https://integritas.technology/core with backend-only API key
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
  "container": { "state": "running", "cpuPercent": 2.5, "memory": { "usage": "512 MB", "limit": "4 GB" } },
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
POST /api/tokens/create
```

`GET /api/tokens` returns non-native token balances from Minima `balance`, enriched with local metadata when the token was created on this Pi (`custom_tokens` in SQLite). `POST /api/tokens/create` (admin) calls Minima `tokencreate` with `{ name, amount, decimal, fromAccountAddress }` where `fromAccountAddress` must be a **labeled** wallet account with at least `0.001` MINIMA on its address. `GET /api/tokens/create-requirements` returns cost estimates. Wallet list/send APIs are unchanged.

Integritas:

```http
GET /api/integritas/config
POST /api/integritas/api-key/check
POST /api/integritas/api-key
DELETE /api/integritas/api-key
POST /api/integritas/hash
POST /api/integritas/stamp
POST /api/integritas/status
POST /api/integritas/verify
```

The frontend sends canonical bytes and proof payloads to the backend. The backend performs SHA3-256 hashing and calls Integritas with a backend-only API key.

The API key can come from either:

- encrypted SQLite storage, set from the frontend UI
- `INTEGRITAS_API_KEY` in `.env`, used as a fallback

Install with an Integritas API key:

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
- Integritas API key is backend-only and encrypted at rest in SQLite when saved from the UI
- Backend mounts `/var/run/docker.sock:ro` to read container status and resource usage for the App status page. This is useful for the prototype, but Docker socket access is sensitive and should be replaced with a narrower monitoring approach before production.
- Admin authentication with password + TOTP and HttpOnly session cookies (see [Authentication](#authentication))
- Set `COOKIE_SECURE=true` when exposing the UI over HTTPS on untrusted networks

## Future Services

The Docker Compose file is intentionally simple so more services can be added later, for example:

- Database
- File storage
- CLI session or API token auth
- System commands through an allowlist
- Auto updates

When new services require host packages, add them to the dependency section in `install.sh`.
