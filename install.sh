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
ENABLE_MQTT_BROKER_INPUT="${ENABLE_MQTT_BROKER-}"
MQTT_PUBLIC_HOST_INPUT="${MQTT_PUBLIC_HOST-}"
MQTT_PUBLIC_PORT_INPUT="${MQTT_PUBLIC_PORT-}"
ENABLE_CAMERA_INPUT="${ENABLE_CAMERA-}"
CAMERA_CAPTURE_DIR_INPUT="${CAMERA_CAPTURE_DIR-}"
CAMERA_HELPER_TOKEN_INPUT="${CAMERA_HELPER_TOKEN-}"
CAMERA_HELPER_PORT_INPUT="${CAMERA_HELPER_PORT-}"
CAMERA_MAX_DURATION_SECONDS_INPUT="${CAMERA_MAX_DURATION_SECONDS-}"
CAMERA_RETENTION_DAYS_INPUT="${CAMERA_RETENTION_DAYS-}"
CAMERA_PHOTO_COMMAND_INPUT="${CAMERA_PHOTO_COMMAND-}"
CAMERA_VIDEO_COMMAND_INPUT="${CAMERA_VIDEO_COMMAND-}"
INTEGRITAS_DOCKER_SUBNET_INPUT="${INTEGRITAS_DOCKER_SUBNET-}"
INTEGRITAS_DOCKER_GATEWAY_INPUT="${INTEGRITAS_DOCKER_GATEWAY-}"
MINIMA_DATA_DIR_INPUT="${MINIMA_DATA_DIR-}"
UPDATE_AGENT_STATE_DIR_INPUT="${UPDATE_AGENT_STATE_DIR-}"
MINIMA_P2P_PORT_INPUT="${MINIMA_P2P_PORT-}"
MINIMA_RPC_BIND_INPUT="${MINIMA_RPC_BIND-}"
MINIMA_RPC_PORT_INPUT="${MINIMA_RPC_PORT-}"
INTEGRITAS_CONNECT_BASE_URL_INPUT="${INTEGRITAS_CONNECT_BASE_URL-}"
INTEGRITAS_BASE_URL_INPUT="${INTEGRITAS_BASE_URL-}"
INTEGRITAS_REQUEST_ID_INPUT="${INTEGRITAS_REQUEST_ID-}"
MANIFEST_URL_INPUT="${MANIFEST_URL-}"
DEV_MODE_INPUT="${DEV_MODE-}"
HOST_FILES_DIR="${HOST_FILES_DIR:-/home/pi}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
DATA_DIR="${DATA_DIR:-./data}"
APP_SECRET="${APP_SECRET:-}"
DOCKER_GID="${DOCKER_GID:-}"
ENABLE_GPIO="${ENABLE_GPIO:-false}"
GPIO_GID="${GPIO_GID:-}"
ENABLE_MQTT_BROKER="${ENABLE_MQTT_BROKER:-false}"
MQTT_PUBLIC_HOST="${MQTT_PUBLIC_HOST:-}"
MQTT_PUBLIC_PORT="${MQTT_PUBLIC_PORT:-1883}"
ENABLE_CAMERA="${ENABLE_CAMERA:-false}"
CAMERA_CAPTURE_DIR="${CAMERA_CAPTURE_DIR:-/data/captures}"
CAMERA_HELPER_TOKEN="${CAMERA_HELPER_TOKEN:-}"
CAMERA_HELPER_PORT="${CAMERA_HELPER_PORT:-38180}"
CAMERA_MAX_DURATION_SECONDS="${CAMERA_MAX_DURATION_SECONDS:-30}"
CAMERA_RETENTION_DAYS="${CAMERA_RETENTION_DAYS:-7}"
CAMERA_PHOTO_COMMAND="${CAMERA_PHOTO_COMMAND:-rpicam-still}"
CAMERA_VIDEO_COMMAND="${CAMERA_VIDEO_COMMAND:-rpicam-vid}"
INTEGRITAS_DOCKER_SUBNET="${INTEGRITAS_DOCKER_SUBNET:-172.30.0.0/24}"
INTEGRITAS_DOCKER_GATEWAY="${INTEGRITAS_DOCKER_GATEWAY:-172.30.0.1}"
MINIMA_DATA_DIR="${MINIMA_DATA_DIR:-./minima}"
UPDATE_AGENT_STATE_DIR="${UPDATE_AGENT_STATE_DIR:-./update-agent-state}"
MINIMA_P2P_PORT="${MINIMA_P2P_PORT:-9003}"
MINIMA_RPC_BIND="${MINIMA_RPC_BIND:-127.0.0.1}"
MINIMA_RPC_PORT="${MINIMA_RPC_PORT:-9005}"
INTEGRITAS_CONNECT_BASE_URL="${INTEGRITAS_CONNECT_BASE_URL:-https://integritas.technology}"
INTEGRITAS_BASE_URL="${INTEGRITAS_BASE_URL:-https://integritas.technology/core}"
INTEGRITAS_REQUEST_ID="${INTEGRITAS_REQUEST_ID:-integritas-pi}"
MANIFEST_URL="${MANIFEST_URL:-https://integritas.technology/update-manifest/manifest.json}"
DEV_MODE="${DEV_MODE:-false}"

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
  resolved_data_dir="$(resolved_data_dir)"
  mkdir -p "$resolved_data_dir"
  chown -R 1000:1000 "$resolved_data_dir"
  chmod 700 "$resolved_data_dir"

  if is_truthy "$ENABLE_CAMERA"; then
    mkdir -p "$(resolved_camera_capture_dir)"
    chown -R 1000:1000 "$(resolved_camera_capture_dir)"
    chmod 700 "$(resolved_camera_capture_dir)"
  fi

  case "$MINIMA_DATA_DIR" in
    /*) mkdir -p "$MINIMA_DATA_DIR" ;;
    ./*) mkdir -p "$APP_DIR/${MINIMA_DATA_DIR#./}" ;;
    *) mkdir -p "$APP_DIR/$MINIMA_DATA_DIR" ;;
  esac

  local resolved_update_agent_state_dir
  case "$UPDATE_AGENT_STATE_DIR" in
    /*) resolved_update_agent_state_dir="$UPDATE_AGENT_STATE_DIR" ;;
    ./*) resolved_update_agent_state_dir="$APP_DIR/${UPDATE_AGENT_STATE_DIR#./}" ;;
    *) resolved_update_agent_state_dir="$APP_DIR/$UPDATE_AGENT_STATE_DIR" ;;
  esac
  mkdir -p "$resolved_update_agent_state_dir"
  chown -R 1000:1000 "$resolved_update_agent_state_dir"
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
  ENABLE_MQTT_BROKER="${ENABLE_MQTT_BROKER_INPUT:-${ENABLE_MQTT_BROKER:-false}}"
  MQTT_PUBLIC_HOST="${MQTT_PUBLIC_HOST_INPUT:-${MQTT_PUBLIC_HOST:-}}"
  MQTT_PUBLIC_PORT="${MQTT_PUBLIC_PORT_INPUT:-${MQTT_PUBLIC_PORT:-1883}}"
  ENABLE_CAMERA="${ENABLE_CAMERA_INPUT:-${ENABLE_CAMERA:-false}}"
  CAMERA_CAPTURE_DIR="${CAMERA_CAPTURE_DIR_INPUT:-${CAMERA_CAPTURE_DIR:-/data/captures}}"
  CAMERA_HELPER_TOKEN="${CAMERA_HELPER_TOKEN_INPUT:-${CAMERA_HELPER_TOKEN:-}}"
  CAMERA_HELPER_PORT="${CAMERA_HELPER_PORT_INPUT:-${CAMERA_HELPER_PORT:-38180}}"
  CAMERA_MAX_DURATION_SECONDS="${CAMERA_MAX_DURATION_SECONDS_INPUT:-${CAMERA_MAX_DURATION_SECONDS:-30}}"
  CAMERA_RETENTION_DAYS="${CAMERA_RETENTION_DAYS_INPUT:-${CAMERA_RETENTION_DAYS:-7}}"
  CAMERA_PHOTO_COMMAND="${CAMERA_PHOTO_COMMAND_INPUT:-${CAMERA_PHOTO_COMMAND:-rpicam-still}}"
  CAMERA_VIDEO_COMMAND="${CAMERA_VIDEO_COMMAND_INPUT:-${CAMERA_VIDEO_COMMAND:-rpicam-vid}}"
  INTEGRITAS_DOCKER_SUBNET="${INTEGRITAS_DOCKER_SUBNET_INPUT:-${INTEGRITAS_DOCKER_SUBNET:-172.30.0.0/24}}"
  INTEGRITAS_DOCKER_GATEWAY="${INTEGRITAS_DOCKER_GATEWAY_INPUT:-${INTEGRITAS_DOCKER_GATEWAY:-172.30.0.1}}"
  MINIMA_DATA_DIR="${MINIMA_DATA_DIR_INPUT:-${MINIMA_DATA_DIR:-./minima}}"
  UPDATE_AGENT_STATE_DIR="${UPDATE_AGENT_STATE_DIR_INPUT:-${UPDATE_AGENT_STATE_DIR:-./update-agent-state}}"
  MINIMA_P2P_PORT="${MINIMA_P2P_PORT_INPUT:-${MINIMA_P2P_PORT:-9003}}"
  MINIMA_RPC_BIND="${MINIMA_RPC_BIND_INPUT:-${MINIMA_RPC_BIND:-127.0.0.1}}"
  MINIMA_RPC_PORT="${MINIMA_RPC_PORT_INPUT:-${MINIMA_RPC_PORT:-9005}}"
  INTEGRITAS_CONNECT_BASE_URL="${INTEGRITAS_CONNECT_BASE_URL_INPUT:-${INTEGRITAS_CONNECT_BASE_URL:-https://integritas.technology}}"
  INTEGRITAS_BASE_URL="${INTEGRITAS_BASE_URL_INPUT:-${INTEGRITAS_BASE_URL:-https://integritas.technology/core}}"
  INTEGRITAS_REQUEST_ID="${INTEGRITAS_REQUEST_ID_INPUT:-${INTEGRITAS_REQUEST_ID:-integritas-pi}}"
  MANIFEST_URL="${MANIFEST_URL_INPUT:-${MANIFEST_URL:-https://integritas.technology/update-manifest/manifest.json}}"
  DEV_MODE="${DEV_MODE_INPUT:-${DEV_MODE:-false}}"
}

ensure_app_secret() {
  if [ -n "$APP_SECRET" ]; then
    return
  fi

  log "Generating APP_SECRET for encrypted local settings"
  APP_SECRET="$(openssl rand -hex 32)"
}

ensure_camera_helper_token() {
  if ! is_truthy "$ENABLE_CAMERA" || [ -n "$CAMERA_HELPER_TOKEN" ]; then
    return
  fi

  log "Generating CAMERA_HELPER_TOKEN for local camera helper"
  CAMERA_HELPER_TOKEN="$(openssl rand -hex 32)"
}

resolved_data_dir() {
  case "$DATA_DIR" in
    /*) echo "$DATA_DIR" ;;
    ./*) echo "$APP_DIR/${DATA_DIR#./}" ;;
    *) echo "$APP_DIR/$DATA_DIR" ;;
  esac
}

resolved_camera_capture_dir() {
  case "$CAMERA_CAPTURE_DIR" in
    /data/*) echo "$(resolved_data_dir)/${CAMERA_CAPTURE_DIR#/data/}" ;;
    /*) echo "$CAMERA_CAPTURE_DIR" ;;
    ./*) echo "$APP_DIR/${CAMERA_CAPTURE_DIR#./}" ;;
    *) echo "$APP_DIR/$CAMERA_CAPTURE_DIR" ;;
  esac
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

normalize_mqtt_broker_config() {
  if is_truthy "$ENABLE_MQTT_BROKER"; then
    ENABLE_MQTT_BROKER="true"
  else
    ENABLE_MQTT_BROKER="false"
  fi
}

normalize_dev_mode() {
  if is_truthy "$DEV_MODE"; then
    DEV_MODE="true"
  else
    DEV_MODE="false"
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
  local protected_update_agent_state_dir
  local find_args=("$APP_DIR" -mindepth 1 -maxdepth 1 ! -name ".env")
  tmp_dir="$(mktemp -d)"
  protected_minima_dir="$(relative_top_level_dir "$MINIMA_DATA_DIR")"
  protected_sqlite_dir="$(relative_top_level_dir "$DATA_DIR")"
  protected_update_agent_state_dir="$(relative_top_level_dir "$UPDATE_AGENT_STATE_DIR")"

  log "Downloading $APP_REPO_URL ($APP_BRANCH)"
  git clone --depth 1 --branch "$APP_BRANCH" "$APP_REPO_URL" "$tmp_dir"

  rm -rf "$APP_DIR/.git" "$APP_DIR/backend" "$APP_DIR/frontend"
  [ -n "$protected_minima_dir" ] && find_args+=(! -name "$protected_minima_dir")
  [ -n "$protected_sqlite_dir" ] && find_args+=(! -name "$protected_sqlite_dir")
  [ -n "$protected_update_agent_state_dir" ] && find_args+=(! -name "$protected_update_agent_state_dir")
  find_args+=(-exec rm -rf {} +)
  find "${find_args[@]}"

  cp -a "$tmp_dir/." "$APP_DIR/"
  chmod 755 "$APP_DIR"
  rm -rf "$tmp_dir"

  log "install.sh version: $(fetch_manifest_field "$APP_DIR/package.json" version)"
}

fetch_manifest_field() {
  local manifest_file="$1"
  local field="$2"
  grep -o "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$manifest_file" \
    | head -n1 \
    | sed -E 's/.*:[[:space:]]*"([^"]*)"$/\1/'
}

resolve_images() {
  if is_truthy "$DEV_MODE"; then
    log "DEV_MODE enabled: skipping manifest fetch/signature verification and update agent; building frontend/backend from source"
    FRONTEND_IMAGE="integritas-pi-frontend:dev"
    BACKEND_IMAGE="integritas-pi-backend:dev"
    UPDATE_AGENT_IMAGE=""
    MANIFEST_VERSION=""
    MANIFEST_CREATED_AT=""
    return
  fi

  fetch_and_verify_manifest
}

fetch_and_verify_manifest() {
  if [ -z "$MANIFEST_URL" ]; then
    echo "MANIFEST_URL is not set. Set it in .env or pass MANIFEST_URL=<url> to this installer."
    exit 1
  fi

  local public_key_file="$APP_DIR/update-agent/manifest-public-key.pem"
  if [ ! -f "$public_key_file" ]; then
    echo "Manifest public key not found at $public_key_file"
    exit 1
  fi

  log "Fetching update manifest from $MANIFEST_URL"

  local manifest_file="$APP_DIR/.manifest.json"
  local signature_file="$APP_DIR/.manifest.json.sig"
  local signature_bin="$APP_DIR/.manifest.json.sig.bin"

  curl -fsSL "$MANIFEST_URL" -o "$manifest_file"
  curl -fsSL "${MANIFEST_URL}.sig" -o "$signature_file"

  base64 -d "$signature_file" > "$signature_bin"

  local openssl_major
  openssl_major="$(openssl version | sed -E 's/^OpenSSL ([0-9]+).*/\1/')"

  if [ "$openssl_major" -lt 3 ] 2>/dev/null; then
    echo
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "! WARNING: SIGNATURE VERIFICATION IS DISABLED                              !"
    echo "!                                                                          !"
    echo "! Detected OpenSSL $(openssl version) which cannot verify Ed25519          !"
    echo "! signatures via pkeyutl (needs OpenSSL 3.x). Manifest signature checking  !"
    echo "! is being SKIPPED so testing can continue on this host. Images will be    !"
    echo "! installed WITHOUT verifying they were signed by a trusted publisher.     !"
    echo "!                                                                          !"
    echo "! THIS IS TEMPORARY. Remove this bypass once a real fix ships             !"
    echo "! (see install.sh fetch_and_verify_manifest).                             !"
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo
  elif ! openssl pkeyutl -verify -pubin -inkey "$public_key_file" -in "$manifest_file" -sigfile "$signature_bin"; then
    echo "Manifest signature verification failed. Refusing to install untrusted images."
    rm -f "$manifest_file" "$signature_file" "$signature_bin"
    exit 1
  fi

  FRONTEND_IMAGE="$(fetch_manifest_field "$manifest_file" frontend)"
  BACKEND_IMAGE="$(fetch_manifest_field "$manifest_file" backend)"
  UPDATE_AGENT_IMAGE="$(fetch_manifest_field "$manifest_file" updateAgent)"
  MANIFEST_VERSION="$(fetch_manifest_field "$manifest_file" version)"
  MANIFEST_CREATED_AT="$(fetch_manifest_field "$manifest_file" createdAt)"

  rm -f "$manifest_file" "$signature_file" "$signature_bin"

  if [ -z "$FRONTEND_IMAGE" ] || [ -z "$BACKEND_IMAGE" ] || [ -z "$UPDATE_AGENT_IMAGE" ]; then
    echo "Manifest is missing frontend, backend, or update-agent image digest."
    exit 1
  fi

  log "Manifest verified. frontend=$FRONTEND_IMAGE backend=$BACKEND_IMAGE update-agent=$UPDATE_AGENT_IMAGE"
}

