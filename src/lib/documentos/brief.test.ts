import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEF_EVIDENCE_TOKENS, BriefBody, briefToSections, checkBrief, methodologyFacts, selectEvidence, type RawBrief } from "./brief";
import { NO_INFO } from "@/lib/templates";

const pages = [
  { number: 3, content: "CLÁUSULA QUARTA – DO SLA. A CONTRATADA garantirá disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas." },
  { number: 4, content: "CLÁUSULA SÉTIMA – DAS PENALIDADES. Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%." },
  { number: 5, content: "CLÁUSULA OITAVA – DA RESCISÃO. O contrato poderá ser rescindido por inadimplemento, com aviso prévio de 30 dias." },
];

const raw = (over: Partial<RawBrief> = {}): RawBrief => ({
  objetoAnalise: "Contrato de TI.",
  metodologia: "Leitura integral.",
  achadosPrincipais: [
    { keyword: "multa", finding: "Multa de 0,5% ao dia.", pageRef: 9, quote: "Multa de 0,5% ao dia sobre a parcela em atraso" }, // página errada, trecho real (4)
    { keyword: "SLA", finding: "Disponibilidade de 99,5%.", pageRef: 3, quote: "disponibilidade mensal de 99,5%" },
    { keyword: "garantia", finding: "Garantia de 5%.", pageRef: 4, quote: "trecho que o modelo inventou sobre a garantia" },
  ],
  analiseRiscos: [
    { risk: "Multa sem teto claro", severity: "baixa", pageRef: 4, quote: "limitada a 10%" },
    { risk: "Aviso prévio curto", severity: "alta", pageRef: 5, quote: "aviso prévio de 30 dias" },
  ],
  conclusao: "Contrato viável.",
  recomendacoes: ["Revisar a cláusula 8", "  ", "Ajustar o SLA"],
  ...over,
});

test("checkBrief: página corrigida pelo trecho real; trecho inventado não verificado; riscos por gravidade", () => {
  const b = checkBrief(raw(), pages, ["SLA", "multa", "garantia"]);
  assert.deepEqual(b.achadosPrincipais.map((a) => [a.keyword, a.pageRef, a.verified]), [["SLA", 3, true], ["multa", 4, true], ["garantia", 4, false]]);
  assert.deepEqual(b.analiseRiscos.map((r) => [r.severity, r.pageRef, r.verified]), [["alta", 5, true], ["baixa", 4, true]]);
  assert.deepEqual(b.recomendacoes, ["Revisar a cláusula 8", "Ajustar o SLA"]);
});

test("checkBrief: toda palavra-chave pedida aparece nos achados, mesmo que o modelo a tenha omitido", () => {
  const b = checkBrief(raw(), pages, ["rescisão", "SLA", "multa", "garantia"]);
  assert.deepEqual(b.achadosPrincipais.map((a) => a.keyword), ["rescisão", "SLA", "multa", "garantia"], "na ordem pedida");
  const r = b.achadosPrincipais[0];
  assert.deepEqual([r.pageRef, r.quote, r.verified], [null, "", true]);
  assert.match(r.finding, /Nenhum trecho do documento/);
  // sem palavras-chave pedidas, mantém os achados do modelo
  assert.equal(checkBrief(raw(), pages, []).achadosPrincipais.length, 3);
});

test("checkBrief: seção vazia vira o aviso padrão; achado sem texto é descartado; página fora do intervalo é limitada", () => {
  const b = checkBrief(raw({ objetoAnalise: "  ", conclusao: "", metodologia: "x", achadosPrincipais: [{ keyword: "k", finding: " ", pageRef: 1, quote: "q" }, { keyword: "z", finding: "algo", pageRef: 999, quote: "nada disso existe no documento analisado aqui" }] }), pages, []);
  assert.equal(b.objetoAnalise, NO_INFO);
  assert.equal(b.conclusao, NO_INFO);
  assert.equal(b.achadosPrincipais.length, 1);
  assert.deepEqual([b.achadosPrincipais[0].pageRef, b.achadosPrincipais[0].verified], [5, false]);
});

