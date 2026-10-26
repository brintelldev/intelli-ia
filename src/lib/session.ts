import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { HttpError } from "@/lib/http-error";
import { isRole, type Role } from "@/lib/rbac";

// Camada de acesso à sessão (Data Access Layer). Lê SEMPRE do banco: a troca de role ou o
// banimento precisa valer na próxima requisição. Lê headers(), então só pode ser chamada em
// tempo de requisição: em páginas, dentro de <Suspense> (ver RoleGate).
// cache() do React deduplica dentro da MESMA requisição (sidebar, menu e gate leem a sessão no
// mesmo render e contam como uma consulta ao banco). Não persiste entre requisições.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export type AppSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export { HttpError };

/** Para rotas de API e server actions. 401 sem sessão (ou usuário banido), 403 sem o perfil. */
export async function requireRole(roles: readonly Role[]): Promise<AppSession & { role: Role }> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Não autenticado");
  const role = session.user.role;
  if (!isRole(role) || !roles.includes(role)) throw new HttpError(403, "Sem permissão");
  return Object.assign(session, { role });
}

/** `catch (e) { return errorResponse(e) }` nas rotas; erros inesperados continuam subindo. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  throw e;
}
