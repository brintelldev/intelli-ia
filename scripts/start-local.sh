#!/usr/bin/env bash
# Inicia a instalação local já preparada; preserva banco, volumes e credenciais.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null
command -v npm >/dev/null
if ! docker info >/dev/null 2>&1; then
  if [ "$(uname -s)" = Darwin ]; then open -a OrbStack; fi
  for attempt in {1..60}; do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker info >/dev/null 2>&1 || { echo 'Inicie o Docker e execute novamente.' >&2; exit 1; }
fi
for service in postgres docling searxng; do
  container="intellisuite-${service}-1"
  docker inspect "$container" >/dev/null 2>&1 || { echo 'Instalação inicial incompleta. Siga o README para criar os serviços.' >&2; exit 1; }
  docker start "$container" >/dev/null
done
exec node --env-file=.env.local --import tsx scripts/start-local-runtime.ts "$@"
