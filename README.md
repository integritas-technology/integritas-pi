# Integritas Pi

Integritas Pi is a learning prototype for a Raspberry Pi application that can be installed with one command, started with Docker Compose, and opened from a browser on the local network.

The current prototype contains:

- A GitHub-based installer: `install.sh`
- A Docker Compose application
- A React frontend on port `8080`
- A TypeScript/Express backend
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
```

`HOST_FILES_DIR` is mounted into the backend container as `/host-files:ro`. The `:ro` flag is intentional for this prototype.

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
  |
  v
backend container
  - Express + TypeScript
  - GET /api/health
  - GET /api/files
  - Reads /host-files only
  |
  v
Pi host filesystem
  - ${HOST_FILES_DIR:-/home/pi} mounted read-only
```

The backend never receives permission to run arbitrary shell commands. It only lists files and directories under `/host-files`.

## Backend API

Health:

```http
GET /api/health
```

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

## Security Notes

This is a learning prototype, not a production-ready product.

- Backend container runs as the non-root `node` user
- Host files are mounted read-only
- Backend blocks access outside `/host-files`
- Frontend cannot trigger shell commands
- Authentication is not implemented yet

## Future Services

The Docker Compose file is intentionally simple so more services can be added later, for example:

- Minima node
- Database
- File storage
- Auth
- Admin UI
- System commands through an allowlist
- Auto updates

When new services require host packages, add them to the dependency section in `install.sh`.