record_applied_manifest() {
  if [ -z "$MANIFEST_VERSION" ] || [ -z "$MANIFEST_CREATED_AT" ]; then
    echo "Manifest is missing version or createdAt; skipping last-applied-manifest.json write."
    return
  fi

  local resolved_update_agent_state_dir
  case "$UPDATE_AGENT_STATE_DIR" in
    /*) resolved_update_agent_state_dir="$UPDATE_AGENT_STATE_DIR" ;;
    ./*) resolved_update_agent_state_dir="$APP_DIR/${UPDATE_AGENT_STATE_DIR#./}" ;;
    *) resolved_update_agent_state_dir="$APP_DIR/$UPDATE_AGENT_STATE_DIR" ;;
  esac

  mkdir -p "$resolved_update_agent_state_dir"
  cat > "$resolved_update_agent_state_dir/last-applied-manifest.json" <<EOF
{
  "createdAt": "$MANIFEST_CREATED_AT",
  "version": "$MANIFEST_VERSION"
}
EOF
  chown -R 1000:1000 "$resolved_update_agent_state_dir"
  log "Recorded last-applied-manifest.json (version=$MANIFEST_VERSION)"
}

write_env_file() {
  log "Writing runtime configuration"

  local compose_profiles=()
  [ "$ENABLE_MQTT_BROKER" = "true" ] && compose_profiles+=(mqtt)
  is_truthy "$DEV_MODE" || compose_profiles+=(update-agent)
  local compose_profiles_joined
  compose_profiles_joined="$(IFS=,; echo "${compose_profiles[*]:-}")"

  cat > "$APP_DIR/.env" <<EOF
HOST_FILES_DIR=$HOST_FILES_DIR
FRONTEND_PORT=$FRONTEND_PORT
DATA_DIR=$DATA_DIR
APP_SECRET=$APP_SECRET
DOCKER_GID=$DOCKER_GID
ENABLE_GPIO=$ENABLE_GPIO
GPIO_GID=$GPIO_GID
ENABLE_CAMERA=$ENABLE_CAMERA
CAMERA_CAPTURE_DIR=$CAMERA_CAPTURE_DIR
CAMERA_HELPER_URL=http://$INTEGRITAS_DOCKER_GATEWAY:$CAMERA_HELPER_PORT
CAMERA_HELPER_TOKEN=$CAMERA_HELPER_TOKEN
CAMERA_HELPER_PORT=$CAMERA_HELPER_PORT
CAMERA_MAX_DURATION_SECONDS=$CAMERA_MAX_DURATION_SECONDS
CAMERA_RETENTION_DAYS=$CAMERA_RETENTION_DAYS
CAMERA_PHOTO_COMMAND=$CAMERA_PHOTO_COMMAND
CAMERA_VIDEO_COMMAND=$CAMERA_VIDEO_COMMAND
INTEGRITAS_DOCKER_SUBNET=$INTEGRITAS_DOCKER_SUBNET
INTEGRITAS_DOCKER_GATEWAY=$INTEGRITAS_DOCKER_GATEWAY
ENABLE_MQTT_BROKER=$ENABLE_MQTT_BROKER
DEV_MODE=$DEV_MODE
COMPOSE_PROFILES=$compose_profiles_joined
MQTT_PUBLIC_HOST=$MQTT_PUBLIC_HOST
MQTT_PUBLIC_PORT=$MQTT_PUBLIC_PORT
MQTT_INTERNAL_URL=mqtt://mqtt:1883
MINIMA_DATA_DIR=$MINIMA_DATA_DIR
UPDATE_AGENT_STATE_DIR=$UPDATE_AGENT_STATE_DIR
MINIMA_P2P_PORT=$MINIMA_P2P_PORT
MINIMA_RPC_BIND=$MINIMA_RPC_BIND
MINIMA_RPC_PORT=$MINIMA_RPC_PORT
INTEGRITAS_CONNECT_BASE_URL=$INTEGRITAS_CONNECT_BASE_URL
INTEGRITAS_BASE_URL=$INTEGRITAS_BASE_URL
INTEGRITAS_REQUEST_ID=$INTEGRITAS_REQUEST_ID
COOKIE_SECURE=true
MANIFEST_URL=$MANIFEST_URL
FRONTEND_IMAGE=$FRONTEND_IMAGE
BACKEND_IMAGE=$BACKEND_IMAGE
UPDATE_AGENT_IMAGE=$UPDATE_AGENT_IMAGE
EOF
}

write_compose_override() {
  local docker_group
  local gpio_group

  if ! is_truthy "$ENABLE_GPIO"; then
    rm -f "$APP_DIR/docker-compose.override.yml"
    return
  fi

  docker_group="${DOCKER_GID:-0}"
  gpio_group="${GPIO_GID:-0}"

  cat > "$APP_DIR/docker-compose.override.yml" <<EOF
services:
  backend:
EOF

  if is_truthy "$ENABLE_GPIO"; then
    log "Enabling GPIO device access"

    if [ ! -e /dev/gpiochip0 ]; then
      log "Warning: /dev/gpiochip0 was not found on this host. GPIO sources will not work until the device exists."
    fi

    cat >> "$APP_DIR/docker-compose.override.yml" <<EOF
    devices:
      - /dev/gpiochip0:/dev/gpiochip0
EOF
  fi

  if [ "$gpio_group" != "$docker_group" ]; then
    cat >> "$APP_DIR/docker-compose.override.yml" <<EOF
    group_add:
EOF
    cat >> "$APP_DIR/docker-compose.override.yml" <<EOF
      - "\${GPIO_GID:-0}"
EOF
  fi
}

install_camera_helper() {
  local service_file="/etc/systemd/system/integritas-pi-camera-helper.service"
  local helper_user
  local supplementary_groups=""
  local capture_dir

  if ! is_truthy "$ENABLE_CAMERA"; then
    if [ -f "$service_file" ]; then
      log "Disabling camera helper service"
      systemctl disable --now integritas-pi-camera-helper.service >/dev/null 2>&1 || true
      rm -f "$service_file"
      systemctl daemon-reload
    fi
    return
  fi

  helper_user="${SUDO_USER:-pi}"
  if ! id "$helper_user" >/dev/null 2>&1; then
    helper_user="root"
  fi
  if getent group video >/dev/null 2>&1; then
    supplementary_groups="SupplementaryGroups=video"
  fi

  capture_dir="$(resolved_camera_capture_dir)"
  mkdir -p "$capture_dir"
  if [ "$helper_user" != "root" ]; then
    chown -R "$helper_user:$helper_user" "$capture_dir"
  fi
  chmod 700 "$capture_dir"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required for the camera helper but was not found."
    exit 1
  fi

  if ! command -v rpicam-still >/dev/null 2>&1 && ! command -v libcamera-still >/dev/null 2>&1; then
    log "Warning: neither rpicam-still nor libcamera-still was found on the host. Install Raspberry Pi camera apps before using camera workflows."
  fi

  log "Installing camera helper service"
  cat > "$service_file" <<EOF
[Unit]
Description=Integritas Pi Camera Helper
After=network.target

[Service]
Type=simple
User=$helper_user
$supplementary_groups
WorkingDirectory=$APP_DIR
Environment=CAMERA_HELPER_HOST=0.0.0.0
Environment=CAMERA_HELPER_PORT=$CAMERA_HELPER_PORT
Environment=CAMERA_HELPER_TOKEN=$CAMERA_HELPER_TOKEN
Environment=CAMERA_CAPTURE_DIR=$capture_dir
Environment=CAMERA_CONTAINER_CAPTURE_DIR=$CAMERA_CAPTURE_DIR
Environment=CAMERA_MAX_DURATION_SECONDS=$CAMERA_MAX_DURATION_SECONDS
Environment=CAMERA_PHOTO_COMMAND=$CAMERA_PHOTO_COMMAND
Environment=CAMERA_VIDEO_COMMAND=$CAMERA_VIDEO_COMMAND
Environment=INTEGRITAS_DOCKER_SUBNET=$INTEGRITAS_DOCKER_SUBNET
Environment=INTEGRITAS_DOCKER_GATEWAY=$INTEGRITAS_DOCKER_GATEWAY
ExecStartPre=+/bin/sh -c 'if command -v iptables >/dev/null 2>&1; then iptables -C INPUT -s $INTEGRITAS_DOCKER_SUBNET -p tcp --dport $CAMERA_HELPER_PORT -j ACCEPT 2>/dev/null || iptables -I INPUT -s $INTEGRITAS_DOCKER_SUBNET -p tcp --dport $CAMERA_HELPER_PORT -j ACCEPT; fi'
ExecStart=/usr/bin/python3 $APP_DIR/camera-helper/integritas_camera_helper.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

  chmod 600 "$service_file"
  systemctl daemon-reload
  systemctl enable --now integritas-pi-camera-helper.service
}

generate_tls_cert() {
  log "Generating self-signed TLS certificate"
  (
    cd "$APP_DIR"
    DATA_DIR="$DATA_DIR" INTEGRITAS_TLS_IP="$(get_ip_address)" bash scripts/generate-tls-cert.sh
  )
}

start_app() {
  log "Starting Docker services"
  cd "$APP_DIR"
  if is_truthy "$DEV_MODE"; then
    docker compose build frontend backend
  else
    docker compose pull frontend backend
  fi
  ensure_compose_network
  docker compose up -d
}

ensure_compose_network() {
  local current_gateway

  if ! docker network inspect integritas-pi >/dev/null 2>&1; then
    return
  fi

  current_gateway="$(docker network inspect integritas-pi --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || true)"
  if [ "$current_gateway" = "$INTEGRITAS_DOCKER_GATEWAY" ]; then
    return
  fi

  log "Recreating Docker network integritas-pi with gateway $INTEGRITAS_DOCKER_GATEWAY"
  docker compose down
  docker network rm integritas-pi >/dev/null 2>&1 || true
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
    echo "https://$ip_address:$FRONTEND_PORT"
  else
    echo "https://<pi-ip>:$FRONTEND_PORT"
  fi
  echo
  echo "Local URL on the Pi: https://localhost:$FRONTEND_PORT"
  echo
  echo "Your browser will warn about the self-signed certificate. That is expected."
  echo "Choose Advanced / Continue to proceed. Traffic is encrypted after that."
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
  ensure_camera_helper_token
  detect_docker_gid
  detect_gpio_gid
  normalize_mqtt_broker_config
  normalize_dev_mode
  download_app
  resolve_images
  prepare_runtime_directories
  record_applied_manifest
  write_env_file
  write_compose_override
  install_camera_helper
  generate_tls_cert
  install_cli
  start_app
  print_success_message
}

main "$@"
