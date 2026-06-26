#!/usr/bin/env bash
set -euo pipefail

APP_NAME="integritas-pi"
APP_REPO_URL="${APP_REPO_URL:-https://github.com/integritas-technology/integritas-pi.git}"
APP_BRANCH="${APP_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/integritas-pi}"
HOST_FILES_DIR_INPUT="${HOST_FILES_DIR-}"
FRONTEND_PORT_INPUT="${FRONTEND_PORT-}"
DATA_DIR_INPUT="${DATA_DIR-}"
APP_SECRET_INPUT="${APP_SECRET-}"
DOCKER_GID_INPUT="${DOCKER_GID-}"
ENABLE_GPIO_INPUT="${ENABLE_GPIO-}"
GPIO_GID_INPUT="${GPIO_GID-}"
MINIMA_DATA_DIR_INPUT="${MINIMA_DATA_DIR-}"
MINIMA_P2P_PORT_INPUT="${MINIMA_P2P_PORT-}"
MINIMA_RPC_BIND_INPUT="${MINIMA_RPC_BIND-}"
MINIMA_RPC_PORT_INPUT="${MINIMA_RPC_PORT-}"
INTEGRITAS_BASE_URL_INPUT="${INTEGRITAS_BASE_URL-}"
INTEGRITAS_API_KEY_INPUT="${INTEGRITAS_API_KEY-}"
INTEGRITAS_REQUEST_ID_INPUT="${INTEGRITAS_REQUEST_ID-}"
HOST_FILES_DIR="${HOST_FILES_DIR:-/home/pi}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
DATA_DIR="${DATA_DIR:-./data}"
APP_SECRET="${APP_SECRET:-}"
DOCKER_GID="${DOCKER_GID:-}"
ENABLE_GPIO="${ENABLE_GPIO:-false}"
GPIO_GID="${GPIO_GID:-}"
MINIMA_DATA_DIR="${MINIMA_DATA_DIR:-./minima}"
MINIMA_P2P_PORT="${MINIMA_P2P_PORT:-9003}"
MINIMA_RPC_BIND="${MINIMA_RPC_BIND:-127.0.0.1}"
MINIMA_RPC_PORT="${MINIMA_RPC_PORT:-9005}"
INTEGRITAS_BASE_URL="${INTEGRITAS_BASE_URL:-https://integritas.technology/core}"
INTEGRITAS_API_KEY="${INTEGRITAS_API_KEY:-}"
INTEGRITAS_REQUEST_ID="${INTEGRITAS_REQUEST_ID:-integritas-pi}"

APT_PACKAGES=(
  curl
  ca-certificates
  git
  openssl
)

log() {
  printf '\n[%s] %s\n' "$APP_NAME" "$1"
}

require_root() {
  if [ "${EUID}" -ne 0 ]; then
    echo "This installer must be run as root or with sudo."
    exit 1
  fi
}

detect_platform() {
  if [ "$(uname -s)" != "Linux" ]; then
    echo "This installer only supports Linux."
    exit 1
  fi

  local arch
  arch="$(uname -m)"
  case "$arch" in
    armv7l|aarch64|arm64)
      log "Detected Raspberry Pi compatible architecture: $arch"
      ;;
    *)
      log "Warning: architecture '$arch' is not typical for Raspberry Pi. Continuing for prototype use."
      ;;
  esac
}

require_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "This prototype installer currently requires apt-get."
    exit 1
  fi
}

install_apt_dependencies() {
  log "Installing host dependencies"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${APT_PACKAGES[@]}"
}

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker is already installed"
    return
  fi

  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
}

verify_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker installation failed or docker is not in PATH."
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose plugin is required but was not found."
    echo "Try: apt-get install -y docker-compose-plugin"
    exit 1
  fi
}

prepare_app_directory() {
  log "Preparing $APP_DIR"
  mkdir -p "$APP_DIR"
  chmod 755 "$APP_DIR"
}

