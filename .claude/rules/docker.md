# Docker / Pi Rules

- UI is exposed on HTTPS at `${FRONTEND_PORT:-8080}` (container port 443) with a self-signed cert in `${DATA_DIR:-./data}/certs`.
- Backend is internal behind frontend `/api` proxy.
- SQLite data lives in `${DATA_DIR:-./data}` mounted to `/data`.
- Minima data lives in `${MINIMA_DATA_DIR:-./minima}`.
- Host files are mounted read-only to `/host-files`.
- Docker socket is mounted read-only for prototype status only; treat it as sensitive.
- GPIO input requires explicit `/dev/gpiochip0` device access and `gpiomon`; keep it optional, input-only, and documented as host hardware access.
- Pi Camera capture uses the opt-in host-side Python camera helper (`ENABLE_CAMERA=true`) instead of camera CLI commands inside the backend container; keep it localhost/token-protected and document privacy impact.
- The optional local MQTT broker uses the `mqtt` Compose profile and exposes `${MQTT_PUBLIC_PORT:-1883}` only when explicitly enabled.
- `host.docker.internal` is mapped for Linux via `extra_hosts` for host-gateway access.
