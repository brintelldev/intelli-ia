#!/usr/bin/env bash
# Gera somente segredos novos da instância local. Não copia .env.local nem chaves LLM.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BACKUP_FILE="${1:?uso: scripts/prepare-offline.sh /caminho/backup.dump}"
test -f "$BACKUP_FILE"
case "$BACKUP_FILE" in /*) ;; *) echo 'Use o caminho absoluto do backup.' >&2; exit 2;; esac
if [ -e .env.offline ]; then echo '.env.offline já existe: preservado. Atualize só OFFLINE_BACKUP se necessário.'; exit 0; fi
{
  printf 'OFFLINE_PORT=3030\nOFFLINE_BACKUP=%s\n' "$BACKUP_FILE"
  printf 'OFFLINE_POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)"
  printf 'OFFLINE_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'OFFLINE_SEARXNG_SECRET=%s\n' "$(openssl rand -hex 32)"
} > .env.offline
printf 'Instância local preparada: .env.offline privado (sem chaves dos provedores).\n'
