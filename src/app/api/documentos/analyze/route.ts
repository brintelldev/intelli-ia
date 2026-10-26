import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { AnalyzeBody } from "@/lib/documentos/analysis";
import { runAnalysis, type AnalysisMessage } from "@/lib/documentos/analyze";
import { indexAnalyzedDocument } from "@/lib/documentos/index-document";
import { getModel } from "@/lib/llm";
import { errorResponse, requireRole } from "@/lib/session";
import { streamError } from "@/lib/stream-steps";
import { withMandatory } from "@/lib/templates";
import { getUsableTemplate } from "@/lib/templates-store";
import { assertWithinBudget, track, usageMeta } from "@/lib/usage";

// Análise do documento (itens 112 a 115): stream com etapas (`data-step`) e o objeto da análise crescendo
// (`data-analysis`, parcial e depois final). Erros ANTES do stream (400, 401, 403, 404, 429) saem como JSON.
export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const session = await requireRole(["Admin", "Analista"]);
    const parsed = AnalyzeBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
    const input = parsed.data;
    const userId = session.user.id;

    await assertWithinBudget(userId, "demo1");

    // modelo de seções: o rascunho inline vale mais que o salvo; o do servidor sempre ganha a seção obrigatória
    let template = input.template ?? null;
    if (!template && input.templateId) {
      const stored = await getUsableTemplate(input.templateId, userId);
      if (!stored || stored.module !== "demo1_summary") return Response.json({ error: "Modelo de seções não encontrado." }, { status: 404 });
      template = { sections: stored.sections, format: stored.format };
    }
    if (template) template = withMandatory(template, "demo1_summary");

    const main = await getModel("demo1", { userId, overrideModelId: input.modelId });
    const fast = await getModel("demo1", { userId, preferFallback: true });

    const stream = createUIMessageStream<AnalysisMessage>({
      onError: streamError,
      execute: async ({ writer }) => {
        writer.write({ type: "start" });
        try {
          const r = await runAnalysis({
            writer,
            input,
            template,
            models: { main: main.model, fast: fast.model },
            settings: main.settings,
            signal: req.signal,
            indexDocument: input.index ? (analysis) => indexAnalyzedDocument({ userId, filename: input.filename, pages: input.pages, analysis }) : undefined,
          });
          // o custo é o da análise + o de CADA chamada de notas por partes (outro modelo), calculado chamada a chamada
          const a = usageMeta(main.state, r.mainUsage);
          const calls = r.mapCalls.map((u) => usageMeta(fast.state, u));
          const m = calls.length
            ? {
                costUsd: calls.reduce((n, c) => n + (c.costUsd ?? 0), 0),
                inputTokens: calls.reduce((n, c) => n + (c.inputTokens ?? 0), 0),
                outputTokens: calls.reduce((n, c) => n + (c.outputTokens ?? 0), 0),
                modelId: fast.state.activeModelId,
                unknown: calls.some((c) => c.costUnknown),
              }
            : null;
          void track({
            module: "demo1",
            action: "pdf_analysis",
            userId,
            status: "success",
            durationMs: Date.now() - t0,
            metadata: {
              ...a,
              ...(m ? { costUsd: (a.costUsd ?? 0) + m.costUsd, mapModelId: m.modelId, mapInputTokens: m.inputTokens, mapOutputTokens: m.outputTokens, mapCalls: calls.length, ...(a.costUnknown || m.unknown ? { costUnknown: true } : {}) } : {}),
              title: input.filename,
              pages: input.pages.length,
              keywords: input.keywords.length,
              sections: r.checked.relevanceBySection.length,
              mapReduce: r.mapReduce,
            },
          });
        } catch (e) {
          void track({ module: "demo1", action: "pdf_analysis", userId, status: "error", durationMs: Date.now() - t0, metadata: { ...usageMeta(main.state, {}), title: input.filename, pages: input.pages.length } });
          throw e;
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    return errorResponse(e);
  }
}
