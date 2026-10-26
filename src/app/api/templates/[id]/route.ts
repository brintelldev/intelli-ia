import { requireRole, errorResponse } from "@/lib/session";
import { deleteTemplate } from "@/lib/templates-store";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["Admin", "Analista"]);
    await deleteTemplate((await ctx.params).id, session.user.id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
