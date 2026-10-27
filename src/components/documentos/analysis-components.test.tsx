import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalysisResults } from "./AnalysisResults";
import { AnalysisSidebar } from "./AnalysisSidebar";
import { BriefPanel } from "./BriefPanel";
import { HighlightedText, PageRef } from "./HighlightedText";
import { SummaryControls } from "./SummaryControls";
import { SummaryEditor } from "./SummaryEditor";
import type { AnalysisView, BriefView } from "@/lib/documentos/views";

const view: AnalysisView = {
  summary: "Contrato com SLA de 99,5%.",
  taxonomy: ["Nível de serviço"],
  sections: [
    { title: "SLA", score: 96, pageRef: 3, snippet: "disponibilidade mensal de 99,5%", verified: true },
    { title: "Foro", score: 12, pageRef: 5, snippet: "frase inventada", verified: false },
    { title: "Garantia", score: 48, pageRef: 5, snippet: "Garantia de 5%", verified: true },
  ],
  keywords: [{ keyword: "SLA", count: 1, occurrences: [{ context: "O SLA exige 99,5%", page: 3, verified: true }, { context: "trecho inventado", page: 9, verified: false }] }, { keyword: "multa", count: 0, occurrences: [] }],
  suggestions: ["Definir a medição"],
  complete: true,
};

test("AnalysisSidebar: cor da barra por faixa (verde > 70, amarelo 30–70, vermelho < 30), nota, página e aviso do trecho não localizado", () => {
  const out = renderToStaticMarkup(<AnalysisSidebar sections={view.sections} activeIndex={0} onSelect={() => {}} />);
  assert.match(out, /data-tone="high"/);
  assert.match(out, /data-tone="low"/);
  assert.match(out, /data-tone="mid"/);
  assert.match(out, /bg-accent-docs/);
  assert.match(out, /bg-destructive/);
  assert.match(out, /bg-accent-admin/);
  assert.match(out, /aria-valuenow="96"/);
  assert.match(out, /aria-current="true"/);
  assert.equal((out.match(/aria-current/g) ?? []).length, 1);
  assert.match(out, /Trecho não localizado no documento/);
  assert.equal(renderToStaticMarkup(<AnalysisSidebar sections={[]} onSelect={() => {}} />), "");
});

test("AnalysisResults: ids para a rolagem, palavras-chave marcadas, trecho não verificado escondido e 'não encontrada' para 0 ocorrências", () => {
  const out = renderToStaticMarkup(<AnalysisResults view={view} keywords={["SLA", "multa"]} activeIndex={1} onOpenPage={() => {}} />);
  assert.match(out, /id="analysis-section-0"/);
  assert.match(out, /id="analysis-section-2"/);
  assert.match(out, /data-active="true"/);
  assert.match(out, /<mark[^>]*>SLA<\/mark>/);
  assert.ok(!out.includes("trecho inventado"), "ocorrência não verificada não é exibida");
  assert.match(out, /Não encontrada no documento/);
  assert.match(out, /aria-busy="false"/);
  assert.match(out, /Pontos de atenção/);
  // parcial: sem o "não encontrada" (ainda está chegando) e com o aviso de andamento
  const partial = renderToStaticMarkup(<AnalysisResults view={{ ...view, complete: false }} keywords={["SLA"]} />);
  assert.match(partial, /aria-busy="true"/);
  assert.match(partial, /Analisando o documento/);
  assert.ok(!partial.includes("Não encontrada no documento"));
});

test("PageRef: botão quando abre; aviso quando não localizado; nada sem página", () => {
  assert.match(renderToStaticMarkup(<PageRef page={3} verified onOpen={() => {}} />), /<button[^>]*>p\. 3<\/button>/);
  assert.match(renderToStaticMarkup(<PageRef page={3} verified={false} onOpen={() => {}} />), /p\. 3 · não localizado/);
  assert.ok(!/<button/.test(renderToStaticMarkup(<PageRef page={3} verified={false} onOpen={() => {}} />)));
  assert.equal(renderToStaticMarkup(<PageRef page={null} />), "");
  assert.match(renderToStaticMarkup(<PageRef page={2} />), /<span[^>]*>p\. 2<\/span>/);
  assert.match(renderToStaticMarkup(<HighlightedText text="A multa e a Multa" terms={["multa"]} />), /<mark[^>]*>multa<\/mark>[\s\S]*<mark[^>]*>Multa<\/mark>/);
});

