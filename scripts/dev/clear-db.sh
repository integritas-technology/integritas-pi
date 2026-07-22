#!/usr/bin/env bash
# Clear the SQLite database of an installed integritas-pi app.
#
# TARGET=all (default) stops the backend container, deletes integritas-pi.db
# (and any -wal/-shm journal files), then restarts the backend so migrations
# recreate a fresh schema. This deletes ALL app data.
#
# TARGET=users|history|automation instead runs scoped DELETE statements for
# just that slice of data, using the already-built backend image (it already
# has better-sqlite3 compiled in, so no extra host dependencies are needed).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/integritas-pi}"
TARGET="${TARGET:-all}"
FORCE=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [-y|--yes]

Clears the SQLite database of an integritas-pi app installed at APP_DIR
(default: /opt/integritas-pi, override with the APP_DIR env var).

Environment:
  TARGET   What to clear (default: all)
             all         Delete the entire database file. Forces redoing the
                          setup wizard, Integritas Connect, data sources,
                          automation workflows -- everything.
             users       Local admin account, sessions, setup wizard state,
                          and Integritas Connect pairing/token/cache.
                          Forces redoing the setup wizard and Integritas
                          Connect.
             history     Integritas proof history, data source read history,
                          and automation workflow run logs (the Diagnostics
                          tabs). Leaves accounts, data sources, and workflow
                          definitions untouched.
             automation  Data sources and automation workflows/blocks.
                          Leaves accounts and history untouched.

  -y, --yes   Skip the confirmation prompt.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -y|--yes) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$TARGET" in
  all)
    description="the entire database (all app data)"
    ;;
  users)
    description="local accounts, sessions, setup state, and Integritas Connect pairing"
    tables="sessions users setup_pending settings integritas_auth integritas_activation integritas_device integritas_account_cache"
    ;;
  history)
    description="Integritas proof history, data source read history, and workflow run logs"
    tables="automation_block_runs automation_runs data_source_reads integritas_proofs"
    ;;
  automation)
    description="data sources and automation workflows/blocks"
    tables="automation_blocks automation_workflows data_sources"
    ;;
  *)
    echo "Unknown TARGET: $TARGET (expected all, users, history, or automation)" >&2
    exit 2
    ;;
esac

if [ ! -f "$APP_DIR/.env" ]; then
  echo "No .env found at $APP_DIR/.env (is APP_DIR correct?)" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a

DATA_DIR="${DATA_DIR:-./data}"
case "$DATA_DIR" in
  /*) resolved_data_dir="$DATA_DIR" ;;
  ./*) resolved_data_dir="$APP_DIR/${DATA_DIR#./}" ;;
  *) resolved_data_dir="$APP_DIR/$DATA_DIR" ;;
esac

DB_PATH="$resolved_data_dir/integritas-pi.db"

if [ ! -f "$DB_PATH" ]; then
  echo "No database found at $DB_PATH; nothing to clear."
  exit 0
fi

if [ "$FORCE" -ne 1 ]; then
  # Read from /dev/tty (not stdin) so the prompt still works when this
  # script is run via `curl ... | bash`, which occupies stdin with the
  # script source itself.
  read -r -p "This will permanently delete $description. Continue? [y/N] " reply < /dev/tty
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

cd "$APP_DIR"

echo "Stopping backend"
docker compose stop backend

if [ "$TARGET" = "all" ]; then
  echo "Deleting $DB_PATH"
  rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
else
  echo "Clearing tables: $tables"
  docker compose run --rm --no-deps -e DB_TABLES="$tables" backend node -e '
    const Database = require("better-sqlite3");
    const db = new Database(process.env.DATABASE_PATH);
    db.pragma("foreign_keys = ON");
    for (const table of process.env.DB_TABLES.split(" ")) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  '
fi

echo "Starting backend"
docker compose start backend

if [ "$TARGET" = "all" ]; then
  echo "Database cleared. Backend will recreate the schema on startup."
else
  echo "Cleared: $tables"
fi
