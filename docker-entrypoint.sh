#!/bin/sh
# Applique les migrations (idempotent, attend la base) puis démarre le serveur.
set -e

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  node migrate.cjs
fi

exec node server.js
