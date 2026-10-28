# QA — requisitos 111 a 136

Execução: **Codex, 27 e 28/10/2026**, com dados fictícios e fontes públicas. Ambiente local arm64; Next em desenvolvimento e build Docker de produção. Permissões/credenciais foram alteradas apenas em instância QA descartável com contas fictícias, sem dados nem chaves reais. O resultado funcional é 25/26; o item 123 continua dependente de provedores externos. Atualização funcional em **28/10/2026**: correções de código concluídas, com os limites externos abaixo. O aceite específico LexML foi substituído operacionalmente pela API pública independente do Senado, sem afirmar que o LexML passou.

A bateria final passou com **321 testes de unidade e 30 de banco**, typecheck, lint e build Docker. A revisão independente apontou três problemas, todos corrigidos com regressões: dependências transitivas de fontes no histórico, invalidação de cache por base/histórico e deadline do replay após um primeiro delta seguido de parada.

| Item | Resultado | Como foi verificado |
|---|---|---|
| 111 | ✅ | Cinco PDFs sintéticos digitais, longo, tabelas e escaneado. Extração/OCR exercitados; gabarito da bateria Demo 1 e pré-indexação dos cinco arquivos. |
| 112 | ✅ | Análise com LLM real, JSON validado, documentos curtos e map-reduce no longo; páginas preservadas. |
| 113 | ✅ | Palavras-chave, ocorrências/trechos conferidos contra páginas; sugestão real e chips acessíveis. |
| 114 | ✅ | Relevância por seção e navegação de página; testes de resultado e interface integrada. |
| 115 | ✅ | Resumo editável, público/tamanho e seções; correção de orçamento para raciocínio; resumo real em 3.977 ms. |
| 116 | ✅ | Parecer com evidências e ponte Documento → Chat. PDF de 10 páginas gerou 12 trechos; citações apontaram para o mesmo arquivo/páginas. |
| 117 | ✅ | Downloads reais no navegador de PDF, Word, Excel e JSON; Markdown e estrutura dos arquivos testados. Aprovação do parecer vinculada à versão/formato/dono. |
| 118 | ✅ | Interpretação, consultas revisáveis e pipeline de etapas; pausa/edição exercitadas no navegador. |
| 119 | ✅ Fonte oficial alternativa | Tavily, fallback SearXNG, OpenAlex e API independente Senado. LGPD real retornou Lei 13.709/2018 e URN em 3.383 ms com limitação de frequência; origem identificada. LexML segue opcional/CAPTCHA, sem contorno nem aceite literal desse conector. |
| 120 | ✅ | Robots real e cache; scraper real em example.com; testes de DNS privado/rebinding, redirects, bytes e DNS travado/cancelamento. Planalto indisponível foi recusado. |
| 121 | ✅ | Critérios de tom, tamanho, detalhamento e citações aplicados pelo TemplateEditor e prompts. |
| 122 | ✅ | Seções do usuário preservadas em ordem; seções obrigatórias e Referências conferidas; relatório integrado no navegador. |
| 123 | ⚠️ Parcial | Sonnet, Opus e Haiku responderam e ignoraram instrução maliciosa. OpenAI sem chave. Gemini teve falhas externas nas tentativas anteriores; em 28/10 a chamada mínima completou via fallback Haiku em 3.692 ms, com resposta correta e modelo real auditado. O suporte está implementado; geração nativa/economia do Gemini e GPT real ainda dependem dos provedores/credencial. |
| 124 | ✅ Fonte oficial alternativa | Lei LGPD pela API Senado, cinco artigos OpenAlex e pesquisa real com STJ, STF e TJDFT. Filtro conjunto corrigido para incluir jus.br. O teste específico LexML permanece bloqueado externamente; a cobertura funcional usa Senado. |
| 125 | ✅ | Relatório parcial/final, fontes/índice/histórico e exportações; sessão de chat aberta com relatório próprio. |
| 126 | ✅ | Cache real de pesquisa em 33–48 ms e chat em dezenas de ms. Após revisão: upload/contexto novo invalida resposta; repetição imediata mantém reaproveitamento. |
| 127 | ✅ | Fontes e relatório indexados como privados também no cache/replay. Cache novo conserva o texto coletado; legado/replay sem texto disponibiliza resumo explicitamente limitado, sem nova coleta. Teste HTTP sem LLM e teste A/B provaram índice por dono e ausência de duplicatas. |
| 128 | ✅ | Chat real com stream, cancelamento, persistência, reload, filtros e modo Leitor. |
| 129 | ✅ | Quatro coleções/16 itens, incluindo sete textos integrais oficiais/licenciados em 2.700 trechos. Todos os trechos, SHA, edição e páginas conferidos; recuperação dos trechos finais em 1–37 ms. Haiku respondeu ao art. 922 da CLT e item 85 ANPD com citação da pág. 24. Seed repetido: zero criações/reparos; transação, recuperação de interrupção e rollback testados. |
| 130 | ✅ | Embeddings locais, busca autorizada antes da ordenação, top-k e calibração de 20 perguntas/337 trechos. MIN_SCORE 0,30 separou o conjunto de teste, sem garantia de generalização. |
| 131 | ✅ | Classificação de fontes e painéis por relevância/categoria; score e páginas visíveis no navegador. |
| 132 | ✅ | Resumo por fonte e documento; `/resumir` percorre todos os trechos por redução hierárquica. Resumo real de documento em 6.618 ms. |
| 133 | ✅ | PDF da conversa baixado no navegador; consolidação e renumeração de citações testadas. |
| 134 | ✅ | Sessões próprias, histórico, abertura por relatório/documento, reload e exclusão; outro dono recebe 404. Paginação de 20 com Carregar mais; teste de 21 sessões e 2.002 mensagens. Transporte envia só a última pergunta, com histórico confiável do banco, evitando limite de 200 mensagens no envio. |
| 135 | ✅ | Markdown/JSON da conversa; links com login, expiração/revogação e controle de dono. Fonte restrita oculta corpo da resposta, inclusive respostas derivadas do histórico. Títulos, relatórios e URLs de citações respeitam o mascaramento do visualizador. |
| 136 | ✅ | Matriz Admin/Analista/Leitor, coleções por perfil/pessoa, PII, aprovação e auditoria. Conta fictícia criada logou, recebeu 403 no Admin e perdeu acesso após ban. Concorrência administrativa e bypass nativo corrigidos/testados. |

