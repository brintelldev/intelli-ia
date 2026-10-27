import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, PAGE_BREAK } from "./document";

test("separa as páginas pelo marcador e numera de 1", () => {
  const d = buildDocument(`a b c${PAGE_BREAK}\nd e f\n${PAGE_BREAK}g`);
  assert.deepEqual(d.pages.map((p) => [p.number, p.content]), [[1, "a b c"], [2, "d e f"], [3, "g"]]);
});

test("escaneado = páginas praticamente vazias de texto; página curta de PDF digital NÃO é escaneada", () => {
  const vazias = Array.from({ length: 3 }, () => "").join(PAGE_BREAK);
  const carimbo = Array.from({ length: 4 }, () => "Página 3 de 4").join(PAGE_BREAK); // só um rodapé por página
  const curtasDigitais = Array.from({ length: 3 }, () => "x".repeat(400)).join(PAGE_BREAK); // 100 tokens/página de texto de verdade
  const longas = Array.from({ length: 3 }, () => "x".repeat(1200)).join(PAGE_BREAK); // 300 tokens/página
  assert.equal(buildDocument(vazias).isScanned, true);
  assert.equal(buildDocument(carimbo).isScanned, true);
  assert.equal(buildDocument("").isScanned, true);
  assert.equal(buildDocument(curtasDigitais).isScanned, false, "média < 200, mas nenhuma página vazia: tem texto");
  assert.equal(buildDocument(longas).isScanned, false);
});

test("escaneado misto: a maioria das páginas vazias (60%) basta, mesmo com algumas páginas de texto", () => {
  const texto = "x".repeat(400);
  const misto = [texto, "", "", "", texto].join(PAGE_BREAK); // 3 de 5 vazias = 60%
  assert.equal(buildDocument(misto).isScanned, true);
  const quase = [texto, texto, "", "", texto].join(PAGE_BREAK); // 2 de 5 vazias = 40%
  assert.equal(buildDocument(quase).isScanned, false);
});
