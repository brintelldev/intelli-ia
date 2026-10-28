#!/usr/bin/env bash
# Não instala agendamento nem envia mensagens sem URL configurada pelo operador.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${1:?uso: scripts/monitor.sh https://dominio}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
if "$ROOT/scripts/smoke.sh" "$BASE_URL" > "$LOG" 2>&1; then
  printf 'Smoke OK: %s\n' "$BASE_URL"
  exit 0
fi
cat "$LOG"
if [ -n "${SMOKE_ALERT_WEBHOOK:-}" ]; then
  curl --fail --silent --show-error --max-time 10 -H 'Content-Type: application/json' --data '{"text":"IntelliSuite: smoke test falhou. Consulte o log privado do host."}' "$SMOKE_ALERT_WEBHOOK" >/dev/null
else
  printf 'Alerta externo não configurado (SMOKE_ALERT_WEBHOOK).\n' >&2
fi
exit 1
