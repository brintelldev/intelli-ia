import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { reserveTavilyCredit, getMonthlyTavilyCredits } from "./tavily-budget";
const tag = `t20-${randomUUID()}`;
after(() => prisma.$disconnect());

test("créditos: soma mensal UTC, ignora mês anterior e sintéticos; teto 850 bloqueia search e extract", { timeout: 15_000 }, async () => {
  const rollback = new Error("rollback do teste");
  await assert.rejects(prisma.$transaction(async (tx) => {
    const baseline = await getMonthlyTavilyCredits(tx);
    assert.ok(baseline < 849, "dev precisa de ao menos dois créditos disponíveis para este teste");
    const now = new Date();
    await tx.usageEvent.createMany({ data: [
      { module: "demo2", action: "tavily_search", status: "success", metadata: { tavilyCredits: 849 - baseline, testTag: tag } },
      { module: "demo2", action: "tavily_search", status: "success", metadata: { tavilyCredits: 999, synthetic: true }, createdAt: now },
      { module: "demo2", action: "tavily_search", status: "success", metadata: { tavilyCredits: 999 }, createdAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)) },
    ] });
    assert.equal(await getMonthlyTavilyCredits(tx), 849);
    assert.ok(await reserveTavilyCredit(tx, "search"));
    assert.equal(await getMonthlyTavilyCredits(tx), 850);
    for (const operation of ["search", "extract"] as const) assert.equal(await reserveTavilyCredit(tx, operation), null);
    throw rollback;
  }), (e) => e === rollback);
});

test("concorrência: quatro chamadas com um crédito disponível fazem só uma chamada paga; falha posterior mantém reserva", async () => {
  const { createTavilyBudget } = await import("./tavily-budget-core");
  const ids: string[] = [];
  let calls = 0;
  try {
    const baseline = await getMonthlyTavilyCredits();
    assert.ok(baseline < 849);
    const fixture = await prisma.usageEvent.create({ data: { module: "demo2", action: "tavily_search", status: "success", metadata: { tavilyCredits: 849 - baseline, testTag: tag } } });
    ids.push(fixture.id);
    const gate = createTavilyBudget({ reserve: async (operation) => {
      const id = await prisma.$transaction((tx) => reserveTavilyCredit(tx, operation));
      if (id) ids.push(id);
      return id;
    }, settle: async () => { throw Error("banco falhou depois da chamada paga"); } });
    const results = await Promise.all(Array.from({ length: 4 }, () => gate("search", async () => {
      calls++; return { usage: { credits: 1 }, results: [] };
    })));
    assert.equal(calls, 1); assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await getMonthlyTavilyCredits(), 850);
    const reservation = await prisma.usageEvent.findUniqueOrThrow({ where: { id: ids[1] } });
    assert.equal((reservation.metadata as { tavilyPending: boolean }).tavilyPending, true);
  } finally { await prisma.usageEvent.deleteMany({ where: { id: { in: ids } } }); }
});
