#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --env-file .env.offline -p intellisuite-offline -f compose.offline.yaml up -d --pull never
exec node --env-file=.env.offline scripts/offline-bridge.mjs
