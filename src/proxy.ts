import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { canAccess, isRole } from "@/lib/rbac";

// Next 16: proxy.ts roda em Node (não no Edge), então pode consultar o banco. Aqui só
// REDIRECIONA; as rotas de API e as páginas conferem de novo (requireRole / RoleGate), porque o
// proxy não cobre tudo (ex.: Server Functions de rotas excluídas do matcher).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await auth.api.getSession({ headers: req.headers });
  const role = session?.user.role;

  if (pathname === "/login") {
    // logado não precisa ver o login de novo
    return session ? NextResponse.redirect(new URL("/home", req.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (pathname === "/") return NextResponse.redirect(new URL("/home", req.url));
  if (!isRole(role) || !canAccess(role, pathname)) {
    return NextResponse.redirect(new URL("/403", req.url));
  }
  return NextResponse.next();
}

// Fora do proxy: API (cada rota se protege), assets e as páginas públicas de PUBLIC_PATHS
// (menos /login, que precisa passar aqui para redirecionar quem já está logado).
export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|403|privacidade|bot|.*\\..*).*)"],
};
