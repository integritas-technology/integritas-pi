#!/usr/bin/env bash
set -euo pipefail

APP_NAME="integritas-pi"
APP_REPO_URL="${APP_REPO_URL:-https://github.com/integritas-technology/integritas-pi.git}"
APP_BRANCH="${APP_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/integritas-pi}"
HOST_FILES_DIR_INPUT="${HOST_FILES_DIR-}"
FRONTEND_PORT_INPUT="${FRONTEND_PORT-}"
MINIMA_DATA_DIR_INPUT="${MINIMA_DATA_DIR-}"
MINIMA_P2P_PORT_INPUT="${MINIMA_P2P_PORT-}"
MINIMA_RPC_BIND_INPUT="${MINIMA_RPC_BIND-}"
MINIMA_RPC_PORT_INPUT="${MINIMA_RPC_PORT-}"
HOST_FILES_DIR="${HOST_FILES_DIR:-/home/pi}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
MINIMA_DATA_DIR="${MINIMA_DATA_DIR:-./minima}"
MINIMA_P2P_PORT="${MINIMA_P2P_PORT:-9003}"
MINIMA_RPC_BIND="${MINIMA_RPC_BIND:-127.0.0.1}"
MINIMA_RPC_PORT="${MINIMA_RPC_PORT:-9005}"

APT_PACKAGES=(
  curl
  ca-certificates
  git
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
}

prepare_runtime_directories() {
  log "Preparing runtime directories"
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
  MINIMA_DATA_DIR="${MINIMA_DATA_DIR_INPUT:-${MINIMA_DATA_DIR:-./minima}}"
  MINIMA_P2P_PORT="${MINIMA_P2P_PORT_INPUT:-${MINIMA_P2P_PORT:-9003}}"
  MINIMA_RPC_BIND="${MINIMA_RPC_BIND_INPUT:-${MINIMA_RPC_BIND:-127.0.0.1}}"
  MINIMA_RPC_PORT="${MINIMA_RPC_PORT_INPUT:-${MINIMA_RPC_PORT:-9005}}"
}

download_app() {
  local tmp_dir
  local protected_data_dir
  tmp_dir="$(mktemp -d)"
  protected_data_dir=""

  case "$MINIMA_DATA_DIR" in
    /*) protected_data_dir="" ;;
    ./*) protected_data_dir="${MINIMA_DATA_DIR#./}" ;;
    *) protected_data_dir="$MINIMA_DATA_DIR" ;;
  esac
  protected_data_dir="${protected_data_dir%%/*}"

  log "Downloading $APP_REPO_URL ($APP_BRANCH)"
  git clone --depth 1 --branch "$APP_BRANCH" "$APP_REPO_URL" "$tmp_dir"

  rm -rf "$APP_DIR/.git" "$APP_DIR/backend" "$APP_DIR/frontend"
  if [ -n "$protected_data_dir" ]; then
    find "$APP_DIR" -mindepth 1 -maxdepth 1 \
      ! -name ".env" \
      ! -name "$protected_data_dir" \
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
MINIMA_DATA_DIR=$MINIMA_DATA_DIR
MINIMA_P2P_PORT=$MINIMA_P2P_PORT
MINIMA_RPC_BIND=$MINIMA_RPC_BIND
MINIMA_RPC_PORT=$MINIMA_RPC_PORT
EOF
}

start_app() {
  log "Starting Docker services"
  cd "$APP_DIR"
  docker compose up -d --build
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
  download_app
  prepare_runtime_directories
  write_env_file
  start_app
  print_success_message
}

main "$@"
