import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkDocument } from "./chunker";
import { buildDocument, estimateTokens, PAGE_BREAK } from "./document";

const para = (tag: string, words: number) => Array.from({ length: words }, (_, i) => `${tag}${i}`).join(" ") + ".";

test("overlap: o fim de um chunk reaparece no começo do seguinte", () => {
  // 10 parágrafos de ~25 tokens; alvo 100 => ~4 por chunk, overlap 30% => 1 parágrafo repetido
  const paras = Array.from({ length: 10 }, (_, i) => para(`p${i}_`, 16));
  const doc = buildDocument(paras.join("\n\n"));
  const chunks = chunkDocument(doc, { targetTokens: 100, overlap: 0.3 });
  assert.ok(chunks.length >= 3);
  for (let k = 1; k < chunks.length; k++) {
    const prevLast = chunks[k - 1].content.split("\n\n").at(-1)!;
    assert.equal(chunks[k].content.split("\n\n")[0], prevLast, `chunk ${k} deve começar pelo fim do anterior`);
  }
  // todo parágrafo aparece
  for (const p of paras) assert.ok(chunks.some((c) => c.content.includes(p)));
});

test("sem overlap, nada se repete", () => {
  const doc = buildDocument(Array.from({ length: 8 }, (_, i) => para(`q${i}_`, 16)).join("\n\n"));
  const chunks = chunkDocument(doc, { targetTokens: 100, overlap: 0 });
  assert.equal(chunks.map((c) => c.content).join("\n\n").split("\n\n").length, 8);
});

test("startPage é a página do primeiro conteúdo novo", () => {
  const pages = [1, 2, 3].map((n) => Array.from({ length: 4 }, (_, i) => para(`pg${n}_${i}_`, 16)).join("\n\n"));
  const doc = buildDocument(pages.join(PAGE_BREAK));
  const chunks = chunkDocument(doc, { targetTokens: 100, overlap: 0.15 });
  for (const c of chunks) {
    const m = /pg(\d)_/.exec(c.content.split("\n\n").find((p) => p) ?? "")!;
    // o chunk contém texto de alguma página >= startPage-1 (trecho repetido pode vir da anterior)
    assert.ok(Number(m[1]) >= c.metadata.startPage - 1 && Number(m[1]) <= c.metadata.startPage);
  }
  assert.equal(chunks[0].metadata.startPage, 1);
  assert.equal(chunks.at(-1)!.metadata.startPage, 3);
  assert.deepEqual(chunks.map((c) => c.metadata.index), chunks.map((_, i) => i));
});

test("sectionTitle vem do último heading", () => {
  const doc = buildDocument(
    ["# Introdução", para("a", 10), "## Do prazo", para("b", 10), PAGE_BREAK + "\n" + para("c", 10)].join("\n\n"),
  );
  const chunks = chunkDocument(doc, { targetTokens: 20, overlap: 0 });
  const by = (s: string) => chunks.find((c) => c.content.includes(s))!;
  assert.equal(by("a0").metadata.sectionTitle, "Introdução");
  assert.equal(by("b0").metadata.sectionTitle, "Do prazo");
  assert.equal(by("c0").metadata.sectionTitle, "Do prazo", "a seção continua na página seguinte");
});

test("parágrafo gigante é dividido e nenhum chunk passa muito do alvo", () => {
  const doc = buildDocument(Array.from({ length: 300 }, (_, i) => `Frase número ${i} do texto.`).join(" "));
  const chunks = chunkDocument(doc, { targetTokens: 100, overlap: 0.15 });
  assert.ok(chunks.length > 5);
  for (const c of chunks) assert.ok(estimateTokens(c.content) <= 100 * 1.2, `chunk com ${estimateTokens(c.content)} tokens`);
});

test("texto sem pontuação nem quebras também é cortado", () => {
  const doc = buildDocument(Array.from({ length: 500 }, (_, i) => `palavra${i}`).join(" "));
  const chunks = chunkDocument(doc, { targetTokens: 100, overlap: 0 });
  assert.ok(chunks.length > 5);
  assert.equal(chunks.map((c) => c.content).join(" "), doc.text);
});

test("documento vazio => nenhum chunk", () => {
  assert.deepEqual(chunkDocument(buildDocument("")), []);
});
