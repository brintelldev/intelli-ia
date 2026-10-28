# Testes funcionais — 28/10/2026

Skill aplicada: `verification-before-completion`, complementada por diagnóstico e regressão antes da correção. Ambiente: aplicação de produção em http://localhost:3001, banco e serviços locais existentes. Foram usados PDFs fictícios, fontes públicas e contas de demonstração. Nenhum documento pessoal foi enviado.

## Fluxos verificados

| Fluxo | Evidência |
|---|---|
| Documento digital → análise → chat | PDF fictício de dez páginas analisado, 12 trechos indexados e citações conferidas no mesmo arquivo; 18,5 s no total. Fixtures removidas pelo teste. |
| PDF escaneado → OCR | Três páginas e três fatos do gabarito confirmados; 8,4 s. |
| Pesquisa real com configuração padrão | Sonnet, sem replay/cache: oito fontes, seis seções, indexação concluída; 28,2 s. Uma fonte teve texto coletado; as demais foram identificadas como metadados. |
| Pesquisa pela interface | Pedido preenchido, etapas acompanhadas, relatório concluído, histórico e fontes apresentados. |
| Exportação pela interface | PDF baixado e validado: cinco páginas A4, 21.218 bytes, título correto, sem senha ou JavaScript. |
| Relatório sintético → chat | Resposta, citação do relatório e histórico conferidos; 2,6 s. Fixtures removidas. |
| Pesquisa → chat pela interface | O relatório abriu na conversa; a resposta confirmou oito fontes e uma coletada, citou o relatório e permaneceu após recarregar. |
| Métricas e catálogo | Métricas responderam em 12 ms, período inválido foi recusado, leitor bloqueado e provedores sem chave omitidos do catálogo ao vivo. |
| Acesso e streaming | Smoke sequencial aprovado: saúde, três perfis, permissões e cinco linhas transmitidas ao longo de quatro segundos. |

## Achados e correções

- O processo do teste anterior estava parado no início desta rodada. Foi retomado em processo independente, com PPID 1 para o inicializador, e permaneceu ativo durante a rodada. Log local privado em `.local-runtime/server.log`. O computador continua precisando estar ligado; após reiniciá-lo, use `npm run local:start`.
- A execução simultânea dos testes atingiu o limite esperado de cinco logins por minuto e registrou timeouts nos healthchecks. A proteção foi mantida. Depois da janela de limite e sem a carga simultânea, o smoke inteiro passou e a saúde voltou a `ok`. Esta rodada não estabelece capacidade de carga ou número de usuários simultâneos.
- A citação do relatório mostrava sua serialização JSON. Foi reproduzida em regressão e corrigida para exibir títulos e texto das seções, inclusive em histórico legado truncado e cache. O mascaramento e as regras de acesso foram preservados.

## Verificações automáticas

Bateria após a correção: **326 testes unitários, 30 de banco, typecheck, lint e build Docker aprovados**. Os dois testes novos reproduziram o JSON legado antes da correção e passaram depois, cobrindo também mascaramento e acesso revogado.

O build corrigido foi aplicado. Ao recarregar a conversa real já existente, o painel mostrou os títulos e o texto do relatório, sem `{"sections"`, preservando a resposta e as referências originais.

## Limites externos

As pendências conhecidas de chave OpenAI, indisponibilidade Gemini, aceite literal do LexML e implantação VPS continuam descritas no handoff; não foram resolvidas nem certificadas por esta rodada. O fluxo real usou os modelos configurados da Anthropic. A consulta de teste sobre saúde valida o funcionamento do sistema, sem certificar independentemente as conclusões científicas de cada fonte.

Sem commit, push, publicação ou alteração de credenciais. Os resultados públicos gerados pela interface foram preservados para inspeção.
