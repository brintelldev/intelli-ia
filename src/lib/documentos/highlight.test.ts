import { test } from "node:test";
import assert from "node:assert/strict";
import { findQuote, findTerms, highlightTerms, segmentsFor } from "./highlight";

const join = (s: { text: string }[]) => s.map((x) => x.text).join("");

test("highlightTerms: marca sem alterar o texto, ignorando caixa e acento", () => {
  const text = "A Rescisão do contrato; a RESCISAO imotivada. SLA e sla.";
  const seg = highlightTerms(text, ["rescisão", "SLA"]);
  assert.equal(join(seg), text, "a concatenação devolve o original");
  assert.deepEqual(seg.filter((s) => s.mark).map((s) => s.text), ["Rescisão", "RESCISAO", "SLA", "sla"]);
});

test("highlightTerms: o termo precisa começar numa palavra (multa marca multas, mas não 'consulta'), e termos curtos são ignorados", () => {
  assert.deepEqual(highlightTerms("multas e multa; consulta", ["multa"]).filter((s) => s.mark).map((s) => s.text), ["multa", "multa"]);
  assert.deepEqual(highlightTerms("a b c", ["a", ""]).filter((s) => s.mark), []);
  assert.deepEqual(highlightTerms("sem termo algum", []), [{ text: "sem termo algum", mark: false }]);
});

test("findTerms: termos que se sobrepõem viram um só intervalo; termo com acento no texto e sem na busca", () => {
  const text = "responsabilidade civil e responsabilidade";
  const r = findTerms(text, ["responsabilidade civil", "civil e resp", "responsabilidade"]);
  assert.deepEqual(r, [[0, text.length]], "os três se encadeiam e viram um intervalo só");
  assert.equal(findTerms(text, ["responsabilidade civil", "responsabilidade"]).length, 2, "o intervalo contíguo vira um e a 2ª ocorrência isolada, outro");
  assert.deepEqual(highlightTerms("garantia contratual: Garantía", ["garantia"]).filter((s) => s.mark).map((s) => s.text), ["garantia", "Garantía"]);
});

test("segmentsFor: intervalos vazios e nas pontas", () => {
  assert.deepEqual(segmentsFor("abc", []), [{ text: "abc", mark: false }]);
  assert.deepEqual(segmentsFor("abc", [[0, 3]]), [{ text: "abc", mark: true }]);
  assert.deepEqual(segmentsFor("abcd", [[1, 2]]), [{ text: "a", mark: false }, { text: "b", mark: true }, { text: "cd", mark: false }]);
});

const page = "CLÁUSULA QUARTA – DO SLA. A CONTRATADA garantirá disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas.";

test("findQuote: acha o trecho ignorando pontuação, caixa e espaços, e devolve a posição no texto original", () => {
  const r = findQuote(page, "disponibilidade mensal de 99,5%  e atendimento")!;
  assert.equal(page.slice(r[0], r[1]).toLowerCase(), "disponibilidade mensal de 99,5% e atendimento");
  const r2 = findQuote(page, "CLAUSULA quarta do sla")!;
  assert.equal(page.slice(r2[0], r2[1]), "CLÁUSULA QUARTA – DO SLA");
});

test("findQuote: 'trecho … trecho' vale pelo maior pedaço; trecho inexistente ou curto demais dá null", () => {
  const r = findQuote(page, "A CONTRATADA … incidentes críticos em até 2 horas")!;
  assert.equal(page.slice(r[0], r[1]), "incidentes críticos em até 2 horas");
  assert.equal(findQuote(page, "esta frase nunca esteve no documento"), null);
  assert.equal(findQuote(page, "SLA"), null);
});
