import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { BriefBody, selectEvidence } from "@/lib/documentos/brief";
import { runBrief, type BriefMessage } from "@/lib/documentos/brief-run";
import { getDisabledProviders, getModel } from "@/lib/llm";
import { AVAILABLE_MODELS } from "@/lib/models";
import { errorResponse, requireRole } from "@/lib/session";
import { streamError } from "@/lib/stream-steps";
import { assertWithinBudget, track, usageMeta } from "@/lib/usage";

// Parecer técnico (item 116): 5 seções fixas, cada achado com página e trecho. Por padrão usa o Opus (o parecer é a
// saída que vai para o documento final); sem a Anthropic ativa, cai no modelo configurado do módulo.
const DEFAULT_BRIEF_MODEL = "anthropic:claude-opus-5-5";
const TZ = process.env.APP_TIMEZONE?.trim() || "America/Sao_Paulo";

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const session = await requireRole(["Admin", "Analista"]);
    const parsed = BriefBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
    const input = parsed.data;
    const userId = session.user.id;

    // documento grande sem análise: escolher páginas às cegas daria um parecer sem base
    const evidence = selectEvidence(input.pages, input.analysis);
    if (!evidence) {
      return Response.json({ error: "Este documento é grande: faça a análise antes de gerar o parecer.", code: "analysis_required" }, { status: 400 });
    }

    await assertWithinBudget(userId, "demo1");
    const disabled = await getDisabledProviders();
    const sel = await getModel("demo1", { userId, overrideModelId: input.modelId ?? (disabled.includes("anthropic") ? undefined : DEFAULT_BRIEF_MODEL) });
    const labelOf = (id: string) => AVAILABLE_MODELS.find((m) => m.id === id)?.label ?? id;

    const stream = createUIMessageStream<BriefMessage>({
      onError: streamError,
      execute: async ({ writer }) => {
        writer.write({ type: "start" });
        try {
          const r = await runBrief({
            writer,
            input,
            evidence,
            model: sel.model,
            settings: sel.settings,
            modelLabel: () => labelOf(sel.state.activeModelId),
            date: new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short" }).format(new Date()),
            signal: req.signal,
          });
          void track({
            module: "demo1",
            action: "brief_generation",
            userId,
            status: "success",
            durationMs: Date.now() - t0,
            metadata: {
              ...usageMeta(sel.state, r.usage),
              title: input.filename,
              pages: input.pages.length,
              keywords: input.keywords.length,
              findings: r.brief.achadosPrincipais.length,
              risks: r.brief.analiseRiscos.length,
              partialEvidence: evidence.partial,
            },
          });
        } catch (e) {
          void track({ module: "demo1", action: "brief_generation", userId, status: "error", durationMs: Date.now() - t0, metadata: { ...usageMeta(sel.state, {}), title: input.filename } });
          throw e;
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    return errorResponse(e);
  }
}
