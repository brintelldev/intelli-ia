import "@/lib/zod-pt";
import { z } from "zod";
import { requireRole, errorResponse } from "@/lib/session";
import { TEMPLATE_MODULES, TemplateSchema } from "@/lib/templates";
import { createTemplate, listTemplates } from "@/lib/templates-store";

// Os modelos só servem às telas de análise e pesquisa, que o Leitor não acessa.
const ROLES_WITH_TEMPLATES = ["Admin", "Analista"] as const;
const ModuleParam = z.enum(TEMPLATE_MODULES);

export async function GET(req: Request) {
  try {
    const session = await requireRole(ROLES_WITH_TEMPLATES);
    const mod = ModuleParam.safeParse(new URL(req.url).searchParams.get("module"));
    if (!mod.success) return Response.json({ error: "Módulo inválido" }, { status: 400 });
    const templates = await listTemplates(session.user.id, mod.data);
    return Response.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({ module: ModuleParam, name: z.string().trim().min(1, "Dê um nome ao modelo").max(80) }).and(TemplateSchema);

export async function POST(req: Request) {
  try {
    const session = await requireRole(ROLES_WITH_TEMPLATES);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Modelo inválido" }, { status: 400 });
    const { module: mod, name, sections, format } = parsed.data;
    const template = await createTemplate(session.user.id, mod, name, { sections, format });
    return Response.json({ template }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
