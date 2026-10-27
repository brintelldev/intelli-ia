# Conjunto de PDFs de teste do Demo 1

Documentos **sintéticos** (nenhum dado real) para testar o fluxo completo: leitura, OCR, análise por palavras-chave e parecer técnico.
Cada fato tem a **página em que está** (gabarito em `expected.json`) e um trecho que o achado deve conter.

| Arquivo | Tipo | Páginas | Para que serve |
|---|---|---|---|
| `contrato_ti_12p.pdf` | contrato digital | 12 | cláusulas numeradas (SLA, LGPD, multa, garantia, rescisão) |
| `contrato_fornecimento_10p.pdf` | contrato digital, outra estrutura | 10 | capítulos e artigos, vocabulário diferente |
| `proposta_escaneada_3p.pdf` | escaneado (só imagem) | 3 | passa pelo OCR (docling) |
| `relatorio_tabelas_6p.pdf` | com tabelas | 6 | valores que só existem em tabelas |
| `regulamento_90p.pdf` | longo | 90 | muitas páginas: o parecer usa só as páginas da análise |

Rodar a bateria (usa os modelos de verdade, custa cerca de US$ 0,5, servidor em `localhost:3001`):

```bash
npm run demo1-suite
npm run demo1-suite -- --only=escaneada
```

A bateria sai com código 1 se algum fato ficar na página errada, se a citação não existir na página citada ou se o número de páginas lidas não bater.
