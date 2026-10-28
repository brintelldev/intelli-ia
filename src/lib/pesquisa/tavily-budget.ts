import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { TAVILY_CREDIT_LIMIT } from "./tavily-usage";
import { createTavilyBudget } from "./tavily-budget-core";
import type { TavilyOperation } from "./search-core";

/** Mês civil UTC. Não usa o fuso local do dashboard: cota é do provedor, não do usuário. */
export async function getMonthlyTavilyCredits(db: Prisma.TransactionClient = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ credits: number }[]>(Prisma.sql`
    SELECT COALESCE(SUM((metadata->>'tavilyCredits')::double precision), 0) AS credits
    FROM "UsageEvent"
    WHERE "createdAt" >= date_trunc('month', now() AT TIME ZONE 'UTC')
      AND "createdAt" < date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
      AND jsonb_typeof(metadata->'tavilyCredits') = 'number'
      AND metadata->>'synthetic' IS DISTINCT FROM 'true'`);
  return rows[0]?.credits ?? 0;
}

/** O lock transacional serializa só check + reserva em todas as instâncias, sem segurar rede. */
export async function reserveTavilyCredit(db: Prisma.TransactionClient, operation: TavilyOperation): Promise<string | null> {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(20261026, 20)`;
  const spent = await getMonthlyTavilyCredits(db);
  if (spent + 1 > TAVILY_CREDIT_LIMIT) return null;
  const event = await db.usageEvent.create({ data: {
    module: "demo2", action: operation === "search" ? "tavily_search" : "tavily_extract", status: "error",
    // Conservador até receber usage.credits. Não guardar chave, consulta ou conteúdo.
    // Sem userId: excluir uma conta não apaga o consumo global da chave.
    metadata: { tavilyCredits: 1, tavilyUsageUnknown: true, tavilyPending: true, provider: "tavily", operation },
  } });
  return event.id;
}

/** Banco fora do ar antes da reserva: só SearXNG. Depois: mantém o crédito reservado. */
export const runTavily = createTavilyBudget({
  reserve: (operation) => prisma.$transaction((tx) => reserveTavilyCredit(tx, operation), { timeout: 10_000, maxWait: 10_000 }),
  settle: async (id, { status, ...usage }) => {
    await prisma.usageEvent.update({ where: { id }, data: { status,
      metadata: { ...usage, tavilyPending: false, provider: "tavily" },
    } });
  },
});
