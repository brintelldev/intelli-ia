import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisFromChecked, analysisFromPartial, briefFromChecked, briefFromPartial, scoreTone } from "./views";
import { checkAnalysis } from "./analysis";
import { checkBrief, briefToSections, methodologyFacts } from "./brief";

test("scoreTone: verde acima de 70, amarelo de 30 a 70, vermelho abaixo de 30 (nos limites)", () => {
  assert.deepEqual([100, 71, 70.5].map(scoreTone), ["high", "high", "high"]);
  assert.deepEqual([70, 50, 30].map(scoreTone), ["mid", "mid", "mid"]);
  assert.deepEqual([29.9, 10, 0].map(scoreTone), ["low", "low", "low"]);
});

test("analysisFromPartial: só entra seção com título; nota ausente vira 0 e é limitada; campos faltantes não quebram", () => {
  const v = analysisFromPartial({
    relevanceBySection: [{ title: "SLA", score: 150, pageRef: 3 }, { score: 90 }, undefined, { title: "Multas" }] as never,
    taxonomy: ["a", undefined, " "] as never,
    keywordMatches: [{ keyword: "SLA", occurrences: [{ context: "trecho", page: 3 }, { page: 9 }] }, { occurrences: [] }] as never,
  });
  assert.deepEqual(v.sections.map((s) => [s.title, s.score]), [["SLA", 100], ["Multas", 0]]);
  assert.deepEqual(v.taxonomy, ["a"]);
  assert.deepEqual(v.keywords, [{ keyword: "SLA", occurrences: [{ context: "trecho", page: 3 }] }]);
  assert.equal(v.complete, false);
  assert.deepEqual(analysisFromPartial(undefined), { summary: undefined, taxonomy: [], sections: [], keywords: [], suggestions: [], complete: false });
});

test("analysisFromChecked mantém verified e a contagem", () => {
  const pages = [{ number: 3, content: "A CONTRATADA garantirá disponibilidade mensal de 99,5% e atendimento de incidentes." }];
  const c = checkAnalysis({ relevanceBySection: [{ title: "SLA", score: 90, pageRef: 1, snippet: "disponibilidade mensal de 99,5%" }], taxonomy: [], keywordMatches: [{ keyword: "SLA", occurrences: [{ context: "disponibilidade mensal de 99,5%", page: 3 }] }], summary: "s", suggestions: [] }, pages, ["SLA"]);
  const v = analysisFromChecked(c);
  assert.deepEqual([v.sections[0].pageRef, v.sections[0].verified, v.keywords[0].count, v.complete], [3, true, 1, true]);
});

test("briefFromChecked separa o texto do modelo dos fatos objetivos da Metodologia", () => {
  const pages = [{ number: 2, content: "Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%." }];
  const b = checkBrief({ objetoAnalise: "o", metodologia: "Leitura integral.", achadosPrincipais: [{ keyword: "multa", finding: "f", pageRef: 2, quote: "Multa de 0,5% ao dia sobre a parcela" }], analiseRiscos: [], conclusao: "c", recomendacoes: ["r"] }, pages, ["multa"]);
  const sections = briefToSections(b, methodologyFacts({ filename: "c.pdf", pages: 1, keywords: ["multa"], modelLabel: "Opus", partial: false, date: "26/10/2026" }));
  const v = briefFromChecked(b, sections);
  assert.equal(v.metodologia, "Leitura integral.");
  assert.match(v.facts!, /^\*\*Documento:\*\* c\.pdf/);
  assert.doesNotMatch(v.facts!, /Leitura integral/);
  assert.equal(briefFromChecked(b).facts, undefined, "sem as seções, não há fatos separados");
  assert.deepEqual([v.achados[0].pageRef, v.achados[0].verified, v.complete], [2, true, true]);
});

test("briefFromPartial: achados sem texto são ignorados, gravidade inválida some, página ausente vira null", () => {
  const v = briefFromPartial({ objetoAnalise: "x", achadosPrincipais: [{ keyword: "k", finding: "f" }, { keyword: "j" }] as never, analiseRiscos: [{ risk: "r", severity: "gravissima", pageRef: 4 }] as never, recomendacoes: ["a", undefined] as never });
  assert.deepEqual(v.achados, [{ keyword: "k", finding: "f", pageRef: null, quote: "" }]);
  assert.deepEqual(v.riscos, [{ risk: "r", severity: undefined, pageRef: 4, quote: "" }]);
  assert.deepEqual(v.recomendacoes, ["a"]);
  assert.equal(v.complete, false);
});
