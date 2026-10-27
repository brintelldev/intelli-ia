import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentosWorkspace } from "./DocumentosWorkspace";
import { withoutHeadingMarks } from "./HighlightedText";

test("/documentos inicial: painel (PDF, palavras-chave, modelo, indexação, Analisar, Exportar) e estado vazio explicativo", () => {
  const out = renderToStaticMarkup(<DocumentosWorkspace />);
  assert.match(out, /data-phase="idle"/);
  assert.match(out, /data-testid="pdf-dropzone"/);
  assert.match(out, /aria-label="Palavras-chave"/);
  assert.match(out, /aria-label="Modelo de IA"/);
  assert.match(out, /Permitir perguntas sobre este documento no chat/);
  assert.match(out, /<button[^>]*disabled=""[^>]*data-testid="analyze-button"|<button[^>]*data-testid="analyze-button"[^>]*disabled=""/, "sem PDF não dá para analisar");
  assert.match(out, /Analisar documento/);
  assert.match(out, /aria-label="Exportar"/);
  assert.match(out, /Disponível depois da análise/);
  assert.match(out, /data-testid="workspace-empty"/);
  assert.match(out, /Envie o PDF[\s\S]*Defina as palavras-chave[\s\S]*Analise e gere o parecer/);
  assert.ok(!out.includes('role="tablist"'), "as abas só existem depois da análise");
  assert.ok(!out.includes('data-testid="ask-chat"'), "sem análise não há link para o chat");
  assert.match(out, /aria-expanded="true"/, "no celular o painel começa aberto");
});

test("withoutHeadingMarks tira o # de título do extrator de PDF só no começo de linha", () => {
  assert.equal(withoutHeadingMarks("## CLÁUSULA 7 – DO SLA"), "CLÁUSULA 7 – DO SLA");
  assert.equal(withoutHeadingMarks("antes\n### Título\ndepois"), "antes\nTítulo\ndepois");
  assert.equal(withoutHeadingMarks("item #3 e #hashtag, 10# ok"), "item #3 e #hashtag, 10# ok");
  assert.equal(withoutHeadingMarks("#semespaco"), "#semespaco");
});
