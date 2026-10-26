import { test } from "node:test";
import assert from "node:assert/strict";
import { AnalyzeBody, checkAnalysis, DIRECT_LIMIT_TOKENS, groupPages, locateSnippet, needsMapReduce, pagesToText, type RawAnalysis } from "./analysis";

const pages = [
  { number: 1, content: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS. O objeto é o desenvolvimento do sistema de gestão documental." },
  { number: 2, content: "CLÁUSULA QUARTA – DO SLA. A CONTRATADA garantirá disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas." },
  { number: 3, content: "CLÁUSULA SÉTIMA – DAS PENALIDADES. Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%." },
];

test("locateSnippet: acha ignorando caixa, acento e pontuação; prefere a página citada; 'trecho…trecho' vale pelo maior pedaço", () => {
  assert.equal(locateSnippet("disponibilidade mensal de 99,5% e atendimento", pages), 2);
  assert.equal(locateSnippet("CLAUSULA SETIMA das penalidades", pages), 3);
  assert.equal(locateSnippet("Multa de 0,5% ao dia … limitada a 10%", pages, 3), 3);
  assert.equal(locateSnippet("texto que não existe no documento de jeito nenhum", pages), null);
  assert.equal(locateSnippet("curto", pages), null, "trecho curto demais não prova nada");
  // a mesma frase em duas páginas: vale a citada
  const dup = [{ number: 1, content: "prazo de vigência de doze meses" }, { number: 5, content: "prazo de vigência de doze meses" }];
  assert.equal(locateSnippet("prazo de vigência de doze meses", dup, 5), 5);
  assert.equal(locateSnippet("prazo de vigência de doze meses", dup, 9), 1);
});

const raw = (over: Partial<RawAnalysis> = {}): RawAnalysis => ({
  relevanceBySection: [
    { title: "SLA", score: 130.4, pageRef: 9, snippet: "disponibilidade mensal de 99,5%" }, // página errada, trecho real: corrige para 2
    { title: "Inventada", score: -5, pageRef: 1, snippet: "esta frase nunca esteve no documento original" },
  ],
  taxonomy: ["SLA", " sla ", "Penalidades", ""],
  keywordMatches: [{ keyword: "multa", occurrences: [{ context: "Multa de 0,5% ao dia sobre a parcela", page: 1 }, { context: "frase inventada que o modelo criou aqui", page: 2 }] }],
  summary: "  Resumo.  ",
  suggestions: ["a", "a", "b"],
  ...over,
});

test("checkAnalysis: nota 0–100 inteira, página corrigida pelo trecho real, trecho inventado não verificado", () => {
  const c = checkAnalysis(raw(), pages, ["SLA", "multa"]);
  assert.deepEqual(c.relevanceBySection[0], { title: "SLA", score: 100, pageRef: 2, snippet: "disponibilidade mensal de 99,5%", verified: true });
  assert.deepEqual(c.relevanceBySection[1], { title: "Inventada", score: 0, pageRef: 1, snippet: "esta frase nunca esteve no documento original", verified: false });
  assert.equal(c.summary, "Resumo.");
  assert.deepEqual(c.taxonomy, ["SLA", "Penalidades"]);
  assert.deepEqual(c.suggestions, ["a", "b"]);
});

test("checkAnalysis: uma entrada por palavra-chave pedida, na ordem; a que o modelo omitiu fica com 0; contagem só de verificadas", () => {
  const c = checkAnalysis(raw(), pages, ["SLA", "Multa", "rescisão"]);
  assert.deepEqual(c.keywordMatches.map((k) => [k.keyword, k.count]), [["SLA", 0], ["Multa", 1], ["rescisão", 0]]);
  const multa = c.keywordMatches[1];
  assert.equal(multa.occurrences[0].page, 3, "a página 1 citada foi corrigida para a 3");
  assert.equal(multa.occurrences[1].verified, false);
  // sem palavras-chave pedidas, mantém as que o modelo devolveu
  assert.deepEqual(checkAnalysis(raw(), pages, []).keywordMatches.map((k) => k.keyword), ["multa"]);
});

test("checkAnalysis: página fora do intervalo é limitada ao que existe; lixo numérico não quebra", () => {
  const c = checkAnalysis(raw({ relevanceBySection: [{ title: "x", score: Number.NaN, pageRef: 999, snippet: "nada disso existe no documento analisado" }, { title: "y", score: 50, pageRef: -4, snippet: "tampouco existe no documento analisado aqui" }] }), pages, []);
  assert.deepEqual(c.relevanceBySection.map((s) => [s.score, s.pageRef]), [[0, 3], [50, 1]]);
});

test("pagesToText marca cada página; needsMapReduce e groupPages respeitam o limite", () => {
  assert.equal(pagesToText([{ number: 4, content: " oi " }]), "[Página 4]\noi");
  assert.equal(needsMapReduce(pages), false);
  const big = Array.from({ length: 6 }, (_, i) => ({ number: i + 1, content: "x".repeat(100_000) })); // 25 mil tokens cada = 150 mil
  assert.equal(needsMapReduce(big), true);
  assert.ok(150_000 > DIRECT_LIMIT_TOKENS);
  const groups = groupPages(big, 60_000);
  assert.deepEqual(groups.map((g) => g.length), [2, 2, 2]);
  assert.deepEqual(groups.flat().map((p) => p.number), [1, 2, 3, 4, 5, 6], "ordem e conteúdo preservados");
  assert.deepEqual(groupPages([{ number: 1, content: "x".repeat(400_000) }, { number: 2, content: "y" }], 1000).map((g) => g.length), [1, 1], "página enorme fica sozinha");
  assert.deepEqual(groupPages([]), []);
});

test("AnalyzeBody: páginas obrigatórias, limites e padrões", () => {
  const ok = AnalyzeBody.parse({ pages: [{ number: 1, content: "texto" }] });
  assert.deepEqual([ok.keywords, ok.filename, ok.index], [[], "documento.pdf", true]);
  assert.ok(!AnalyzeBody.safeParse({ pages: [] }).success);
  assert.ok(!AnalyzeBody.safeParse({ pages: [{ number: 1, content: "   " }] }).success, "só espaços não é documento");
  assert.ok(!AnalyzeBody.safeParse({ pages: [{ number: 0, content: "x" }] }).success);
  assert.ok(!AnalyzeBody.safeParse({ pages: [{ number: 1, content: "x" }], keywords: Array.from({ length: 31 }, () => "a") }).success);
  assert.ok(!AnalyzeBody.safeParse({ pages: [{ number: 1, content: "x".repeat(2_000_001) }] }).success);
  assert.ok(!AnalyzeBody.safeParse({ pages: [{ number: 1, content: "x" }], summary: { size: "gigante", audience: "tecnico" } }).success);
  assert.equal(AnalyzeBody.parse({ pages: [{ number: 1, content: "x" }], keywords: [" multa "] }).keywords[0], "multa", "apara espaços");
});