const brief: BriefView = {
  objeto: "Parecer sobre o **contrato**.",
  metodologia: "Leitura integral.",
  facts: "**Documento:** c.pdf.",
  achados: [{ keyword: "SLA", finding: "99,5%.", pageRef: 3, quote: "disponibilidade mensal", verified: true }, { keyword: "garantia", finding: "5%.", pageRef: 5, quote: "inventado", verified: false }],
  riscos: [{ risk: "Glosa sem critério", severity: "alta", pageRef: 3, quote: "glosa", verified: true }],
  conclusao: "Viável.",
  recomendacoes: ["Definir o SLA"],
  complete: true,
};

test("BriefPanel: 5 seções numeradas em ordem, página clicável só quando verificada, citação só do verificado, gravidade do risco", () => {
  const out = renderToStaticMarkup(<BriefPanel view={brief} onOpenPage={() => {}} />);
  for (const n of [1, 2, 3, 4, 5]) assert.match(out, new RegExp(`data-testid="brief-section-${n}"`));
  assert.ok(out.indexOf("Objeto da Análise") < out.indexOf("Metodologia") && out.indexOf("Metodologia") < out.indexOf("Achados Principais") && out.indexOf("Análise de Riscos") < out.indexOf("Conclusão e Recomendações"));
  assert.match(out, /<button[^>]*>p\. 3<\/button>/);
  assert.match(out, /p\. 5 · não localizado/);
  assert.match(out, /disponibilidade mensal/);
  assert.ok(!out.includes("inventado"), "citação não verificada não aparece");
  assert.match(out, />Alta</);
  assert.match(out, /<strong>contrato<\/strong>/);
  assert.match(out, /<strong>Documento:<\/strong> c\.pdf/);
  assert.match(out, /aria-busy="false"/);
});

test("BriefPanel em streaming: seções que ainda não chegaram viram esqueleto; sem riscos (completo) diz que não houve", () => {
  const partial = renderToStaticMarkup(<BriefPanel view={{ objeto: "Já chegou.", achados: [], riscos: [], recomendacoes: [], complete: false }} />);
  assert.match(partial, /aria-busy="true"/);
  assert.equal((partial.match(/skeleton-shimmer/g) ?? []).length, 8, "4 seções pendentes × 2 linhas");
  assert.match(partial, /Já chegou\./);
  assert.match(renderToStaticMarkup(<BriefPanel view={{ ...brief, riscos: [] }} />), /Nenhum risco relevante/);
});

test("SummaryControls: tamanho e público em radiogrupos, e o modelo de seções só abre quando pedido", () => {
  const out = renderToStaticMarkup(<SummaryControls value={{ size: "curto", audience: "executivo" }} onChange={() => {}} onRegenerate={() => {}} template={null} onTemplateChange={() => {}} />);
  assert.equal((out.match(/role="radiogroup"/g) ?? []).length, 2);
  assert.match(out, /role="radio"[^>]*aria-checked="true"[^>]*>Curto/);
  assert.match(out, /aria-checked="true"[^>]*>Executivo/);
  assert.match(out, /Regenerar resumo/);
  assert.match(out, /type="checkbox"/);
  assert.ok(!out.includes("Formato do relatório"), "o editor de seções não é montado por padrão");
  assert.match(renderToStaticMarkup(<SummaryControls value={{ size: "medio", audience: "juridico" }} onChange={() => {}} onRegenerate={() => {}} template={null} onTemplateChange={() => {}} busy />), /Gerando…/);
});

test("SummaryEditor: um campo por seção, 'Editado' e restaurar só quando difere do gerado", () => {
  const original = { sections: [{ heading: "Contexto", content: "a" }, { heading: "Próximos passos", content: "b" }] };
  const same = renderToStaticMarkup(<SummaryEditor value={original} original={original} onChange={() => {}} />);
  assert.equal((same.match(/<textarea/g) ?? []).length, 2);
  assert.match(same, /Você pode editar o texto antes de exportar/);
  assert.ok(!same.includes("Editado"));
  const changed = renderToStaticMarkup(<SummaryEditor value={{ sections: [{ heading: "Contexto", content: "alterado" }, original.sections[1]] }} original={original} onChange={() => {}} />);
  assert.match(changed, /Editado/);
  assert.match(changed, /Restaurar o texto gerado/);
  assert.match(renderToStaticMarkup(<SummaryEditor value={{ summary: "texto" }} onChange={() => {}} streaming />), /<textarea[^>]*disabled/);
});
