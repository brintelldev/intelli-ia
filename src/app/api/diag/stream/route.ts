import { ROLES } from "@/lib/rbac";
import { errorResponse, requireRole } from "@/lib/session";

// Diagnóstico de streaming (T-04b): emite 5 linhas, uma por segundo. Se um proxy (Nginx) estiver
// fazendo buffering, as linhas chegam todas juntas no fim; o smoke test mede isso. As respostas de
// IA dependem de SSE funcionar, então este teste vale ficar para sempre. Exige login para não
// virar um jeito barato de segurar conexões abertas.
const LINES = 5;
const INTERVAL_MS = 1000;

export async function GET() {
  try {
    await requireRole(ROLES);
  } catch (e) {
    return errorResponse(e);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 1; i <= LINES; i++) {
        controller.enqueue(encoder.encode(`linha ${i}/${LINES}\n`));
        if (i < LINES) await new Promise((r) => setTimeout(r, INTERVAL_MS));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no", // pede ao Nginx para não fazer buffering desta resposta
    },
  });
}
