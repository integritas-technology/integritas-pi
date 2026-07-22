#!/usr/bin/env bash
# Set update-agent's manifest poll interval on an installed integritas-pi app.
#
# Replaces the STATUS_POLL_INTERVAL_MS line in the app's .env in place
# (leaving every other value untouched), then recreates the update-agent
# container so it picks up the new value -- only if update-agent is
# currently running, so this never force-starts it on installs that leave
# it off (e.g. DEV_MODE).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/integritas-pi}"
STATUS_POLL_INTERVAL_MS="${STATUS_POLL_INTERVAL_MS:-}"

usage() {
  cat <<EOF
Usage: STATUS_POLL_INTERVAL_MS=<milliseconds> $(basename "$0")

Sets STATUS_POLL_INTERVAL_MS in the .env of an integritas-pi app installed
at APP_DIR (default: /opt/integritas-pi, override with the APP_DIR env
var). Value is how often update-agent checks the update manifest in the
background (default 43200000 = 12h; e.g. 300000 = 5 min for QA/testing).
EOF
}

case "${1-}" in
  -h|--help) usage; exit 0 ;;
esac

if [ -z "$STATUS_POLL_INTERVAL_MS" ]; then
  echo "STATUS_POLL_INTERVAL_MS is not set." >&2
  usage >&2
  exit 2
fi

case "$STATUS_POLL_INTERVAL_MS" in
  ''|*[!0-9]*)
    echo "STATUS_POLL_INTERVAL_MS must be a positive integer (milliseconds), got: $STATUS_POLL_INTERVAL_MS" >&2
    exit 2
    ;;
esac

if [ ! -f "$APP_DIR/.env" ]; then
  echo "No .env found at $APP_DIR/.env (is APP_DIR correct?)" >&2
  exit 1
fi

if grep -q '^STATUS_POLL_INTERVAL_MS=' "$APP_DIR/.env"; then
  sed -i "s/^STATUS_POLL_INTERVAL_MS=.*/STATUS_POLL_INTERVAL_MS=$STATUS_POLL_INTERVAL_MS/" "$APP_DIR/.env"
else
  printf 'STATUS_POLL_INTERVAL_MS=%s\n' "$STATUS_POLL_INTERVAL_MS" >> "$APP_DIR/.env"
fi

echo "Set STATUS_POLL_INTERVAL_MS=$STATUS_POLL_INTERVAL_MS in $APP_DIR/.env"

cd "$APP_DIR"

if docker compose ps --status running --services 2>/dev/null | grep -qx update-agent; then
  echo "Recreating update-agent to apply the new value"
  docker compose --profile update-agent up -d --no-deps update-agent
else
  echo "update-agent is not currently running; the new value will apply next time it starts."
fi
