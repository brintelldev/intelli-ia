#!/usr/bin/env bash
# Smoke test da stack publicada (T-04b). Portão de saída de cada bloco e verificação do dia da demo.
#   scripts/smoke.sh https://seu-dominio.com.br
#   SMOKE_INSECURE=1 scripts/smoke.sh https://IP   # certificado autoassinado
# Senhas dos usuários do seed (troque se você mudou): SMOKE_ADMIN_PASSWORD, SMOKE_ANALISTA_PASSWORD,
# SMOKE_LEITOR_PASSWORD. Precisa de curl e python3. Código de saída: 0 = tudo passou.
# Limite de login: 5/min por IP. Cada execução faz 3 logins; duas seguidas em < 1 min dão 429.
set -u

URL="${1:-}"
[ -z "$URL" ] && { echo "uso: $0 <url-base>   ex.: $0 https://intellisuite.exemplo.com.br" >&2; exit 2; }
URL="${URL%/}"
command -v curl >/dev/null || { echo "curl não encontrado" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 não encontrado" >&2; exit 2; }

CURL=(curl -sS --max-time 20)
[ "${SMOKE_INSECURE:-}" = "1" ] && CURL+=(-k)

J="$(mktemp -d)"
trap 'rm -rf "$J"' EXIT
FAILS=0

ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✘\033[0m %s\n' "$1"; FAILS=$((FAILS + 1)); }
pass_if() { if [ "$1" = "0" ]; then ok "$2"; else fail "$2${3:+  → $3}"; fi; }

# status HTTP e destino do redirect de uma rota, com ou sem cookie: "307 /login"
probe() { # <caminho> [jar]
  local jar=() r
  [ -n "${2:-}" ] && jar=(-b "$2")
  r=$("${CURL[@]}" -o /dev/null ${jar[@]+"${jar[@]}"} -w '%{http_code} %{redirect_url}' "$URL$1" 2>/dev/null) || r="000 -"
  printf '%s' "${r#"$URL"}" | sed "s#$URL##"
}

login() { # <email> <senha> <jar>  -> imprime o status HTTP
  "${CURL[@]}" -o /dev/null -c "$3" -w '%{http_code}' -X POST "$URL/api/auth/sign-in/email" \
    -H "Origin: $URL" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" 2>/dev/null || printf '000'
}

echo "Smoke test: $URL"

echo "1) Saúde da stack (/api/health)"
HEALTH=$("${CURL[@]}" -w '\n%{http_code}' "$URL/api/health" 2>/dev/null) || HEALTH=$'\n000'
CODE="${HEALTH##*$'\n'}"; BODY="${HEALTH%$'\n'*}"
if [ "$CODE" = "000" ]; then
  fail "sem resposta de $URL/api/health (app fora do ar, DNS ou firewall?)"
else
  python3 - "$BODY" <<'PY' && true
import json, sys
try:
    d = json.loads(sys.argv[1])
except Exception:
    print("  \033[31m✘\033[0m resposta não é JSON (proxy devolvendo página de erro?)"); sys.exit(1)
bad = 0
for k in ("db", "docling", "searxng"):
    c = d.get(k, {})
    if c.get("ok"):
        print(f"  \033[32m✔\033[0m {k:8} ok ({c.get('ms')} ms)")
    else:
        print(f"  \033[31m✘\033[0m {k:8} FORA"); bad += 1
sys.exit(bad)
PY
  RC=$?; [ "$RC" -ne 0 ] && FAILS=$((FAILS + RC))
fi

echo "2) Páginas públicas e proteção de rotas"
LOGIN_CODE=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$URL/login" 2>/dev/null || echo 000)
pass_if "$([ "$LOGIN_CODE" = "200" ] && echo 0 || echo 1)" "/login abre (HTTP $LOGIN_CODE)"
R=$(probe /home); pass_if "$([ "$R" = "307 /login" ] && echo 0 || echo 1)" "/home sem sessão manda para /login" "recebeu: $R"

echo "3) Login dos 3 perfis e matriz de acesso"
ADMIN_PW="${SMOKE_ADMIN_PASSWORD:-Admin@2025}"
ANALISTA_PW="${SMOKE_ANALISTA_PASSWORD:-Analista@2025}"
LEITOR_PW="${SMOKE_LEITOR_PASSWORD:-Leitor@2025}"
LOGINS_OK=1
for u in "admin|$ADMIN_PW" "analista|$ANALISTA_PW" "leitor|$LEITOR_PW"; do
  name="${u%%|*}"; pw="${u#*|}"
  S=$(login "$name@intellisuite.com" "$pw" "$J/$name")
  case "$S" in
    200) ok "login $name" ;;
    429) fail "login $name: limite de 5 logins/min atingido (rode de novo em 1 minuto)"; LOGINS_OK=0 ;;
    403) fail "login $name recusado (HTTP 403): origem inválida. A URL usada aqui precisa ser IGUAL à BETTER_AUTH_URL do servidor (mesmo esquema, host e porta; localhost ≠ 127.0.0.1)"; LOGINS_OK=0 ;;
    401) fail "login $name: e-mail ou senha incorretos (senha do seed alterada? use SMOKE_*_PASSWORD)"; LOGINS_OK=0 ;;
    *)   fail "login $name falhou (HTTP $S)"; LOGINS_OK=0 ;;
  esac
