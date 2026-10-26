# Deploy (VPS com Docker + Nginx)

A aplicação roda em Docker (`compose.yaml`) e o Nginx do servidor fica na frente (`deploy/nginx/intellisuite.conf`).
Depois de qualquer deploy, rode o teste de fumaça: ele deve terminar com **TUDO OK**.

```bash
./scripts/smoke.sh https://SEU_DOMINIO
```

**Dimensionamento (medido):** stack ociosa ≈ 1,1 GB de RAM; o docling chega a ~1,7 GiB convertendo um PDF de 1 página e usa mais com PDFs escaneados grandes.
Recomendado **4 vCPU, 8 GB de RAM e 40 GB de disco**. A imagem do docling sozinha tem ~7 GB.

**Atenção:** as senhas das contas de demonstração criadas pelo seed são **públicas** (estão no README). Defina `SEED_ADMIN_PASSWORD`,
`SEED_ANALISTA_PASSWORD` e `SEED_LEITOR_PASSWORD` no `.env.production` **antes do primeiro deploy**.

**Contas dos provedores de IA (confira uma vez):**
- Use projetos/organizações **com faturamento ativo** nos três provedores.
- **Google (Gemini):** projetos criados a partir de 26/10/2026 vêm com o **registro de logs ligado por padrão**, guardando prompts e respostas no seu projeto (padrão de 55 dias). No console do projeto, desligue o registro ou reduza o prazo, e **não** compartilhe datasets com o Google (isso muda os termos para o uso não pago).
- A política de dados de cada provedor está resumida em `/privacidade`; reconfira se mudar de plano ou de modelo.

## Primeiro deploy no VPS

> **Testado localmente** em 26/10/2026: a stack de produção completa (`compose.yaml` + Nginx com `deploy/nginx/intellisuite.conf`) subiu do zero, migrou, semeou e passou no `scripts/smoke.sh`. **Não testado:** HTTPS/Certbot e a arquitetura **amd64** (o teste foi em arm64); o primeiro deploy no VPS valida essas duas coisas.

**Antes:** DNS do domínio apontando (registro A) para o IP do VPS; Docker + Compose v2, Nginx e Certbot instalados; porta 3000 livre no host (senão defina `APP_PORT` e ajuste o `upstream` do Nginx); repositório acessível pelo VPS.

```bash
sudo mkdir -p /var/www/intellisuite && sudo chown $USER:$USER /var/www/intellisuite
cd /var/www/intellisuite && git clone https://github.com/brintelldev/intelli-ia.git .

# 1) Arquivos de ambiente CRIADOS NO SERVIDOR (os segredos nunca viajam pelo chat ou pelo git).
DOMINIO="exemplo.com.br"     # troque
cat > .env <<ENVFILE
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
SEARXNG_SECRET="$(openssl rand -hex 32)"
NEXT_PUBLIC_APP_URL="https://$DOMINIO"
ENVFILE
cat > .env.production <<ENVFILE
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="https://$DOMINIO"
NEXT_PUBLIC_APP_URL="https://$DOMINIO"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
GOOGLE_GENERATIVE_AI_API_KEY=""
TAVILY_API_KEY=""
SEED_ADMIN_PASSWORD="$(openssl rand -base64 18)"
SEED_ANALISTA_PASSWORD="$(openssl rand -base64 18)"
SEED_LEITOR_PASSWORD="$(openssl rand -base64 18)"
ENVFILE
chmod 600 .env .env.production
nano .env.production    # preencha as chaves de API; anote as 3 senhas geradas

# 2) Sobe tudo (1ª vez: ~5–10 min de build + ~7 GB da imagem do docling).
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps            # postgres/docling/searxng/nextjs healthy; migrate Exited (0)
docker compose -f compose.yaml logs migrate  # migrations aplicadas e "seed ok"; sem aviso de senha padrão

# 3) Nginx + HTTPS (instruções no cabeçalho de `nginx/intellisuite.conf`).
sudo cp deploy/nginx/intellisuite.conf /etc/nginx/sites-available/intellisuite
sudo sed -i "s/SEU_DOMINIO/$DOMINIO/" /etc/nginx/sites-available/intellisuite
sudo ln -s /etc/nginx/sites-available/intellisuite /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d $DOMINIO

# 4) PORTÃO DE SAÍDA: o smoke tem de dar "TUDO OK".
SMOKE_ADMIN_PASSWORD='...' SMOKE_ANALISTA_PASSWORD='...' SMOKE_LEITOR_PASSWORD='...' \
  ./scripts/smoke.sh https://$DOMINIO
```

**Se o smoke falhar:**

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| passo 1: "sem resposta" | DNS, firewall, Nginx fora ou app fora | `curl -I https://$DOMINIO`, `docker compose -f compose.yaml ps`, `sudo nginx -t` |
| passo 1: `db` FORA | migrations não rodaram ou banco fora | `docker compose -f compose.yaml logs migrate postgres` |
| passo 1: `docling`/`searxng` FORA | container fora ou ainda subindo (o docling leva ~1 min) | `docker compose -f compose.yaml ps` e logs do serviço |
| passo 3: login **403** "origem inválida" | `BETTER_AUTH_URL` diferente da URL pública (esquema, host ou porta) | corrigir em `.env.production` e `docker compose -f compose.yaml up -d` |
| passo 3: login **401** | senha diferente da esperada | passe `SMOKE_*_PASSWORD` com as senhas do `.env.production` |
| passo 3: login **429** | limite de 5 logins/min por IP (cada execução faz 3) | aguardar 1 minuto |
| passo 4: linhas chegam todas juntas | Nginx segurando a resposta (buffering ou `gzip` em `text/plain`) | conferir `deploy/nginx/intellisuite.conf` e o `nginx.conf` global |

**Pontos que só o VPS valida:** cookie de sessão `Secure` e cabeçalhos `X-Forwarded-*` atrás de HTTPS; a imagem do app e do docling em **amd64**; o primeiro `docker compose ... up` baixando ~7 GB; o IP do cliente no limite de login vindo do `X-Forwarded-For`.


## Atualizações

```bash
cd /var/www/intellisuite
git pull origin main
docker compose -f compose.yaml up -d --build   # o serviço migrate roda sozinho antes do nextjs
./scripts/smoke.sh https://$DOMINIO
```

Nunca use `docker compose down -v` em produção: apaga o banco de dados.
