# Intelli Insights

Aplicação com análise de PDFs, pesquisa web com fontes, chat sobre uma base autorizada e administração de modelos, usuários, custos e aprovações. Interface em português, Next.js 16, AI SDK 7, Better Auth e PostgreSQL 17 com pgvector. Embeddings multilíngues de 384 dimensões rodam localmente.

[Roteiro da demonstração](DEMO_ROTEIRO.md) · [QA e pendências](QA_checklist.md) · [Deploy e operação](deploy/README.md)

## Executar localmente

Requer Node 24, Docker/Compose v2 e cerca de 8 GB de RAM disponíveis. O docling é o serviço mais pesado. Dependências e imagens estão fixadas no lockfile e na configuração Docker.

```bash
cp .env.example .env.local
# Preencha DATABASE_URL, BETTER_AUTH_SECRET e as chaves que pretende usar.
# O Compose usa .env separado, com POSTGRES_PASSWORD e SEARXNG_SECRET.
# Gere os segredos localmente com openssl rand -hex 32; não os publique.
docker compose up -d
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Acesse `http://localhost:3000`. Se usar `npm run dev -- --port 3001`, ajuste `BETTER_AUTH_URL` e `NEXT_PUBLIC_APP_URL` para essa mesma origem. Use na `DATABASE_URL` a senha do Postgres definida no `.env`.

As portas de desenvolvimento ficam em loopback: Postgres 5432, docling 5001, SearXNG 8080. `docker compose ps` deve mostrar os três serviços saudáveis. `docker compose down` preserva os volumes.

## Perfis e contas de demonstração

O seed cria as contas abaixo somente se ainda não existirem. Não altera senhas nem configurações existentes.

| Perfil | E-mail | Senha pública de demonstração | Acesso |
|---|---|---|---|
| Admin | admin@intellisuite.com | Admin@2025 | Todos os módulos e controles |
| Analista | analista@intellisuite.com | Analista@2025 | Documentos, pesquisa, chat e dashboard de leitura |
| Leitor | leitor@intellisuite.com | Leitor@2025 | Chat/histórico em leitura e conteúdo compartilhado autorizado |

Em ambiente público, defina `SEED_ADMIN_PASSWORD`, `SEED_ANALISTA_PASSWORD` e `SEED_LEITOR_PASSWORD` **antes do primeiro seed**. Cadastro público fica desativado; contas são geridas pelo Admin. Role e desativação valem na próxima requisição. Há limite de cinco logins por minuto por IP.

## Usar os módulos

**Documentos:** envie um dos PDFs fictícios de `test-data/demo1`, escolha ou sugira termos e analise. PDFs digitais são extraídos no navegador; os escaneados passam pelo docling local. Resultados incluem relevância por seção, trechos e páginas verificadas, resumo editável e parecer. O resumo pode ser regenerado com público, tamanho e seções próprios. A opção de indexação permite continuar no chat. A exportação do parecer pelo Analista passa por aprovação quando a política estiver ligada; o pedido é vinculado ao conteúdo, formato e dono e vale por 24 horas.

**Pesquisa:** informe a consulta e escolha fontes gerais, governamentais ou acadêmicas. É possível revisar as consultas otimizadas antes de continuar. O agente busca, verifica robots.txt, coleta até três páginas permitidas, classifica as fontes e redige o relatório. Histórico, índice de fontes e exportação PDF/Word/Excel/JSON/Markdown ficam na mesma página. Falhas de conectores são independentes; restrição de coleta aparece como tal.

**Chat:** selecione fontes ou envie um PDF; use `/resumir` com um documento selecionado. Citações mostram arquivo, página e score. A busca usa somente fontes autorizadas; mensagens anteriores são revalidadas antes de aparecer ou voltar ao modelo. Dependências de fontes são preservadas também nas respostas derivadas do histórico. O cache considera usuário, escopo, base, histórico saneado, filtros, modelo e mascaramento. Repetir imediatamente a mesma pergunta pode usar cache; novos turnos ou uploads invalidam o contexto correspondente.

**Admin:** `/admin/dashboard`, `/admin/llm`, `/admin/settings`, `/admin/users`, `/admin/approvals` e `/admin/colecoes`. Mudanças de modelos e provedores não exigem reinício. O painel mostra custos gravados por chamada/modelo, orçamento, cache e uso da Tavily. Dados sintéticos e uso de replay aparecem identificados. Filtros de PII e acesso por coleção são aplicados no servidor. O status de provedor vem da última chamada bem-sucedida, sem ping pago.

