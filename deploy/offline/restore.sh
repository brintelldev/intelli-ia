#!/bin/sh
# Executado pelo Postgres apenas ao inicializar um volume NOVO da cópia local.
set -eu
pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --no-acl --exit-on-error /backup/source.dump
psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" <<'SQL'
INSERT INTO "AppSetting" (key,value) VALUES ('presentationMode','"fallback"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value='"fallback"'::jsonb;
SQL
