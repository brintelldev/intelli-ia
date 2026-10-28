import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);
// O plugin é usado somente por auth.api no servidor. Acesso HTTP direto contornaria auditoria,
// exclusão LGPD e a proteção do último administrador dos wrappers /api/admin/users.
function blocked(request: Request) {
  let path = new URL(request.url).pathname;
  try { path = decodeURIComponent(path); } catch { return true; }
  return path === "/api/auth/admin" || path.startsWith("/api/auth/admin/");
}
export async function GET(request: Request) {
  return blocked(request) ? new Response("Not Found", { status: 404 }) : handlers.GET(request);
}
export async function POST(request: Request) {
  return blocked(request) ? new Response("Not Found", { status: 404 }) : handlers.POST(request);
}