Links de compartilhamento exigem login, são somente leitura, expiram em sete dias e podem ser revogados pelo dono. Compartilhar uma conversa não concede acesso às suas fontes privadas: respostas dependentes de fontes indisponíveis ficam ocultas. Exportações já baixadas permanecem com quem as recebeu. A aprovação organiza o fluxo normal da interface; não constitui DRM contra quem já tem o conteúdo no navegador.

## Preparar a demonstração

```bash
npm run seed:corpus       # base pública/licenciada, incluindo sete textos integrais auditados
npm run demo:seed         # 30 dias de métricas fictícias + 2 documentos + 2 relatórios
npm run demo:warmup       # três consultas públicas + cinco PDFs fictícios; usa LLM/busca reais
npm run demo:record       # grava as sete etapas declaradas no roteiro; usa tokens reais
npm run demo:replay:check # verifica conta, entrada, chave e contexto atuais de cada gravação
```

`demo:record -- --resume` aproveita gravações válidas da mesma entrada. Os comandos restauram as configurações temporárias ao terminar. O corpus contém **16 itens em quatro coleções**, incluindo sete textos integrais: LGPD e CLT da Câmara, Lei 14.133 disponibilizada pelo TCE-RO, guia ANPD v2.0 e três artigos SciELO CC-BY. As fichas/resumos anteriores continuam identificados como tal. O manifesto registra edição, licença e SHA-256; o guia é de abril/2022, e a reprodução da Lei 14.133 não garante consolidação com alterações posteriores. A coleta respeita robots; mudanças no texto exigem revisão do hash. O seed grava fonte e trechos numa transação e repara fontes incompletas, preservando permissões das coleções. Verifique a integridade com `node --env-file=.env.local --import tsx scripts/check-corpus-fulltext.ts`; `scripts/check-corpus-chat.ts` faz duas chamadas reais ao Haiku. `demo:reset` remove somente o seed marcado de demonstração; preserva corpus, dados reais, custos e auditoria.

Em **Provedores e controles**, o Admin escolhe o modo apresentação:

| Modo | Comportamento |
|---|---|
| Desligado | Execução normal |
| Gravar | Guarda somente respostas completas e válidas para a conta/entrada/contexto |
| Usar gravação | Tenta o serviço real; em erro ou falta de saída disponível em 8 segundos, cancela a tentativa e usa uma gravação correspondente |

No modo de segurança, quando existe gravação, a saída textual fica bufferizada até a conclusão. O prazo continua ativo até ela estar pronta para o usuário, inclusive se o provedor mandar um trecho e depois parar. A resposta validada ou gravada é transmitida em pequenos eventos; assim não se misturam duas respostas. Sem gravação, o erro real aparece. O indicador `●` no header é visível só ao Admin. Replay não custa tokens adicionais, mas a tentativa real anterior pode ter consumo. Chamadas a provedores têm prazo de 60 segundos por tentativa.

Gravações são privadas, sem expiração operacional (data técnica 9999), revalidadas por acesso e eliminadas conforme a exclusão dos dados relacionados. Regrave se mudar a entrada, o contexto ou as permissões. Para reproduzir o roteiro atual, use a mesma conta e escolha **Claude Haiku 5.5** conforme o roteiro.

## Verificação

```bash
npm test
npm run test:db           # cria/remove fixtures; use banco local ou descartável, nunca produção
npm run typecheck
npm run lint
docker build --target runner -t intellisuite:verification .
npm run check-models     # catálogo, respostas e teste de prompt injection; gasta tokens
./scripts/smoke.sh http://localhost:3000
```

`check-models -- --offline` verifica catálogo/preços/banco; `--no-calls` consulta as listas sem geração. Ausência de chave de provedor ativo falha explicitamente. Cada execução do smoke faz três logins; espere o período do limitador antes de repetir. Em hosts que impedem o build local do Turbopack, use o build Docker, também exercitado na validação deste projeto.

Resultados e limites conhecidos estão em [QA_checklist.md](QA_checklist.md): não há declaração de aceite 26/26 enquanto houver pendências externas ou medições sem execução.

