import{missingProviderKeys}from'@/lib/provider-availability';import{prisma}from'@/lib/prisma';
import { getDisabledProviders } from "@/lib/llm";
import { AVAILABLE_MODELS, PROVIDER_LABEL } from "@/lib/models";
import { rateFor } from "@/lib/pricing";
import { ROLES } from "@/lib/rbac";
import { errorResponse, requireRole } from "@/lib/session";

// Modelos que o seletor da tela pode oferecer: o catálogo sem os provedores que o Admin desativou,
// com o preço vigente (para o seletor mostrar o custo relativo). Qualquer perfil logado pode ler.
export async function GET() {
  let userId:string;
  try {
    userId=(await requireRole(ROLES)).user.id;
  } catch (e) {
    return errorResponse(e);
  }

  const disabled = await getDisabledProviders();
  const missing=missingProviderKeys(process.env);
  const mode=(await prisma.appSetting.findUnique({where:{key:'presentationMode'}}))?.value;
  const recorded=missing.length&&mode==='fallback'?await prisma.$queryRaw<{model:string}[]>`SELECT DISTINCT (regexp_matches(response->>'body','"model(Id|Used)"[[:space:]]*:[[:space:]]*"([^"]+)"','g'))[2] AS model FROM "ResponseCache" WHERE module='replay' AND response->>'userId'=${userId} AND "expiresAt">now()`:[];
  const models = AVAILABLE_MODELS.filter((m) => !disabled.includes(m.provider)&&(!missing.includes(m.provider)||recorded.some(r=>r.model===m.id))).map((m) => {
    const rate = rateFor(m.id);
    return {
      id: m.id,
      replayOnly:missing.includes(m.provider),
      label: m.label,
      provider: m.provider,
      providerLabel: PROVIDER_LABEL[m.provider],
      inputPerM: rate?.inputPerM ?? null,
      outputPerM: rate?.outputPerM ?? null,
    };
  });

  return Response.json({ models,unconfiguredProviders:missing }, { headers: { "Cache-Control": "no-store" } });
}
