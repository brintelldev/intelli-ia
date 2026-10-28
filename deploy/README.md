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

## Backup e restauração verificada

```bash
BACKUP_DIR=/var/backups/intellisuite ./scripts/backup.sh
./scripts/restore-check.sh /var/backups/intellisuite/intellisuite-AAAAmmddTHHMMSSZ.dump
```

O backup usa `pg_dump --format=custom`, `umask 077`, escrita temporária e rename atômico. Não remove cópias anteriores. Para a infraestrutura local sem `.env.production`, informe `POSTGRES_CONTAINER=intellisuite-postgres-1`. Guarde uma cópia cifrada em outro dispositivo conforme a política da organização; não envie dumps pelo Git ou pelo chat.

`restore-check.sh` cria um Postgres descartável **sem rede**, restaura o dump, verifica pgvector, dimensão 384 e trechos órfãos e remove somente esse container ao terminar. Nunca aponta para o banco de produção. Backups contêm dados do app; uma exclusão no sistema não apaga cópias antigas já arquivadas.

## Agendamento, disco, firewall e apresentação

O arquivo `deploy/cron/intellisuite.example` contém backup diário, smoke horário e limpeza semanal de imagens dangling do próprio app. Revise usuário/caminhos e instale no VPS somente depois de um smoke bem-sucedido. Configure as senhas do smoke e, se desejar alerta, `SMOKE_ALERT_WEBHOOK` num arquivo `/etc/intellisuite-monitor.env` com permissão 600. Sem webhook o monitor registra a falha localmente e retorna código 1; não envia mensagem.

Confirme primeiro a porta SSH real do host. Para SSH padrão, o objetivo é liberar somente 22/80/443; não publique 3000, 5432, 5001 ou 8080. Os serviços internos do Compose não precisam de portas públicas.

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Depois, programe um reboot de teste e confirme que Docker/Nginx estão habilitados no boot e que todos os serviços retornam. O Compose usa `restart: unless-stopped`. **Firewall, cron, reboot, HTTPS e alerta externo não foram instalados/verificados no VPS nesta execução: dependem de acesso ao host e de um destino de alerta definido pelo operador.**

## Cópia local sem internet

A preparação não copia chaves de API. Execute no computador da apresentação enquanto ainda houver internet, depois de gravar o roteiro e aquecer os embeddings:

```bash
docker build --target runner -t intellisuite:verification .
# Imagens de postgres/docling/searxng devem estar baixadas antes de desligar a rede.
POSTGRES_CONTAINER=intellisuite-postgres-1 BACKUP_DIR=/caminho/privado ./scripts/backup.sh
./scripts/prepare-offline.sh /caminho/privado/intellisuite-AAAAmmddTHHMMSSZ.dump
./scripts/offline-start.sh   # mantém a ponte local no terminal
# Em outro terminal:
./scripts/smoke.sh http://127.0.0.1:3030
```

A cópia usa outro volume de banco e porta 3030 apenas em loopback, restaura **somente na criação do volume vazio**, ativa o modo `fallback` na cópia e monta `.cache` dos embeddings como leitura. A rede Docker é `internal: true`, sem saída para internet. O Docker não publica portas dessa rede neste runtime; `offline-start.sh` usa uma ponte Node no host, escutando somente `127.0.0.1:3030`, que encaminha os bytes por stdin/stdout de `docker exec` ao loopback do app. Nenhuma rede com internet é adicionada aos containers. Mantenha o processo da ponte aberto; Ctrl+C fecha somente a ponte. Serviços opcionais podem demorar a iniciar; confira `/api/health`. O smoke usa credenciais do banco restaurado; passe `SMOKE_*_PASSWORD` se elas foram alteradas.

Não substitua o dump esperando que um volume já inicializado seja restaurado novamente. Para outra cópia, use outro nome de projeto/volume. O banco principal fica separado. Para transportar a stack a outro computador, leve o dump privado, `.cache`, este checkout e imagens exportadas com `docker save`; no destino use `docker load`, gere novos segredos locais e confira arquitetura arm64/amd64. O roteiro de segurança usa o PDF digital; prepare e verifique separadamente os modelos de OCR antes de depender de documentos escaneados offline.

Ao concluir um ensaio, `docker compose --env-file .env.offline -p intellisuite-offline -f compose.offline.yaml down` para a cópia preserva o seu banco restaurado. Nenhuma configuração do banco principal é alterada por essa cópia.

**Ensaio local de 27/10/2026:** backend carregou embeddings do cache sem download; saúde dos três serviços e smoke de perfis/stream passaram na rede interna. Saída externa do app foi testada e bloqueada. O acesso de loopback exige a ponte Node descrita acima. O backup privado fica em `.backups/` (ignorado pelo Git), e os segredos novos da cópia ficam em `.env.offline`. O VPS ainda requer as validações próprias do host.

O roteiro inteiro também passou na cópia sem internet: seis etapas usaram replay e a pesquisa atingiu um cache local válido. No QA sem caches normais, as sete etapas usaram replay. O smoke confirmou stream em cinco linhas (primeira em 0,05 s e última em 4,07 s), sem buffering.
