#!/usr/bin/env bash
# Backup consistente, privado e atômico. Não apaga backups anteriores.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/intellisuite}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/intellisuite-$(date -u +%Y%m%dT%H%M%SZ).dump"
TEMP_FILE="$BACKUP_FILE.tmp"
trap 'rm -f "$TEMP_FILE"' EXIT
cd "$ROOT"
if [ -n "${POSTGRES_CONTAINER:-}" ]; then
  docker exec "$POSTGRES_CONTAINER" pg_dump -U intellisuite -d intellisuite --format=custom > "$TEMP_FILE"
else
  docker compose -f compose.yaml exec -T postgres pg_dump -U intellisuite -d intellisuite --format=custom > "$TEMP_FILE"
fi
test -s "$TEMP_FILE"
mv "$TEMP_FILE" "$BACKUP_FILE"
printf 'Backup criado: %s\n' "$BACKUP_FILE"
