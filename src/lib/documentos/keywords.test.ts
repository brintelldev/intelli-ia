import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanKeywords, EXCERPT_CHARS, excerptForPrompt, SuggestBody } from "./keywords";

test("excerptForPrompt: texto curto passa inteiro; longo vira começo + meio + fim, dentro do limite", () => {
  assert.equal(excerptForPrompt("  curto  "), "curto");
  const t = "A".repeat(30_000) + "M".repeat(30_000) + "Z".repeat(30_000);
  const e = excerptForPrompt(t);
  assert.ok(e.length <= EXCERPT_CHARS + 20, `len=${e.length}`);
  assert.ok(e.startsWith("A") && e.endsWith("Z") && e.includes("M"), "tem começo, meio e fim");
  assert.equal(e.split("[…]").length, 3);
});

test("cleanKeywords: limpa marcadores, vazios, duplicados e já informados (sem caixa e sem acento)", () => {
  const out = cleanKeywords(["- Rescisão", "1. Multa contratual.", "  ", "SLA", "rescisao", "Multa Contratual", "Responsabilidade civil;", "•  Prazo de vigência"], ["sla"]);
  assert.deepEqual(out, ["Rescisão", "Multa contratual", "Responsabilidade civil", "Prazo de vigência"]);
});

test("cleanKeywords: descarta frases e textos longos, respeita o máximo", () => {
  assert.deepEqual(cleanKeywords(["o contrato prevê que a parte devedora deverá pagar multa", "x".repeat(61), "ok"]), ["ok"]);
  const many = Array.from({ length: 30 }, (_, i) => `termo ${i}`);
  assert.equal(cleanKeywords(many).length, 10);
  assert.equal(cleanKeywords(many, [], 3).length, 3);
});

test("SuggestBody: exige texto; limita as palavras-chave já informadas", () => {
  assert.ok(SuggestBody.safeParse({ text: "conteúdo" }).success);
  assert.ok(!SuggestBody.safeParse({ text: "" }).success);
  assert.ok(!SuggestBody.safeParse({}).success);
  assert.ok(!SuggestBody.safeParse({ text: "x", existing: Array.from({ length: 51 }, () => "a") }).success);
});
