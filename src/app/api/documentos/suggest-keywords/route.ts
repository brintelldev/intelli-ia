import { withPresentation } from "@/lib/replay";
import "@/lib/zod-pt";
import { generateText, Output } from "ai";
import { z } from "zod";
import { cleanKeywords, excerptForPrompt, KEYWORD_SYSTEM, MAX_KEYWORDS, SuggestBody } from "@/lib/documentos/keywords";
import { getModel } from "@/lib/llm";
import { errorResponse, requireRole } from "@/lib/session";
import { withUntrustedRule, wrapUntrusted } from "@/lib/untrusted";
import { assertWithinBudget, track, usageMeta } from "@/lib/usage";

// Sugestão de palavras-chave a partir do texto do documento. Tarefa auxiliar e barata: usa o modelo de FALLBACK
// configurado do módulo como principal (o principal fica de reserva). Com o limite de custo do dia estourado: 429.
const TIMEOUT_MS = 25_000;

async function livePOST(req: Request) {
  const t0 = Date.now();
  try {
    const session = await requireRole(["Admin", "Analista"]);
    const parsed = SuggestBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
    const { text, existing = [], filename } = parsed.data;

    await assertWithinBudget(session.user.id, "demo1");
    const sel = await getModel("demo1", { userId: session.user.id, preferFallback: true });

    try {
      const { output, totalUsage } = await generateText({
        model: sel.model,
        temperature: 0.2,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)]),
        system: withUntrustedRule(KEYWORD_SYSTEM),
        prompt: [
          wrapUntrusted(excerptForPrompt(text), { id: 1, source: "documento enviado" }),
          existing.length ? `Termos já informados (não repita): ${existing.join("; ")}` : "",
          `Responda com a lista de até ${MAX_KEYWORDS} termos.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        output: Output.array({ element: z.string().describe("Palavra-chave ou expressão curta") }),
      });

      const keywords = cleanKeywords(output, existing);
      void track({
        module: "demo1",
        action: "keyword_suggest",
        userId: session.user.id,
        status: "success",
        durationMs: Date.now() - t0,
        metadata: { ...usageMeta(sel.state, totalUsage), title: filename, count: keywords.length },
      });
      return Response.json({ keywords }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      console.error("suggest-keywords:", e instanceof Error ? e.message.split("\n").at(-1) : e);
      void track({ module: "demo1", action: "keyword_suggest", userId: session.user.id, status: "error", durationMs: Date.now() - t0, metadata: { ...usageMeta(sel.state, {}), title: filename } });
      return Response.json({ error: "Não foi possível sugerir palavras-chave agora. Você pode digitá-las manualmente." }, { status: 502 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) { return withPresentation(req, "suggest-keywords", "demo1", "keyword_suggest", livePOST); }
