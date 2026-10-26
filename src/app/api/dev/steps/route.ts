import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { ROLES } from "@/lib/rbac";
import { errorResponse, requireRole } from "@/lib/session";
import { step, streamError, type StepMessage } from "@/lib/stream-steps";

// Rota de teste do helper de etapas (T-12): 3 etapas em sequência e uma frase final. Só existe em
// desenvolvimento. `?fail=1` faz a 3ª etapa falhar, para ver o estado de erro.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  try {
    await requireRole(ROLES);
  } catch (e) {
    return errorResponse(e);
  }
  const fail = new URL(req.url).searchParams.get("fail") === "1";

  const stream = createUIMessageStream<StepMessage>({
    onError: streamError,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      step(writer, "interpret", "Interpretando a pergunta", "running");
      await wait(500);
      step(writer, "interpret", "Pergunta interpretada", "done");

      step(writer, "search", "Buscando fontes", "running");
      await wait(900);
      step(writer, "search", "Fontes encontradas", "done", { sources: 3 });

      step(writer, "synthesize", "Sintetizando o relatório", "running");
      await wait(600);
      if (fail) {
        step(writer, "synthesize", "A síntese falhou", "error");
        throw new Error("falha simulada com detalhe interno: SELECT * FROM segredo");
      }
      step(writer, "synthesize", "Relatório pronto", "done");

      writer.write({ type: "text-start", id: "t" });
      writer.write({ type: "text-delta", id: "t", delta: "Concluído: 3 etapas executadas." });
      writer.write({ type: "text-end", id: "t" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
