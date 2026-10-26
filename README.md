# Intelli AI (IntelliSuite)

Plataforma de IA com 4 módulos: análise de documentos, pesquisa web, chat RAG e painel admin.
Deploy em produção: [`deploy/README.md`](deploy/README.md).

## Pré-requisitos

- Node 24 LTS
- Docker com Compose v2 (Docker Desktop, OrbStack ou Docker Engine). Reserve ~8 GB de RAM para os containers (o docling é o mais pesado)

## Setup local

```bash
cp .env.example .env.local      # preencha as chaves (ANTHROPIC, OPENAI, GOOGLE, TAVILY) quando chegar nas tarefas que usam
cat > .env <<EOF                # lido só pelo Docker Compose
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
SEARXNG_SECRET="$(openssl rand -hex 32)"
EOF
docker compose up -d            # postgres (pgvector), docling e searxng
npm install
npm run dev                     # http://localhost:3000 (se estiver ocupada: npx next dev -p 3001)
```

Se mudar a porta, ajuste `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` no `.env.local`: o Better Auth valida a origem das requisições.

## Usuários de demonstração (seed)

`npx prisma migrate dev` (ou `npx prisma db seed`) cria 3 contas. **Troque as senhas em qualquer ambiente real.**

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@intellisuite.com | Admin@2025 |
| Analista | analista@intellisuite.com | Analista@2025 |
| Leitor | leitor@intellisuite.com | Leitor@2025 |

## Testes

```bash
npm test             # node:test + tsx: permissões (rbac), perfis do Better Auth, roteamento da Home, formatação
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm run check-models # confere modelos de IA, preços e chaves (rode antes de cada apresentação; --offline e --no-calls também existem)
```

> O `next build` pode passar com um erro que só o `next dev` mostra (ex.: valores instáveis no pré-render). Depois de mexer em páginas, abra a rota no dev e procure `Error` no log.

Use a mesma `POSTGRES_PASSWORD` do `.env` na `DATABASE_URL` do `.env.local`.

## Infra de dev

`docker compose up -d` sobe só a infraestrutura; o Next roda no host. As portas ficam em `127.0.0.1`:

| Serviço | Porta | Verificação |
|---|---|---|
| PostgreSQL 17 + pgvector | 5432 | `docker compose exec postgres psql -U intellisuite -c "SELECT version();"` |
| docling-serve | 5001 | `curl localhost:5001/health` |
| SearXNG | 8080 | `curl "localhost:8080/search?q=teste&format=json"` |

```bash
docker compose ps               # os 3 devem estar "healthy"
docker compose logs -f searxng  # logs de um serviço
docker compose down             # para tudo, mantém os dados
```

> Nunca use `docker compose down -v` em produção: apaga o banco.

Em produção use `docker compose -f compose.yaml ...` (sem o `compose.override.yaml` de dev). Detalhes em [`deploy/README.md`](deploy/README.md).

## Deploy (produção)

Stack completa em Docker (`compose.yaml`) com Nginx do host na frente. O roteiro do VPS, a tabela de erros e as configurações estão em [`deploy/README.md`](deploy/README.md). O portão de saída de cada bloco é:

```bash
./scripts/smoke.sh https://SEU_DOMINIO    # saúde, login dos 3 perfis, matriz de acesso e streaming
```

No servidor defina `SEED_ADMIN_PASSWORD`, `SEED_ANALISTA_PASSWORD` e `SEED_LEITOR_PASSWORD` no `.env.production` **antes do primeiro deploy**: as senhas padrão da tabela acima são públicas.

