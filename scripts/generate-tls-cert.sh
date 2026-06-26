#!/usr/bin/env bash
# Generate a self-signed TLS certificate for the integritas-pi frontend (nginx).
# Used by install.sh and manually before `docker compose up` when not using the installer.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATA_DIR="${DATA_DIR:-./data}"
case "$DATA_DIR" in
  /*) CERT_DIR="$DATA_DIR/certs" ;;
  ./*) CERT_DIR="$REPO_ROOT/${DATA_DIR#./}/certs" ;;
  *) CERT_DIR="$REPO_ROOT/$DATA_DIR/certs" ;;
esac

CERT_DAYS="${INTEGRITAS_TLS_CERT_DAYS:-825}"
LAN_IP="${INTEGRITAS_TLS_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ] && [ "${INTEGRITAS_TLS_FORCE:-}" != "1" ]; then
  echo "TLS certificate already exists in $CERT_DIR (set INTEGRITAS_TLS_FORCE=1 to regenerate)"
  exit 0
fi

OPENSSL_CNF="$CERT_DIR/openssl.cnf"
cat > "$OPENSSL_CNF" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext
x509_extensions = req_ext

[dn]
CN = integritas-pi

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = integritas-pi
IP.1 = 127.0.0.1
EOF

if [ -n "$LAN_IP" ]; then
  printf 'IP.2 = %s\n' "$LAN_IP" >> "$OPENSSL_CNF"
fi

openssl req -x509 -nodes -days "$CERT_DAYS" -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -config "$OPENSSL_CNF" \
  -extensions req_ext

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"
rm -f "$OPENSSL_CNF"

echo "TLS certificate written to $CERT_DIR"
