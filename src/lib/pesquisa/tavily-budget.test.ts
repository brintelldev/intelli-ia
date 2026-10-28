import { test } from "node:test";
import assert from "node:assert/strict";
import { tavilyUsage } from "./tavily-usage";

test("usage.credits real, inclusive zero; ausente/inválido reserva um crédito conservador", () => {
  assert.deepEqual(tavilyUsage({ usage: { credits: 0 } }), { tavilyCredits: 0, tavilyUsageUnknown: false });
  assert.deepEqual(tavilyUsage({ usage: { credits: 0.6 } }), { tavilyCredits: 0.6, tavilyUsageUnknown: false });
  for (const v of [null, {}, { usage: { credits: -1 } }, { usage: { credits: "1" } }]) {
    assert.deepEqual(tavilyUsage(v), { tavilyCredits: 1, tavilyUsageUnknown: true });
  }
});

test("reserva durável ANTES da chamada paga; falha de reconciliação conserva o crédito reservado", async () => {
  const { createTavilyBudget } = await import("./tavily-budget-core");
  let reserved = 0;
  const gate = createTavilyBudget({ reserve: async () => { reserved++; return "evento"; },
    settle: async () => { throw Error("banco caiu depois de consumir crédito"); } });
  const result = await gate("search", async () => {
    assert.equal(reserved, 1); return { usage: { credits: 1 }, results: [] };
  });
  assert.deepEqual(result, { usage: { credits: 1 }, results: [] }); assert.equal(reserved, 1);
});

test("sem reserva confirmada nunca há chamada paga; falha de rede conserva reserva", async () => {
  const { createTavilyBudget } = await import("./tavily-budget-core");
  for (const reserve of [async () => null, async (): Promise<string> => { throw Error("commit falhou"); }]) {
    const gate = createTavilyBudget({ reserve, settle: async () => { assert.fail(); } });
    assert.equal(await gate("search", async () => { assert.fail("chamada sem reserva"); }), null);
  }
  let settled: unknown;
  const gate = createTavilyBudget({ reserve: async () => "evento", settle: async (_id, data) => { settled = data; } });
  assert.equal(await gate("extract", async () => { throw Error("chave secreta"); }), null);
  assert.deepEqual(settled, { status: "error", tavilyCredits: 1, tavilyUsageUnknown: true });
});
