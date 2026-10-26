import { z } from "zod";
import { ROLES } from "@/lib/rbac";
import { errorResponse, requireRole } from "@/lib/session";
import { track } from "@/lib/usage";

// Eventos que SÓ o navegador sabe que aconteceram (o download é local). A lista é fechada de propósito:
// aceitar qualquer `action` deixaria um cliente forjar métricas (cache hit, custo, exclusão de dados)
// que alimentam o dashboard e o limite de gasto. O usuário vem da sessão, nunca do corpo.
const Body = z.object({
  module: z.enum(["demo1", "demo2", "demo3"]),
  action: z.literal("document_export"),
  metadata: z.object({
    format: z.enum(["pdf", "docx", "xlsx", "json", "md"]),
    title: z.string().max(120).optional(),
  }),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole(ROLES);
  } catch (e) {
    return errorResponse(e);
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Evento inválido" }, { status: 400 });

  await track({ ...parsed.data, userId: session.user.id, status: "success" });
  return new Response(null, { status: 204 });
}
