import { Prisma } from "@/generated/prisma/client";
import { HttpError } from "@/lib/http-error";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";
import {
  BUDGET_MESSAGES,
  checkBudget,
  createTrack,
  maskPII,
  oneLine,
  resolveTimeZone,
  type Limits,
  type Spent,
} from "@/lib/usage-core";

// Métricas, limite diário de custo e filtro de conteúdo. As regras puras estão em usage-core.ts.
//
// Padrão de uso em toda rota de IA:
//
//   const t0 = Date.now();
//   const session = await requireRole([...]);
//   await assertWithinBudget(session.user.id, "demo1");            // 429 se estourou o limite
//   const sel = await getModel("demo1", { userId: session.user.id });
//   const result = streamText({
//     model: sel.model, ...sel.settings, prompt,
//     // AI SDK 7: `onFinish` é alias obsoleto de `onEnd`; `usage` é só do ÚLTIMO passo, `totalUsage` soma todos
//     onEnd: ({ totalUsage }) => void track({                      // sem await: nunca atrasa a resposta
//       module: "demo1", action: "pdf_analysis", userId: session.user.id, status: "success",
//       durationMs: Date.now() - t0, metadata: { ...usageMeta(sel.state, totalUsage), title: filename },
//     }),
//     onError: ({ error }) => void track({ ..., status: "error", metadata: { error: String(error) } }),
//   });

/** Grava um UsageEvent. Nunca lança nem rejeita: uma métrica jamais derruba a resposta. Chame sem `await`. */
export const track = createTrack((data) =>
  prisma.usageEvent.create({ data: { ...data, metadata: data.metadata as Prisma.InputJsonObject } }),
);

export { usageMeta } from "./usage-cost";

// ── orçamento diário ─────────────────────────────────────────────────────────────────

/** Fuso da virada do dia (padrão America/Sao_Paulo; configurável por APP_TIMEZONE). */
const TZ = resolveTimeZone(process.env.APP_TIMEZONE);

type SpentRow = { user_cost: number | null; module_cost: number | null; global_cost: number | null };

/**
 * Custo acumulado HOJE (no fuso configurado) por usuário, por módulo e no total. O início do dia
 * é calculado no próprio Postgres, para não depender de aritmética de fuso no JavaScript.
 */
export async function getDailySpend(userId: string | null, module: string | null): Promise<Spent> {
  const rows = await prisma.$queryRaw<SpentRow[]>(Prisma.sql`
    WITH bounds AS (
      SELECT ((date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC') AS start_utc
    )
    SELECT
      SUM((e.metadata->>'costUsd')::double precision) FILTER (WHERE e."userId" = ${userId ?? ""}) AS user_cost,
      SUM((e.metadata->>'costUsd')::double precision) FILTER (WHERE e.module = ${module ?? ""}) AS module_cost,
      SUM((e.metadata->>'costUsd')::double precision) AS global_cost
    FROM "UsageEvent" e, bounds
    WHERE e."createdAt" >= bounds.start_utc
      AND jsonb_typeof(e.metadata->'costUsd') = 'number'
      AND COALESCE(e.metadata->>'synthetic','false') <> 'true'`);
  const r = rows[0];
  return { user: r?.user_cost ?? 0, module: r?.module_cost ?? 0, global: r?.global_cost ?? 0 };
}

/** Limites diários em USD: do usuário, do módulo (LlmConfig) e global (AppSetting). null = sem limite. */
export async function getDailyLimits(userId: string | null, module: string | null): Promise<Limits> {
  const [user, cfg, global] = await Promise.all([
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { costLimitDay: true } }) : null,
    module ? prisma.llmConfig.findUnique({ where: { module }, select: { costLimitDay: true } }) : null,
    prisma.appSetting.findUnique({ where: { key: "globalCostLimitDay" } }),
  ]);
  return {
    user: user?.costLimitDay ?? null,
    module: cfg?.costLimitDay ?? null,
    global: typeof global?.value === "number" ? global.value : null,
  };
}

/**
 * Lança 429 (com mensagem amigável e `code` budget_user | budget_module | budget_global) se o gasto
 * de hoje já alcançou algum limite. Verificado ANTES da chamada: a última chamada pode ultrapassar o
 * limite um pouco, porque o custo só é conhecido depois. Se a consulta falhar, libera (não derruba a
 * demonstração por causa de um erro de contabilidade) e registra no log.
 */
export async function assertWithinBudget(userId: string, module?: "demo1" | "demo2" | "demo3"): Promise<void> {
  let block;
  try {
    const [spent, limits] = await Promise.all([
      getDailySpend(userId, module ?? null),
      getDailyLimits(userId, module ?? null),
    ]);
    block = checkBudget(spent, limits);
  } catch (e) {
    console.error("[usage] não consegui verificar o orçamento, liberando a chamada:", oneLine(e));
    return;
  }
  if (block) {
    const { code, message } = BUDGET_MESSAGES[block.scope];
    throw new HttpError(429, message, code);
  }
}

// ── filtro de conteúdo por perfil ─────────────────────────────────────────────────────

/** AppSetting.contentFilters = { [perfil]: boolean }. Sem perfil identificado, mascara (falha para o lado seguro). */
export async function isMaskingEnabled(role: Role | null | undefined): Promise<boolean> {
  if (!role) return true;
  const row = await prisma.appSetting.findUnique({ where: { key: "contentFilters" } });
  const v = row?.value;
  return typeof v === "object" && v !== null && !Array.isArray(v) && (v as Record<string, unknown>)[role] === true;
}

/** Mascara CPF, e-mail e telefone se o filtro estiver ligado para o perfil. Aplique ao texto completo, não a pedaços de stream. */
export async function maskForRole(text: string, role: Role | null | undefined): Promise<string> {
  return (await isMaskingEnabled(role)) ? maskPII(text) : text;
}