done
if [ "$LOGINS_OK" = "1" ]; then
  R=$(probe /home "$J/leitor");        pass_if "$([ "${R%% *}" = "200" ] && echo 0 || echo 1)" "leitor abre /home" "recebeu: $R"
  R=$(probe /documentos "$J/leitor");  pass_if "$([ "$R" = "307 /403" ] && echo 0 || echo 1)" "leitor em /documentos vai para /403" "recebeu: $R"
  R=$(probe /documentos "$J/analista"); pass_if "$([ "${R%% *}" = "200" ] && echo 0 || echo 1)" "analista abre /documentos" "recebeu: $R"
  R=$(probe /admin/llm "$J/analista"); pass_if "$([ "$R" = "307 /403" ] && echo 0 || echo 1)" "analista em /admin/llm vai para /403" "recebeu: $R"
  R=$(probe /admin/llm "$J/admin");    pass_if "$([ "${R%% *}" = "200" ] && echo 0 || echo 1)" "admin abre /admin/llm" "recebeu: $R"
fi

echo "4) Streaming chega linha a linha (sem buffering no proxy)"
if [ -s "$J/admin" ]; then
  # 5 linhas, uma por segundo. Com buffering, todas chegam juntas no fim (primeira ≈ última).
  # --compressed: o navegador sempre anuncia Accept-Encoding: gzip, e é aí que um Nginx com gzip em
  # text/plain + buffering segura a resposta. Sem isso o teste não reproduziria a falha real.
  T=$("${CURL[@]}" -N --compressed -b "$J/admin" "$URL/api/diag/stream" 2>/dev/null | python3 -c '
import sys, time
t0 = time.time(); stamps = []
for line in sys.stdin:
    stamps.append(time.time() - t0)
print(len(stamps), "%.2f" % stamps[0] if stamps else "-1", "%.2f" % stamps[-1] if stamps else "-1")
') || T="0 -1 -1"
  set -- $T; N=$1; FIRST=$2; LAST=$3
  GOOD=$(python3 -c "print(0 if int('$N')==5 and float('$FIRST')<2.0 and float('$LAST')-float('$FIRST')>=3.0 else 1)" 2>/dev/null || echo 1)
  pass_if "$GOOD" "5 linhas em tempo real (primeira em ${FIRST}s, última em ${LAST}s)" "esperado: primeira < 2s e última ≥ 3s depois; com buffering chegam todas juntas. Confira no Nginx: proxy_buffering off e nenhum gzip em text/plain (ou outro módulo que retenha a resposta)"
else
  fail "sem sessão de admin: pulei o teste de streaming"
fi

echo
if [ "$FAILS" -eq 0 ]; then printf '\033[32mTUDO OK\033[0m\n'; exit 0; fi
printf '\033[31m%s FALHA(S)\033[0m\n' "$FAILS"; exit 1