**Resultado funcional: 25 itens aprovados e 1 parcial (123). Os itens 119/124 usam a alternativa oficial Senado; o aceite literal do conector LexML continua externo.** A enumeração não substitui os requisitos transversais ainda pendentes.

## Medições e ensaios

- Pesquisa aquecida das três consultas da UI: primeira execução **28.339 / 23.227 / 42.751 ms** após paralelizar a coleta; cache **33 / 27 / 41 ms**. A medição anterior de saúde (49.053 ms) foi superada após as correções de 28/10: relatórios novos com Haiku em **19.102 / 23.328 / 29.038 ms**, e saúde com a seleção padrão Sonnet em **29.652 ms**. Nenhuma dessas respostas reutilizou relatório nem replay; caches técnicos de fontes, robots e embeddings permanecem ativos como no uso normal. A meta foi atendida nesses casos, sem promessa de tempo invariável para toda consulta/provedor. O roteiro deve ser aquecido antes da apresentação.
- Ingestão do PDF de 10 páginas: **3.905 ms**. Pré-indexação adicional: TI 17 trechos/3.773 ms, regulamento de 90 páginas 303 trechos/6.279 ms, tabelas 5 trechos/2.172 ms, escaneado 3 trechos/2.411 ms após OCR. Esses últimos tempos medem ingestão, não todo o OCR.
- Métricas SQL com 811 eventos fictícios: **30 ms**. Seed repetido criou zero duplicatas; reset preservou uma sentinela fora do seed. Custo fictício não consome orçamento real.
- Aprovação ponta a ponta por HTTP isolado: pendente → aprovada, dono exclusivo, expiração de 24 horas e revisão duplicada 409, **125 ms** no conjunto.
- Replay: sete rotas gravadas de respostas reais; repetição em QA **sem chaves LLM/Tavily** passou em todas. Entrada desconhecida mostra erro, modo desligado não usa gravação, chat persiste. Indicador `●`, texto e citações confirmados visualmente para Admin.
- Regressões com LLM real: repetição imediata usa cache; novo upload invalida; resposta derivada conserva a dependência privada e não revela o código fictício para outro visualizador.
- Backup restaurado em container descartável sem rede: pgvector/384 dimensões e ausência de trechos órfãos conferidos. Stack offline completa passou no smoke dos três perfis e stream; as sete etapas passaram com seis replays e uma pesquisa em cache local comprovado. Saída externa bloqueada.
- Interface revalidada em **375 e 1280 px** em Chrome headless com perfil temporário isolado: Documentos, Pesquisa, Chat e Dashboard, oito casos sem overflow horizontal. innerWidth e scrollWidth medidos; screenshots inspecionadas. Chat redireciona normalmente para /chat/[id]. O ensaio anterior em 752 px também permanece válido. Não é uma auditoria completa de acessibilidade/interações em todos os dispositivos.

