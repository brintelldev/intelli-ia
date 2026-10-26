import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { costTier, ModelSelector, type ModelOption } from "./ModelSelector";
import { linkCitations, ReportViewer } from "./ReportViewer";
import { safeUrl } from "./SafeMarkdown";

test("costTier: faixas pelo preço de saída; sem preço não inventa etiqueta", () => {
  assert.equal(costTier(0.5), "Econômico");
  assert.equal(costTier(1), "Econômico");
  assert.equal(costTier(3.75), "Padrão");
  assert.equal(costTier(10), "Padrão");
  assert.equal(costTier(20), "Avançado");
  assert.equal(costTier(null), null);
});

test("linkCitations: [n] vira âncora só se a fonte n existe; link e referência de rodapé ficam intactos", () => {
  assert.equal(linkCitations("fato [1] e [2], mas [3]", 2), "fato [[1]](#cit-1) e [[2]](#cit-2), mas [3]");
  assert.equal(linkCitations("veja [1](https://x.gov.br) e [2]: nota", 2), "veja [1](https://x.gov.br) e [2]: nota");
  assert.equal(linkCitations("[0] [1]", 1), "[0] [[1]](#cit-1)");
  assert.equal(linkCitations("[1]", 0), "[1]");
});

test("safeUrl: âncora da página vale; âncora com caracteres estranhos e outros esquemas não", () => {
  assert.equal(safeUrl("#cit-3"), "#cit-3");
  assert.equal(safeUrl("#"), "");
  assert.equal(safeUrl("#a b"), "");
  assert.equal(safeUrl("javascript:alert(1)"), "");
});

const sections = [
  { heading: "Resumo", content: "Fato importante [1]." },
  { heading: "Riscos", content: "Texto <script>x</script>" },
];
const view = (p: Partial<Parameters<typeof ReportViewer>[0]> = {}) =>
  renderToStaticMarkup(<ReportViewer sections={sections} citations={[{ label: "Lei 1", url: "https://x.gov.br" }, { label: "Sem link", url: "javascript:alert(1)" }]} {...p} />);

test("ReportViewer: seções com âncora, índice, citação clicável e fontes numeradas", () => {
  const out = view();
  assert.match(out, /<section id="secao-1"/);
  assert.match(out, /<section id="secao-2"/);
  assert.match(out, /href="#secao-1"/); // índice lateral
  assert.match(out, /href="#cit-1"/); // [1] no texto
  assert.match(out, /<li id="cit-1"/);
  assert.match(out, /<li id="cit-2"/);
  assert.match(out, /href="https:\/\/x\.gov\.br"/);
  assert.ok(!/href="javascript:/i.test(out), "URL de fonte com esquema perigoso não vira link");
  assert.ok(!/<script/i.test(out), "HTML do conteúdo não é interpretado");
  assert.match(out, /aria-busy="false"/);
});

test("ReportViewer: streaming mostra o cursor e as seções ainda não geradas, sem link para elas", () => {
  const out = view({ streaming: true, pendingHeadings: ["Resumo", "Riscos", "Próximos passos"] });
  assert.match(out, /aria-busy="true"/);
  assert.match(out, /animate-pulse/);
  assert.match(out, /Próximos passos/);
  assert.ok(!/href="#secao-3"/.test(out), "seção pendente não é clicável");
  assert.equal(view({ streaming: true, sections: [], pendingHeadings: [] }).includes("Gerando o relatório"), true);
});

test("ReportViewer: sem citações não há bloco de fontes; com uma só seção não há índice", () => {
  const out = view({ citations: undefined, sections: [sections[0]] });
  assert.ok(!out.includes('id="fontes"'));
  assert.ok(!out.includes('aria-label="Seções do relatório"'));
});

const models: ModelOption[] = [{ id: "a:x", label: "Modelo X", provider: "anthropic", providerLabel: "Anthropic", inputPerM: 2, outputPerM: 10 }];

test("ModelSelector: mostra o modelo escolhido e o padrão quando não há escolha", () => {
  assert.match(renderToStaticMarkup(<ModelSelector value="a:x" onChange={() => {}} models={models} />), /Modelo X/);
  assert.match(renderToStaticMarkup(<ModelSelector value="" onChange={() => {}} models={models} />), /Padrão do sistema/);
});
