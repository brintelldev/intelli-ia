import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExportData, parseApiError, phaseOf } from "./workspace";
import { checkAnalysis } from "./analysis";
import { briefToSections, checkBrief, methodologyFacts } from "./brief";

const idle = { extracting: false, hasPdf: false, analyzing: false, hasAnalysis: false, briefing: false, hasBrief: false, failed: false };

test("phaseOf: percorre idle → extracting → ready → analyzing → analyzed → briefing → done, com erro acima de tudo", () => {
  assert.equal(phaseOf(idle), "idle");
  assert.equal(phaseOf({ ...idle, extracting: true }), "extracting");
  assert.equal(phaseOf({ ...idle, hasPdf: true }), "ready");
  assert.equal(phaseOf({ ...idle, hasPdf: true, analyzing: true }), "analyzing");
  assert.equal(phaseOf({ ...idle, hasPdf: true, hasAnalysis: true }), "analyzed");
  assert.equal(phaseOf({ ...idle, hasPdf: true, hasAnalysis: true, briefing: true }), "briefing");
  assert.equal(phaseOf({ ...idle, hasPdf: true, hasAnalysis: true, hasBrief: true }), "done");
  assert.equal(phaseOf({ ...idle, hasPdf: true, hasAnalysis: true, failed: true }), "error");
  assert.equal(phaseOf({ ...idle, hasPdf: true, analyzing: true, hasAnalysis: true }), "analyzing", "reanalisando: a fase é a de análise");
});

test("parseApiError: corpo JSON da resposta vira a mensagem; código e status são mantidos", () => {
  const e = Object.assign(new Error(JSON.stringify({ error: "Você atingiu o seu limite diário de uso de IA.", code: "budget_user" })), { statusCode: 429 });
  assert.deepEqual(parseApiError(e), { message: "Você atingiu o seu limite diário de uso de IA.", code: "budget_user", status: 429 });
  assert.deepEqual(parseApiError(new Error('{"error":"Modelo de IA inválido."}')), { message: "Modelo de IA inválido.", code: undefined, status: undefined });
});

test("parseApiError: texto direto passa; 401 sem corpo orienta; mensagem enorme ou vazia vira a genérica", () => {
  assert.equal(parseApiError(new Error("Não foi possível concluir a operação. Tente novamente.")).message, "Não foi possível concluir a operação. Tente novamente.");
  assert.match(parseApiError(Object.assign(new Error(""), { statusCode: 401 })).message, /sessão expirou/);
  assert.match(parseApiError(new Error("x".repeat(500))).message, /Não foi possível concluir/);
  assert.match(parseApiError(undefined).message, /Não foi possível concluir/);
  assert.match(parseApiError("<html>erro do proxy</html>").message, /html/, "texto curto que não é JSON é mostrado como está");
});

const pages = [
  { number: 3, content: "CLÁUSULA QUARTA – DO SLA. A CONTRATADA garantirá disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas." },
  { number: 4, content: "CLÁUSULA QUINTA – DAS PENALIDADES. Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%." },
];
const analysis = checkAnalysis(
  {
    relevanceBySection: [{ title: "SLA", score: 90, pageRef: 1, snippet: "disponibilidade mensal de 99,5%" }, { title: "Foro", score: 10, pageRef: 4, snippet: "frase que não existe no documento original" }],
    taxonomy: ["SLA"],
    keywordMatches: [{ keyword: "SLA", occurrences: [{ context: "disponibilidade mensal de 99,5%", page: 3 }] }, { keyword: "multa", occurrences: [] }],
    summary: "Resumo da análise.",
    suggestions: ["Definir a medição"],
  },
  pages,
  ["SLA", "multa"],
);
const rawBrief = { objetoAnalise: "o", metodologia: "m", achadosPrincipais: [{ keyword: "SLA", finding: "f", pageRef: 3, quote: "disponibilidade mensal de 99,5%" }, { keyword: "multa", finding: "g", pageRef: 4, quote: "Multa de 0,5% ao dia sobre a parcela" }], analiseRiscos: [], conclusao: "c", recomendacoes: ["r"] };
const brief = checkBrief(rawBrief, pages, ["SLA", "multa"]);
const briefSections = briefToSections(brief, methodologyFacts({ filename: "c.pdf", pages: 2, keywords: ["SLA", "multa"], modelLabel: "Opus", partial: false, date: "26/10/2026" }));

test("buildExportData sem parecer: resumo, relevância, palavras-chave e pontos de atenção; título 'Análise'", () => {
  const d = buildExportData({ filename: "contrato.PDF", pages, keywords: ["SLA", "multa"], analysis, summary: { summary: "  Resumo editado.  " }, date: "26/10/2026" });
  assert.equal(d.title, "Análise: contrato");
  assert.deepEqual(d.sections.map((s) => s.heading), ["Resumo", "Relevância por seção", "Palavras-chave", "Pontos de atenção"]);
  assert.equal(d.sections[0].content, "Resumo editado.", "vale o texto editado, aparado");
  assert.match(d.sections[1].content, /- \*\*SLA\*\*: 90\/100 \(p\. 3\)/, "a página corrigida pela conferência");
  assert.match(d.sections[1].content, /\*\*Foro\*\*: 10\/100 \(p\. 4, trecho não localizado\)/);
  assert.match(d.sections[2].content, /- \*\*SLA\*\*: 1 ocorrência \(p\. 3\)/);
  assert.match(d.sections[2].content, /- \*\*multa\*\*: 0 ocorrências$/m);
  assert.deepEqual(d.metadata.Páginas, 2);
  assert.equal(d.metadata["Palavras-chave"], "SLA, multa");
});

test("buildExportData com parecer: o parecer vem primeiro, resumo e análise como anexo; citações são os trechos verificados", () => {
  const d = buildExportData({ filename: "c.pdf", pages, keywords: ["SLA", "multa"], analysis, summary: { sections: [{ heading: "Contexto", content: "ctx" }] }, brief: { brief, sections: briefSections }, date: "26/10/2026" });
  assert.equal(d.title, "Parecer técnico: c");
  assert.deepEqual(d.sections.slice(0, 5).map((s) => s.heading), ["Objeto da Análise", "Metodologia", "Achados Principais", "Análise de Riscos", "Conclusão e Recomendações"]);
  assert.deepEqual(d.sections.slice(5).map((s) => s.heading), ["Anexo — Contexto", "Anexo — Relevância por seção", "Anexo — Palavras-chave", "Anexo — Pontos de atenção"]);
  assert.deepEqual(d.citations?.map((c) => c.label), ["SLA (p. 3): “disponibilidade mensal de 99,5%”", "multa (p. 4): “Multa de 0,5% ao dia sobre a parcela”"]);
});

test("buildExportData: tabela do Excel com seções e palavras-chave; sem análise nem resumo, uma seção avisando", () => {
  const d = buildExportData({ filename: "c.pdf", pages, keywords: [], analysis, date: "d" });
  assert.deepEqual(d.table?.columns, ["Tipo", "Item", "Relevância / ocorrências", "Páginas"]);
  assert.deepEqual(d.table?.rows[0], ["Seção", "SLA", 90, "p. 3"]);
  assert.deepEqual(d.table?.rows.at(-1), ["Palavra-chave", "multa", 0, ""]);
  const empty = buildExportData({ filename: "c.pdf", pages, keywords: [], date: "d" });
  assert.equal(empty.sections.length, 1);
  assert.equal(empty.table, undefined);
  assert.equal(empty.metadata["Palavras-chave"], "nenhuma");
  assert.deepEqual(empty.citations, []);
});
