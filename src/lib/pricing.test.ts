import assert from "node:assert/strict";
import { test } from "node:test";
import { AVAILABLE_MODELS, isModelId, providerOf, apiModelName } from "./models";
import { PRICING, costUsd, rateFor } from "./pricing";

const D = (s: string) => new Date(`${s}T12:00:00Z`);

test("todo modelo do catálogo tem preço hoje, e a tabela não tem modelo fora do catálogo", () => {
  for (const m of AVAILABLE_MODELS) assert.ok(rateFor(m.id), `${m.id} sem preço`);
  assert.deepEqual(Object.keys(PRICING).sort(), AVAILABLE_MODELS.map((m) => m.id).sort());
});

test("catálogo: ids no formato provedor:modelo, únicos, com os 3 provedores do item 123", () => {
  const ids = AVAILABLE_MODELS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of AVAILABLE_MODELS) assert.match(m.id, /^(anthropic|openai|google):[\w.\-]+$/);
  assert.deepEqual([...new Set(AVAILABLE_MODELS.map((m) => m.provider))].sort(), ["anthropic", "google", "openai"]);
  assert.equal(providerOf("openai:gpt-6.1-sol"), "openai");
  assert.equal(apiModelName("anthropic:claude-sonnet-5-5"), "claude-sonnet-5-5");
  assert.equal(isModelId("anthropic/claude-sonnet-5.5"), false); // formato antigo do OpenRouter
});

test("custo: 1M de entrada + 1M de saída bate com a tabela oficial", () => {
  const now = D("2026-11-01");
  assert.equal(costUsd("anthropic:claude-sonnet-5-5", 1e6, 1e6, now), 12); // 2 + 10
  assert.equal(costUsd("anthropic:claude-opus-5-5", 1e6, 1e6, now), 24); // 4 + 20
  assert.equal(costUsd("openai:gpt-6.1-sol", 1e6, 1e6, now), 12);
  assert.equal(costUsd("google:gemini-3.8-flash", 1e6, 1e6, now), 4.5); // 0,75 + 3,75
});

test("custo: valor pequeno e proporcional (análise de ~40k tokens com Sonnet)", () => {
  // 40.000 entrada * $2/M + 3.000 saída * $10/M = 0,08 + 0,03
  assert.ok(Math.abs(costUsd("anthropic:claude-sonnet-5-5", 40_000, 3_000, D("2026-11-01")) - 0.11) < 1e-9);
  assert.equal(costUsd("anthropic:claude-sonnet-5-5", 0, 0), 0); // zero tokens = zero, mas com preço conhecido
});

test("Gemini 3.8 Flash dobra de preço em 01/01/2027", () => {
  assert.equal(costUsd("google:gemini-3.8-flash", 1e6, 0, D("2026-12-31")), 0.75);
  assert.equal(costUsd("google:gemini-3.8-flash", 1e6, 0, D("2027-01-01")), 1.5);
  assert.equal(costUsd("google:gemini-3.8-flash", 0, 1e6, D("2027-03-15")), 7.5);
});

test("Haiku 5.5: faixa de prompt longo acima de 100 mil tokens de entrada", () => {
  const at = D("2026-11-01");
  assert.ok(Math.abs(costUsd("anthropic:claude-haiku-5-5", 100_000, 0, at) - 0.01) < 1e-12); // ainda faixa curta
  assert.ok(Math.abs(costUsd("anthropic:claude-haiku-5-5", 100_001, 0, at) - 0.0500005) < 1e-9); // faixa longa: US$ 0,50/M
});

test("modelo sem preço ou tokens inválidos LANÇAM erro (nunca custo 0 silencioso)", () => {
  assert.throws(() => costUsd("meta:llama", 10, 10), /Sem preço/);
  assert.throws(() => costUsd("anthropic/claude-sonnet-5.5", 10, 10), /Sem preço/);
  assert.throws(() => costUsd("anthropic:claude-sonnet-5-5", -1, 10), /inválidos/);
  assert.throws(() => costUsd("anthropic:claude-sonnet-5-5", NaN, 10), /inválidos/);
  assert.equal(rateFor("anthropic:claude-sonnet-5-5", D("1999-01-01")), null); // antes da primeira vigência
});
