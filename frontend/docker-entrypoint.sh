#!/bin/sh
set -eu

BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-https://salon-server.dartsalon.cloud}"

if [ -z "${BACKEND_HOST:-}" ]; then
  BACKEND_HOST="$(printf '%s' "$BACKEND_UPSTREAM" | sed -E 's|^https?://||' | sed -E 's|/.*$||')"
fi

export BACKEND_UPSTREAM BACKEND_HOST

envsubst '${BACKEND_UPSTREAM} ${BACKEND_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'