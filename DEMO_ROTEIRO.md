# Roteiro de demonstração

Use apenas o PDF fictício de `test-data/demo1`. Escolha Claude Haiku 5.5 para reproduzir exatamente as entradas gravadas abaixo. As gravações são privadas por usuário e contexto de acesso; gravar com uma conta não prepara outra.

1. Entre como Analista. Envie o contrato sintético de 10 páginas e sugira palavras-chave.
2. Use os termos prazo, multa e rescisão. Analise, abra uma citação e gere o parecer.
3. Regenere um resumo executivo curto e solicite aprovação de exportação. O Admin revisa em Aprovações.
4. Pesquise a consulta LGPD abaixo; acompanhe fontes, restrições de coleta, relatório e histórico.
5. Adicione o mesmo PDF à base do chat. Pergunte usando o filtro do documento e abra a página citada.
6. Confira métricas, custos e cache no dashboard. Mostre os controles apenas com o Admin.

O bloco abaixo é executável por `npm run demo:record` e verificado por `npm run demo:replay:check`. Variáveis `$document.*`, `$analysis.*`, `$ingest.*` e `$session.id` são resolvidas pelo executor, sem alterar os arquivos PDF.

```json demo-replay
{
  "file": "test-data/demo1/contrato_fornecimento_10p.pdf",
  "steps": [
    {"id":"keywords","route":"suggest-keywords","path":"/api/documentos/suggest-keywords","body":{"text":"$document.text","filename":"$document.filename","existing":[]}},
    {"id":"analysis","route":"analyze","path":"/api/documentos/analyze","body":{"pages":"$document.pages","filename":"$document.filename","keywords":["prazo","multa","rescisão"],"index":true,"modelId":"anthropic:claude-haiku-5-5"}},
    {"id":"brief","route":"generate-brief","path":"/api/documentos/generate-brief","body":{"pages":"$document.pages","filename":"$document.filename","keywords":["prazo","multa","rescisão"],"analysis":"$analysis.analysis","modelId":"anthropic:claude-haiku-5-5"}},
    {"id":"summary","route":"summary","path":"/api/documentos/summary","body":{"pages":"$document.pages","filename":"$document.filename","keywords":["prazo","multa","rescisão"],"analysis":"$analysis.analysis","summary":{"size":"curto","audience":"executivo"},"modelId":"anthropic:claude-haiku-5-5"}},
    {"id":"research","route":"agent","path":"/api/pesquisa/agent","body":{"query":"Principais pontos da LGPD para o tratamento de dados pessoais","filter":"all","modelId":"anthropic:claude-haiku-5-5"}},
    {"id":"ingest","route":"ingest","path":"/api/chat/ingest","body":{"text":"$document.text","pages":"$document.pages","filename":"$document.filename","modelId":"anthropic:claude-haiku-5-5"}},
    {"id":"chat","route":"chat","path":"/api/chat","body":{"id":"$session.id","messages":[{"role":"user","parts":[{"type":"text","text":"Qual é o prazo contratual e a multa? Cite o contrato."}]}],"sourceFilter":"all","sourceId":"$ingest.sourceId","modelId":"anthropic:claude-haiku-5-5"}}
  ]
}
```

## Preparação local

`npm run demo:seed` preenche métricas fictícias; `npm run seed:corpus` prepara a base pública. `npm run demo:record` usa serviços e tokens reais com dados sintéticos, restaura a configuração ao terminar e conserva o contrato indexado e as gravações para a apresentação. O modo fica como estava antes do comando; o Admin seleciona **Usar gravação em falha ou demora** quando for apresentar.

No modo apresentação com gravação disponível, a saída textual é validada até o fim antes de ser transmitida em pequenos eventos. Isso permite substituir uma chamada que falha no meio sem misturar respostas. Sem gravação, o erro real aparece. Não há respostas fabricadas pelo mecanismo de segurança.

## Plano B pronto no notebook

Depois de `prepare-offline.sh`, use `./scripts/offline-start.sh` e abra `http://127.0.0.1:3030`. A ponte fica no terminal; os containers permanecem sem saída à internet. O smoke dos três perfis e o roteiro inteiro passaram nessa configuração. Uma pesquisa pode responder pelo cache normal local antes de precisar do replay. O teste isolado sem esse cache confirmou replay em todas as sete rotas.

Medições mais recentes das três consultas sugeridas: LGPD28,3s, trabalhista23,2s, saúde42,8s; repetições em27–41ms. A consulta de saúde deve estar aquecida antes da apresentação. Google retornou503 por alta demanda; OpenAI e aceite LexML ainda têm pendências descritas no QA.
