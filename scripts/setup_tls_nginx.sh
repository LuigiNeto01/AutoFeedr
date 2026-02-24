#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-autofeedr.eyelid.com.br}"
EMAIL="${2:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/infra/certbot/conf/live/${DOMAIN}"
WWW_DIR="${ROOT_DIR}/infra/certbot/www"

mkdir -p "${CERT_DIR}" "${WWW_DIR}"

if [[ ! -s "${CERT_DIR}/privkey.pem" || ! -s "${CERT_DIR}/fullchain.pem" ]]; then
  echo "[tls] generating temporary self-signed certificate for ${DOMAIN}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1
fi

echo "[tls] starting services (including nginx)"
cd "${ROOT_DIR}"
docker compose up -d postgres backend worker frontend nginx

CERTBOT_ARGS=(
  certonly
  --webroot
  -w /var/www/certbot
  -d "${DOMAIN}"
  --rsa-key-size 4096
  --non-interactive
  --agree-tos
  --keep-until-expiring
)

if [[ -n "${EMAIL}" ]]; then
  CERTBOT_ARGS+=(--email "${EMAIL}")
else
  echo "[tls] warning: issuing certificate without registration email"
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

echo "[tls] requesting/updating Let's Encrypt certificate"
docker compose --profile ops run --rm --no-deps certbot "${CERTBOT_ARGS[@]}"

echo "[tls] reloading nginx"
docker compose exec nginx nginx -s reload

echo "[tls] done: https://${DOMAIN}"