## Dependências externas para aceite completo

1. **OpenAI:** falta a chave. GPT não é oferecido como serviço ao vivo sem configuração; chamada explícita retorna 503 com orientação. O suporte está implementado, mas a geração real não pode ser aceita sem credencial.
2. **Gemini:** integração configurada, porém a chamada de teste usou a alternativa Claude Haiku em **3.692 ms**, com resposta correta e modelo real auditado. Isso comprova a continuidade da aplicação; não comprova geração nativa nem economia do Gemini enquanto o serviço falhar.
3. **VPS:** acesso/publicação não foram fornecidos nem executados. HTTPS, amd64, firewall, cron/alerta e reboot do host remoto continuam fora do aceite local. Nenhuma publicação ocorreu.
4. **LexML específico:** mantém CAPTCHA; a API independente Senado atende funcionalmente à legislação. O aceite literal do conector LexML permanece externo.

Acervo integral, larguras 375/1280, mascaramento da pesquisa e as consultas de referência de até 30 segundos deixaram de ser pendências de código. O filtro detecta CPF, e-mail e telefone nos formatos implementados, inclusive URLs codificadas; não é um detector universal de nomes, endereços ou qualquer dado pessoal possível.

## Limites e decisões de revisão

O fallback bufferiza a saída textual para não misturar respostas; por isso o prazo permanece ativo até o buffer completo estar disponível. Isso pode substituir por gravação uma chamada real que produziria uma resposta diferente após oito segundos. Sem gravação, a chamada real e seu erro seguem normalmente.

As dependências transitivas do histórico são conservadoras: uma resposta pode ser ocultada se qualquer fonte anterior fornecida ao modelo perdeu acesso, mesmo quando essa parte do texto não foi usada na resposta. É uma restrição de disponibilidade para proteger confidencialidade.

A revisão não fez chamadas pagas adicionais, não julgou disponibilidade externa dos provedores/LexML, não repetiu os ensaios visuais ou de VPS e não tratou a aprovação como DRM. Esses limites estão refletidos nos resultados, e não foram descartados como aceites implícitos.

## Preparação disponível ao final

O modo apresentação ficou em `fallback` no ambiente local, com alteração auditada e sete gravações válidas. A cópia offline usa `http://127.0.0.1:3030`; o host difere do `localhost` do desenvolvimento para separar cookies de autenticação. A ponte escuta apenas loopback e precisa permanecer aberta. A primeira proposta de rede adicional foi rejeitada automaticamente por permitir potencial saída externa; foi abandonada. O ensaio bem-sucedido usa somente a alternativa por pipes de `docker exec`, com a rede interna mantida.

## Complementação dos itens parciais — 27/10/2026

