#!/usr/bin/env bash
# Restore somente em container descartável, sem rede/portas. Nunca aponta para produção.
set -euo pipefail
BACKUP_FILE="${1:?uso: scripts/restore-check.sh /caminho/backup.dump}"
test -f "$BACKUP_FILE"
TEST_NAME="intellisuite-restore-check-$(date +%s)-$$"
cleanup() { docker rm -f -v "$TEST_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$TEST_NAME" --network none --label com.intellisuite.disposable=true -e POSTGRES_PASSWORD=restore-test-only-ephemeral pgvector/pgvector:0.8.7-pg17 >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$TEST_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$TEST_NAME" pg_restore --username=postgres --dbname=postgres --no-owner --no-acl --exit-on-error < "$BACKUP_FILE"
docker exec -i "$TEST_NAME" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') THEN RAISE EXCEPTION 'pgvector ausente'; END IF;
  IF EXISTS (SELECT 1 FROM document_chunks WHERE vector_dims(embedding)<>384) THEN RAISE EXCEPTION 'Dimensão vetorial inválida'; END IF;
  IF EXISTS (SELECT 1 FROM document_chunks c LEFT JOIN "DocumentSource" d ON d.id=c.source_id WHERE d.id IS NULL) THEN RAISE EXCEPTION 'Trechos órfãos'; END IF;
END $$;
SELECT json_build_object('users',(SELECT count(*) FROM "user"),'documents',(SELECT count(*) FROM "DocumentSource"),'chunks',(SELECT count(*) FROM document_chunks),'reports',(SELECT count(*) FROM "ResearchReport"),'events',(SELECT count(*) FROM "UsageEvent")) AS restored_counts;
SQL
printf 'Restore validado em banco descartável; dados, pgvector e integridade conferidos.\n'
