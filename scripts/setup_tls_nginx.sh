#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-autofeedr.eyelid.com.br}"
EMAIL="${2:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/infra/certbot/conf/live/${DOMAIN}"
WWW_DIR="${ROOT_DIR}/infra/certbot/www"
RENEWAL_CONF="${ROOT_DIR}/infra/certbot/conf/renewal/${DOMAIN}.conf"

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
  --cert-name "${DOMAIN}"
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
if [[ ! -f "${RENEWAL_CONF}" && -d "${CERT_DIR}" ]]; then
  echo "[tls] removing temporary certificate path before certbot issuance"
  rm -rf "${ROOT_DIR}/infra/certbot/conf/live/${DOMAIN}" \
         "${ROOT_DIR}/infra/certbot/conf/archive/${DOMAIN}"
fi
docker compose --profile ops run --rm --no-deps certbot "${CERTBOT_ARGS[@]}"

if [[ ! -f "${ROOT_DIR}/infra/certbot/conf/renewal/${DOMAIN}.conf" ]]; then
  ALT_DIR="$(ls -d "${ROOT_DIR}/infra/certbot/conf/live/${DOMAIN}"-* 2>/dev/null | sort | tail -n 1 || true)"
  if [[ -n "${ALT_DIR}" && -d "${ALT_DIR}" ]]; then
    echo "[tls] creating compatibility alias for nginx cert path"
    rm -rf "${CERT_DIR}"
    mkdir -p "${CERT_DIR}"
    ln -sf "../$(basename "${ALT_DIR}")/fullchain.pem" "${CERT_DIR}/fullchain.pem"
    ln -sf "../$(basename "${ALT_DIR}")/privkey.pem" "${CERT_DIR}/privkey.pem"
  fi
fi

echo "[tls] reloading nginx"
docker compose exec nginx nginx -s reload

echo "[tls] done: https://${DOMAIN}"