test("briefToSections: as 5 seções do PRD, na ordem, com página e trecho só se verificado", () => {
  const b = checkBrief(raw(), pages, ["SLA", "multa", "garantia", "rescisão"]);
  const s = briefToSections(b, "**Documento:** x.pdf.");
  assert.deepEqual(s.map((x) => x.heading), ["Objeto da Análise", "Metodologia", "Achados Principais", "Análise de Riscos", "Conclusão e Recomendações"]);
  assert.ok(s.every((x) => x.content.trim()));
  assert.match(s[1].content, /Leitura integral\.\n\n\*\*Documento:\*\* x\.pdf\./);
  assert.match(s[2].content, /- \*\*SLA\*\*: Disponibilidade de 99,5%\. \(p\. 3\)\n {2}> disponibilidade mensal de 99,5%/);
  assert.match(s[2].content, /\*\*garantia\*\*: Garantia de 5%\. \(p\. 4, não localizado no texto\)/);
  assert.ok(!s[2].content.includes("trecho que o modelo inventou"), "trecho não verificado não é exibido como citação");
  assert.match(s[2].content, /\*\*rescisão\*\*: Nenhum trecho/);
  assert.match(s[3].content, /^- \*\*Alta\*\*: Aviso prévio curto \(p\. 5\)/);
  assert.match(s[4].content, /Contrato viável\.\n\n1\. Revisar a cláusula 8\n2\. Ajustar o SLA/);
  assert.match(briefToSections(checkBrief(raw({ analiseRiscos: [] }), pages, []), "")[3].content, /Nenhum risco relevante/);
});

test("methodologyFacts: documento, palavras-chave, modelo e data; aviso quando o parecer usa só parte das páginas", () => {
  const f = methodologyFacts({ filename: "c.pdf", pages: 60, keywords: ["SLA", "multa"], modelLabel: "Claude Opus 5.5", partial: true, date: "26/10/2026" });
  assert.match(f, /c\.pdf \(60 páginas; parecer baseado nas páginas mais relevantes/);
  assert.match(f, /SLA, multa/);
  assert.match(f, /Claude Opus 5\.5.* 26\/10\/2026/);
  assert.match(methodologyFacts({ filename: "c.pdf", pages: 1, keywords: [], modelLabel: "m", partial: false, date: "d" }), /1 página\b[\s\S]*\n\n\*\*Palavras-chave:\*\* nenhuma informada/);
});

const big = (n: number) => Array.from({ length: n }, (_, i) => ({ number: i + 1, content: `p${i + 1} ` + "x".repeat(40_000) })); // 10 mil tokens cada
const analysis = (over: object = {}) => ({
  relevanceBySection: [
    { title: "A", score: 40, pageRef: 2, snippet: "s", verified: true },
    { title: "B", score: 95, pageRef: 8, snippet: "s", verified: true },
    { title: "C", score: 99, pageRef: 5, snippet: "s", verified: false }, // não verificada: não vale
    { title: "D", score: 90, pageRef: 999, snippet: "s", verified: true }, // página que não existe
  ],
  taxonomy: [],
  keywordMatches: [{ keyword: "k", count: 1, occurrences: [{ context: "c", page: 3, verified: true }, { context: "c", page: 2, verified: true }] }],
  summary: "r",
  suggestions: [],
  ...over,
});

test("selectEvidence: documento pequeno vai inteiro; grande sem análise não tem como escolher", () => {
  const e = selectEvidence(pages)!;
  assert.deepEqual([e.pages.length, e.partial], [3, false]);
  assert.equal(selectEvidence(big(5)), null, "50 mil tokens, sem análise");
  assert.equal(selectEvidence(big(5), analysis())!.partial, true);
});

test("selectEvidence: páginas da análise por relevância, só verificadas e existentes, em ordem de página, dentro do orçamento", () => {
  const e = selectEvidence(big(10), analysis())!;
  assert.deepEqual(e.pages.map((p) => p.number), [2, 3, 8], "B(8), A(2) e as ocorrências (3, 2); C não verificada e D inexistente ficam de fora; ordenadas");
  const many = analysis({ relevanceBySection: Array.from({ length: 9 }, (_, i) => ({ title: `S${i}`, score: 90 - i, pageRef: i + 1, snippet: "s", verified: true })) });
  const capped = selectEvidence(big(20), many)!;
  assert.ok(capped.pages.length * 10_000 <= BRIEF_EVIDENCE_TOKENS + 1000, `${capped.pages.length} páginas`);
  assert.ok(capped.pages.length < 9);
  assert.equal(selectEvidence(big(10), analysis({ relevanceBySection: [], keywordMatches: [] })), null, "análise sem nada verificado");
});

test("BriefBody: páginas obrigatórias; análise limitada", () => {
  assert.ok(BriefBody.safeParse({ pages: [{ number: 1, content: "x" }] }).success);
  assert.ok(!BriefBody.safeParse({ pages: [] }).success);
  assert.ok(!BriefBody.safeParse({ pages: [{ number: 1, content: "  " }] }).success);
  assert.ok(!BriefBody.safeParse({ pages: [{ number: 1, content: "x" }], analysis: { ...analysis(), summary: "y".repeat(3001) } }).success);
  assert.ok(!BriefBody.safeParse({ pages: [{ number: 1, content: "x" }], analysis: { ...analysis(), keywordMatches: Array.from({ length: 31 }, () => ({ keyword: "k", occurrences: [] })) } }).success);
  assert.ok(BriefBody.safeParse({ pages: [{ number: 1, content: "x" }], analysis: analysis() }).success);
});
