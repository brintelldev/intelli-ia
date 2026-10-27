import "@/lib/zod-pt";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { selectEvidence } from "@/lib/documentos/brief";
import { runSummary, type SummaryMessage } from "@/lib/documentos/summary-run";
import { SummaryBody } from "@/lib/documentos/summary";
import { getModel } from "@/lib/llm";
import { errorResponse, requireRole } from "@/lib/session";
import { streamError } from "@/lib/stream-steps";
import { withMandatory } from "@/lib/templates";
import { getUsableTemplate } from "@/lib/templates-store";
import { assertWithinBudget, track, usageMeta } from "@/lib/usage";

// Refaz SÓ o resumo (item 115) com o tamanho e o público escolhidos, sem repetir a análise: bem mais barato e rápido.
// Com `template`/`templateId`, o resumo sai nas seções da pessoa (sempre com "Metodologia").
export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const session = await requireRole(["Admin", "Analista"]);
    const parsed = SummaryBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
    const input = parsed.data;
    const userId = session.user.id;

    const evidence = selectEvidence(input.pages, input.analysis);
    if (!evidence) return Response.json({ error: "Este documento é grande: faça a análise antes de gerar o resumo.", code: "analysis_required" }, { status: 400 });

    await assertWithinBudget(userId, "demo1");

    let template = input.template ?? null;
    if (!template && input.templateId) {
      const stored = await getUsableTemplate(input.templateId, userId);
      if (!stored || stored.module !== "demo1_summary") return Response.json({ error: "Modelo de seções não encontrado." }, { status: 404 });
      template = { sections: stored.sections, format: stored.format };
    }
    if (template) template = withMandatory(template, "demo1_summary");

    const sel = await getModel("demo1", { userId, overrideModelId: input.modelId });
    const stream = createUIMessageStream<SummaryMessage>({
      onError: streamError,
      execute: async ({ writer }) => {
        writer.write({ type: "start" });
        try {
          const r = await runSummary({ writer, input, evidence, template, model: sel.model, settings: sel.settings, signal: req.signal });
          void track({
            module: "demo1",
            action: "summary_generation",
            userId,
            status: "success",
            durationMs: Date.now() - t0,
            metadata: { ...usageMeta(sel.state, r.usage), title: input.filename, pages: input.pages.length, size: input.summary.size, audience: input.summary.audience, sections: r.sections?.length ?? 0, partialEvidence: evidence.partial },
          });
        } catch (e) {
          void track({ module: "demo1", action: "summary_generation", userId, status: "error", durationMs: Date.now() - t0, metadata: { ...usageMeta(sel.state, {}), title: input.filename } });
          throw e;
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    return errorResponse(e);
  }
}
