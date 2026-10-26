import { canAccess, type Role } from "@/lib/rbac";

// Command bar da Home: o texto digitado leva ao módulo certo por palavra-chave (Bloco 0 do
// prompt de front-end). A primeira lista que casar vence; sem casamento vai para a pesquisa.
const ROUTES: readonly (readonly [href: string, keywords: readonly string[]])[] = [
  ["/documentos", ["documento", "pdf", "contrato", "analise"]],
  ["/pesquisa", ["pesquisa", "busca", "web", "pesquisar"]],
  ["/chat", ["chat", "perguntar", "conversa", "base"]],
];

const DEFAULT_ROUTE = "/pesquisa";
const FALLBACK_ROUTE = "/chat"; // única tela que todos os perfis abrem

/** minúsculas e sem acento: "Análise" casa com "analise". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function routeForQuery(text: string, role: Role): string {
  const q = normalize(text);
  const hit = ROUTES.find(([, words]) => words.some((w) => q.includes(w)));
  const target = hit ? hit[0] : DEFAULT_ROUTE;
  // O Leitor não abre documentos nem pesquisa: em vez de mandar para um 403, vai ao chat.
  return canAccess(role, target) ? target : FALLBACK_ROUTE;
}