## Segurança e dados

Segredos ficam em arquivos de ambiente ignorados pelo Git. Métricas não guardam conteúdo de documentos ou conversas. Conteúdo externo entra delimitado no prompt e é renderizado como Markdown sem HTML/imagens remotas. O scraper respeita robots.txt, intervalo por origem, limite de 2 MB e prazo de 10 segundos; bloqueia redes privadas, DNS rebinding e redirects inseguros. Nunca contorna CAPTCHA ou login.

Coleções autorizam perfis e pessoas; privados pertencem ao dono. Admins são revalidados durante mudanças de acesso, e mutações são serializadas para proteger o último administrador. Endpoints HTTP nativos do plugin administrativo são bloqueados; o app usa wrappers auditados. APIs autenticadas também verificam a origem da requisição. Política e provedores de IA: `/privacidade`.

## Backup, deploy e plano B

O runbook completo está em [deploy/README.md](deploy/README.md). Há scripts de backup privado, restore em container descartável sem rede, monitoramento e exemplo de cron. A stack local de segurança usa [compose.offline.yaml](compose.offline.yaml), banco restaurado e imagens/cache já presentes, sem chaves dos provedores. `scripts/offline-start.sh` usa uma ponte Node de loopback para acessar a rede interna sem liberar saída à internet. Não use `down -v` em bancos que precise preservar.

A pesquisa agrega Tavily/SearXNG, OpenAlex, LexML e a API oficial do Senado. Esta última consulta normas identificadas por número/ano ou aliases LGPD/CLT, com origem própria no cartão. O Senado respondeu à LGPD real; LexML continua opcional enquanto apresentar CAPTCHA. O filtro conjunto inclui tribunais `*.jus.br`. No chat, referências explícitas a artigos priorizam o dispositivo dentro da fonte selecionada, mantendo o score de cosseno e a autorização antes da busca.

## Retomar esta instalação local

Na instalação já preparada deste computador, execute `npm run local:start` e abra `http://localhost:3001`. O comando inicia OrbStack se necessário, recupera os serviços existentes e inicia o Next **em produção**, somente em loopback, sem Fast Refresh. Se o servidor já estiver saudável, apenas informa o endereço. Mantenha o terminal aberto quando ele iniciar o servidor. Para outra porta, alinhe a origem de autenticação e `INTELLI_LOCAL_PORT`.

O build fica em `.local-runtime/current`, separado do `.next` usado pelo desenvolvimento e pela geração de tipos. O Docker serve apenas para compilar/exportar os artefatos, sem receber as chaves da aplicação; o Node roda no Mac com suas dependências nativas e o banco existente. Após alterar código da aplicação, encerre a instância com `Ctrl+C` no terminal que a iniciou e execute `npm run local:rebuild`. `npm run dev` continua disponível para programação; não use esse modo para o acesso normal, pois ele recarrega páginas ao detectar mudanças.

A pesquisa usa Sonnet como principal e Haiku como alternativa operacional; as configurações podem ser alteradas no Admin. Conexões sem resposta inicial têm prazo de dez segundos para permitir fallback, sem interromper um stream válido nesse prazo curto. Provedores sem chave não são oferecidos como serviço ao vivo; modelos disponíveis somente por gravação recebem esse rótulo no modo offline.

Verificações: `node --env-file=.env.local --import tsx scripts/check-research-latency.ts --all` gera relatórios reais e mede as etapas; `--default` valida a seleção padrão. Remove apenas o cache dos relatórios medidos, conservando caches técnicos de fontes/robots. `scripts/check-research-masking.ts` usa dados fictícios, ativa brevemente o filtro pelo Admin e restaura a configuração original com auditoria. `scripts/check-model-availability.ts` verifica o catálogo e a resposta a provedor sem chave. Testes de geração usam os serviços pagos configurados.

O mascaramento da pesquisa cobre CPF, e-mail e telefone, inclusive em URLs codificadas, no stream, histórico, detalhe, base e replay. URLs com dados detectados são ocultadas sem inventar outro destino. Fontes que excedem o orçamento de coleta são identificadas como metadados. Geração real com GPT ainda requer a chave OpenAI; indisponibilidade externa do Gemini é coberta pela alternativa configurada, com registro do modelo efetivamente usado. Publicação no VPS depende de acesso e não foi realizada.