Textos integrais: LGPD e CLT (HTML atualizado da Câmara, consulta em 27/10/2026); Lei 14.133 (97 páginas, reprodução da Câmara disponibilizada pelo TCE-RO, com alterações de 2023, sem garantia de consolidação posterior); guia ANPD (26 páginas, v2.0 abril/2022, CC-BY-ND-3.0); três artigos SciELO em português (JATS, CC-BY-4.0 confirmada nos próprios artigos). O trecho constitucional e as fichas/resumos anteriores mantêm escopo explícito. A indexação cobre texto, tabelas e referências; não reproduz o layout visual dos originais.

Revisão independente encontrou e confirmou a correção de separadores entre células JATS e gravação atômica/recuperável do seed. A busca por artigo numerado usa a referência expressa somente dentro da fonte selecionada e mantém a autorização antes da ordenação e o score real. Cache v4 evita reaproveitar respostas da busca anterior. A falha de um vetor na transação preservou o conteúdo anterior no teste de banco.

Cópia offline atualizada com os sete textos/2.700trechos por inserção transacional, preservando usuários, coleções e permissões; backup prévio. Imagem de produção atualizada. Roteiro offline7etapas passou novamente (6replay+1cache), sem alterar a redeDocker interna. Backup principal atualizado para restaurações futuras.

## Nova auditoria completa — 27/10/2026

Foram corrigidas três falhas adicionais encontradas na revisão independente:

- Mascaramento não aplicado aos títulos e relatórios compartilhados. Regressão com e-mail/CPF fictícios falhou antes e passou depois; URLs de citações também são saneadas no histórico, cache e resposta ao vivo.
- Cache/replay da pesquisa não criava a base privada do solicitante. Agora o cache novo guarda o conteúdo coletado só no servidor; a restauração e a indexação são privadas, idempotentes e transacionais por fonte. Testes A/B e HTTP confirmaram dois itens privados, texto preservado e zero duplicatas, sem chamar LLM.
- Limites silenciosos do histórico: apenas 20 sessões sem paginação e apenas as primeiras 2.000 mensagens. Agora há paginação e leitura completa; 21 sessões/2.002 mensagens passaram. A conversa longa envia apenas a última pergunta; o contexto é lido no servidor.

Bateria após as correções: 311 testes unitários, 30 de banco, typecheck, lint e build Docker aprovados. Integrações HTTP de sessões (15 ms), métricas (18 ms), cache e regressões de privacidade passaram. Catálogo dos provedores falhou somente pela chave OpenAI ausente; geração Gemini expirou. Senado respondeu à LGPD; LexML não retornou resultados; OpenAlex e corpus integral foram reconferidos. Revisão independente repetiu 19 testes focados sem rede/banco.

O smoke dos três perfis e streaming passou no desenvolvimento. A cópia offline recebeu a imagem corrigida e passou pelo roteiro de sete etapas (seis replays e um cache), mantendo a rede interna. Houve uma falha temporária do primeiro healthcheck imediatamente durante a recriação do container; após inicialização a saúde voltou a OK. As evidências de layout não substituem uma revisão visual completa de todos os estados e conteúdos.

## Conclusão funcional — 28/10/2026

