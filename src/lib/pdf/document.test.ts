import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, PAGE_BREAK } from "./document";

test("separa as páginas pelo marcador e numera de 1", () => {
  const d = buildDocument(`a b c${PAGE_BREAK}\nd e f\n${PAGE_BREAK}g`);
  assert.deepEqual(d.pages.map((p) => [p.number, p.content]), [[1, "a b c"], [2, "d e f"], [3, "g"]]);
});

test("escaneado: média abaixo de 200 tokens por página", () => {
  const poucas = Array.from({ length: 3 }, () => "x".repeat(400)).join(PAGE_BREAK); // 100 tokens/página
  const muitas = Array.from({ length: 3 }, () => "x".repeat(1200)).join(PAGE_BREAK); // 300 tokens/página
  assert.equal(buildDocument(poucas).isScanned, true);
  assert.equal(buildDocument(muitas).isScanned, false);
  assert.equal(buildDocument("").isScanned, true);
});