prepare_runtime_directories() {
  log "Preparing runtime directories"
  local resolved_data_dir
  case "$DATA_DIR" in
    /*) resolved_data_dir="$DATA_DIR" ;;
    ./*) resolved_data_dir="$APP_DIR/${DATA_DIR#./}" ;;
    *) resolved_data_dir="$APP_DIR/$DATA_DIR" ;;
  esac
  mkdir -p "$resolved_data_dir"
  chown -R 1000:1000 "$resolved_data_dir"
  chmod 700 "$resolved_data_dir"

  case "$MINIMA_DATA_DIR" in
    /*) mkdir -p "$MINIMA_DATA_DIR" ;;
    ./*) mkdir -p "$APP_DIR/${MINIMA_DATA_DIR#./}" ;;
    *) mkdir -p "$APP_DIR/$MINIMA_DATA_DIR" ;;
  esac
}

load_existing_config() {
  if [ ! -f "$APP_DIR/.env" ]; then
    return
  fi

  log "Loading existing runtime configuration"
  set -a
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
  set +a

  HOST_FILES_DIR="${HOST_FILES_DIR_INPUT:-${HOST_FILES_DIR:-/home/pi}}"
  FRONTEND_PORT="${FRONTEND_PORT_INPUT:-${FRONTEND_PORT:-8080}}"
  DATA_DIR="${DATA_DIR_INPUT:-${DATA_DIR:-./data}}"
  APP_SECRET="${APP_SECRET_INPUT:-${APP_SECRET:-}}"
  DOCKER_GID="${DOCKER_GID_INPUT:-${DOCKER_GID:-}}"
  ENABLE_GPIO="${ENABLE_GPIO_INPUT:-${ENABLE_GPIO:-false}}"
  GPIO_GID="${GPIO_GID_INPUT:-${GPIO_GID:-}}"
  MINIMA_DATA_DIR="${MINIMA_DATA_DIR_INPUT:-${MINIMA_DATA_DIR:-./minima}}"
  MINIMA_P2P_PORT="${MINIMA_P2P_PORT_INPUT:-${MINIMA_P2P_PORT:-9003}}"
  MINIMA_RPC_BIND="${MINIMA_RPC_BIND_INPUT:-${MINIMA_RPC_BIND:-127.0.0.1}}"
  MINIMA_RPC_PORT="${MINIMA_RPC_PORT_INPUT:-${MINIMA_RPC_PORT:-9005}}"
  INTEGRITAS_BASE_URL="${INTEGRITAS_BASE_URL_INPUT:-${INTEGRITAS_BASE_URL:-https://integritas.technology/core}}"
  INTEGRITAS_API_KEY="${INTEGRITAS_API_KEY_INPUT:-${INTEGRITAS_API_KEY:-}}"
  INTEGRITAS_REQUEST_ID="${INTEGRITAS_REQUEST_ID_INPUT:-${INTEGRITAS_REQUEST_ID:-integritas-pi}}"
}

ensure_app_secret() {
  if [ -n "$APP_SECRET" ]; then
    return
  fi

  log "Generating APP_SECRET for encrypted local settings"
  APP_SECRET="$(openssl rand -hex 32)"
}

detect_docker_gid() {
  if [ -n "$DOCKER_GID" ]; then
    return
  fi

  if [ -S /var/run/docker.sock ]; then
    DOCKER_GID="$(stat -c '%g' /var/run/docker.sock)"
  else
    DOCKER_GID="0"
  fi
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

detect_gpio_gid() {
  if ! is_truthy "$ENABLE_GPIO"; then
    ENABLE_GPIO="false"
    return
  fi

  ENABLE_GPIO="true"

  if [ -n "$GPIO_GID" ]; then
    return
  fi

  if [ -e /dev/gpiochip0 ]; then
    GPIO_GID="$(stat -c '%g' /dev/gpiochip0)"
  elif getent group gpio >/dev/null 2>&1; then
    GPIO_GID="$(getent group gpio | cut -d: -f3)"
  else
    GPIO_GID="0"
  fi
}

relative_top_level_dir() {
  local value="$1"
  case "$value" in
    /*) echo "" ;;
    ./*) value="${value#./}"; echo "${value%%/*}" ;;
    *) echo "${value%%/*}" ;;
  esac
}

download_app() {
  local tmp_dir
  local protected_minima_dir
  local protected_sqlite_dir
  tmp_dir="$(mktemp -d)"
  protected_minima_dir="$(relative_top_level_dir "$MINIMA_DATA_DIR")"
  protected_sqlite_dir="$(relative_top_level_dir "$DATA_DIR")"

  log "Downloading $APP_REPO_URL ($APP_BRANCH)"
  git clone --depth 1 --branch "$APP_BRANCH" "$APP_REPO_URL" "$tmp_dir"

  rm -rf "$APP_DIR/.git" "$APP_DIR/backend" "$APP_DIR/frontend"
  if [ -n "$protected_minima_dir" ] && [ -n "$protected_sqlite_dir" ]; then
    find "$APP_DIR" -mindepth 1 -maxdepth 1 \
      ! -name ".env" \
      ! -name "$protected_minima_dir" \
      ! -name "$protected_sqlite_dir" \
      -exec rm -rf {} +
  elif [ -n "$protected_minima_dir" ]; then
    find "$APP_DIR" -mindepth 1 -maxdepth 1 \
      ! -name ".env" \
      ! -name "$protected_minima_dir" \
      -exec rm -rf {} +
  elif [ -n "$protected_sqlite_dir" ]; then
    find "$APP_DIR" -mindepth 1 -maxdepth 1 \
      ! -name ".env" \
      ! -name "$protected_sqlite_dir" \
      -exec rm -rf {} +
  else
    find "$APP_DIR" -mindepth 1 -maxdepth 1 \
      ! -name ".env" \
      -exec rm -rf {} +
  fi

  cp -a "$tmp_dir/." "$APP_DIR/"
  rm -rf "$tmp_dir"
}

write_env_file() {
  log "Writing runtime configuration"
  cat > "$APP_DIR/.env" <<EOF
HOST_FILES_DIR=$HOST_FILES_DIR
FRONTEND_PORT=$FRONTEND_PORT
DATA_DIR=$DATA_DIR
APP_SECRET=$APP_SECRET
DOCKER_GID=$DOCKER_GID
ENABLE_GPIO=$ENABLE_GPIO
GPIO_GID=$GPIO_GID
MINIMA_DATA_DIR=$MINIMA_DATA_DIR
MINIMA_P2P_PORT=$MINIMA_P2P_PORT
MINIMA_RPC_BIND=$MINIMA_RPC_BIND
MINIMA_RPC_PORT=$MINIMA_RPC_PORT
INTEGRITAS_BASE_URL=$INTEGRITAS_BASE_URL
INTEGRITAS_API_KEY=$INTEGRITAS_API_KEY
INTEGRITAS_REQUEST_ID=$INTEGRITAS_REQUEST_ID
EOF
}

write_compose_override() {
  if ! is_truthy "$ENABLE_GPIO"; then
    rm -f "$APP_DIR/docker-compose.override.yml"
    return
  fi

  log "Enabling GPIO device access"

  if [ ! -e /dev/gpiochip0 ]; then
    log "Warning: /dev/gpiochip0 was not found on this host. GPIO sources will not work until the device exists."
  fi

  cat > "$APP_DIR/docker-compose.override.yml" <<EOF
services:
  backend:
    devices:
      - /dev/gpiochip0:/dev/gpiochip0
    group_add:
      - "\${DOCKER_GID:-0}"
      - "\${GPIO_GID:-0}"
EOF
}

start_app() {
  log "Starting Docker services"
  cd "$APP_DIR"
  docker compose up -d --build
}

install_cli() {
  if [ -f "$APP_DIR/bin/integritas-pi" ]; then
    log "Installing CLI command"
    install -m 755 "$APP_DIR/bin/integritas-pi" /usr/local/bin/integritas-pi
  fi
}

get_ip_address() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

print_success_message() {
  local ip_address
  ip_address="$(get_ip_address)"

  echo
  echo "Installation complete."
  echo
  echo "Open your browser and go to:"
  echo
  if [ -n "$ip_address" ]; then
    echo "http://$ip_address:$FRONTEND_PORT"
  else
    echo "http://<pi-ip>:$FRONTEND_PORT"
  fi
  echo
  echo "Local URL on the Pi: http://localhost:$FRONTEND_PORT"
}

main() {
  require_root
  detect_platform
  require_apt
  install_apt_dependencies
  install_docker_if_missing
  verify_docker
  prepare_app_directory
  load_existing_config
  ensure_app_secret
  detect_docker_gid
  detect_gpio_gid
  download_app
  prepare_runtime_directories
  write_env_file
  write_compose_override
  install_cli
  start_app
  print_success_message
}

main "$@"