- Pesquisa redige os dados de saída por perfil no stream, cache, histórico, detalhe, base de conhecimento e replay legado. IDs, datas e tipos são preservados. Teste HTTP com dados fictícios passou em todos esses caminhos e restaurou a configuração original pelo Admin, com auditoria. URLs com dados pessoais, inclusive codificação dupla, perdem o link; endereços seguros continuam originais. A revisão apontou esse último caso, reproduzido em teste antes da correção.
- Classificação por metadados roda junto à coleta; a síntese conserva os textos efetivamente coletados. A coleta tem orçamento de quatro segundos e usa apenas metadados nas páginas que não responderem, sem contornar robots ou alegar leitura integral. Referências são montadas diretamente das fontes no servidor. Custos auxiliares concluídos são registrados mesmo se a coleta for cancelada.
- O principal da pesquisa permanece Sonnet; a alternativa foi alterada para Haiku pelo Admin com auditoria. A escolha de provedores continua configurável. Conexões que não iniciam resposta em dez segundos permitem fallback; streams iniciados conservam o prazo completo de sessenta segundos e o cancelamento do usuário.
- Catálogo omite provedores sem chave como serviço ao vivo. Na cópia offline, oferece somente modelos com gravações do próprio usuário, marcados como gravação. Cache/replay continuam utilizáveis sem chaves; entradas desconhecidas recebem erro claro.
- Validação final: **321 testes unitários e 30 de banco**, tipos, lint e Docker aprovados. PDF fictício de dez páginas foi analisado, indexado em doze trechos e respondido com citações de páginas do mesmo arquivo; relatório → chat preservou resposta, citação e histórico. Smoke dos três perfis/stream passou no desenvolvimento e no offline. Roteiro offline passou nas sete rotas por replay.
- A instalação foi restabelecida após encontrar Node e Docker desligados. `npm run local:start` abre OrbStack se necessário, preserva os containers existentes e inicia a aplicação em loopback; repetição com a aplicação ativa é idempotente. O terminal deve permanecer aberto quando ele iniciar o servidor. Sem commit, push ou publicação.

Fechamento em28/10: versão final aplicada na cópia offline, sete rotas por replay e catálogo com uma opção de gravação própria aprovados. Backup privado atualizado. Main e offline com health OK; nenhum segredo exposto, conta criada ou publicação realizada.

## Estabilidade do acesso local — 28/10/2026

O usuário relatou recargas contínuas no login. O log do servidor de desenvolvimento continha centenas de recompilações de poucos milissegundos e requisições repetidas a `/login`; o trace registrava atualizações HMR sem módulos modificados. Não havia alternância de redirects entre login e home. A causa operacional confirmada era o ciclo do Fast Refresh; o evento específico do watcher que o disparava não foi isolado.

`local:start` agora executa o build de produção no Node do Mac, somente em loopback, usando o banco e as configurações existentes. Os artefatos ficam em `.local-runtime/current`, isolados do `.next` alterado por desenvolvimento/typegen. Docker é usado apenas como compilador/origem de arquivos, com ambiente restrito sem chaves da aplicação; o container temporário de exportação permanece parado, sem rede, e é removido. Os pacotes nativos e os aliases externos do Turbopack resolvem para as dependências do Mac; foi coberto em regressão o subpath do Prisma. `local:rebuild` é bloqueado enquanto a instância está ativa, inclusive se o healthcheck falhar, para preservar os arquivos em uso.

Validação: 324 testes unitários, 30 de banco, tipos, lint e build Docker aprovados. Smoke HTTP passou: saúde dos três serviços, login dos três perfis, matriz de permissões e cinco linhas de streaming em quatro segundos. Vinte GETs consecutivos ao login retornaram 200, sem código HMR. No navegador, o preenchimento fictício persistiu durante a observação; login, home e Documentos carregaram sem erros de console. Repetir `local:start` com a instância saudável não criou outro processo; tentar `local:rebuild` ativo foi recusado. Os limites dos provedores externos descritos acima não foram alterados por essa correção.

## Rodada funcional solicitada pelo usuário — 28/10/2026

Detalhes em `QA_funcional_20261028.md`. Testados novamente: análise/indexação/chat de PDF digital fictício; OCR de três páginas com gabarito; pesquisa real padrão (28,2 s, oito fontes, indexação concluída); pesquisa pela interface, exportação PDF de cinco páginas, ponte relatório → chat, citações e histórico após reload; métricas e catálogo dos provedores. O servidor encontrado parado foi retomado em processo independente da sessão. Um smoke sob testes simultâneos encontrou rate limit e timeouts de saúde; a repetição sequencial passou sem enfraquecer as proteções.

A inspeção visual encontrou JSON na citação de relatório. Corrigido em respostas novas, cache e histórico, conservando mascaramento/acesso e a identificação das referências originais. Bateria final: **326 unitários, 30 banco, tipos, lint e build Docker aprovados**; navegador confirmou a correção na conversa legada. Os resultados públicos da interface foram preservados para inspeção.
