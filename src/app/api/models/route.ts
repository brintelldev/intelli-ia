import { getDisabledProviders } from "@/lib/llm";
import { AVAILABLE_MODELS, PROVIDER_LABEL } from "@/lib/models";
import { rateFor } from "@/lib/pricing";
import { ROLES } from "@/lib/rbac";
import { errorResponse, requireRole } from "@/lib/session";

// Modelos que o seletor da tela pode oferecer: o catálogo sem os provedores que o Admin desativou,
// com o preço vigente (para o seletor mostrar o custo relativo). Qualquer perfil logado pode ler.
export async function GET() {
  try {
    await requireRole(ROLES);
  } catch (e) {
    return errorResponse(e);
  }

  const disabled = await getDisabledProviders();
  const models = AVAILABLE_MODELS.filter((m) => !disabled.includes(m.provider)).map((m) => {
    const rate = rateFor(m.id);
    return {
      id: m.id,
      label: m.label,
      provider: m.provider,
      providerLabel: PROVIDER_LABEL[m.provider],
      inputPerM: rate?.inputPerM ?? null,
      outputPerM: rate?.outputPerM ?? null,
    };
  });

  return Response.json({ models }, { headers: { "Cache-Control": "no-store" } });
}
