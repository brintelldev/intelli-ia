// Fonte única das permissões (TECHSPEC §4.2). Sem dependências de servidor, para ser usada pelo
// proxy, pelas rotas de API, pelos layouts e pela UI (esconder o que o perfil não pode usar).
// A UI nunca é a barreira: o servidor sempre confere de novo.

export const ROLES = ["Admin", "Analista", "Leitor"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Rotas abertas, sem login. O proxy também as exclui do matcher. */
export const PUBLIC_PATHS = ["/login", "/403", "/privacidade", "/bot"] as const;

// A primeira regra que casar vale, então a ordem importa (/admin/dashboard antes de /admin).
// Rota sem regra e fora de PUBLIC_PATHS é NEGADA: esquecer de declarar uma página nova não a abre.
const ALL: readonly Role[] = ROLES;
export const ROUTE_RULES: readonly (readonly [prefix: string, roles: readonly Role[]])[] = [
  ["/home", ALL],
  ["/chat", ALL], // Leitor entra em modo leitura (ver ACTIONS)
  ["/compartilhado", ALL],
  ["/dev", ALL], // vitrine dos componentes; a página responde 404 em produção
  ["/documentos", ["Admin", "Analista"]],
  ["/pesquisa", ["Admin", "Analista"]],
  ["/admin/dashboard", ["Admin", "Analista"]], // Analista vê o dashboard sem os controles
  ["/admin", ["Admin"]],
];

export const ACTIONS = {
  "chat:send": ["Admin", "Analista"],
  "chat:upload": ["Admin", "Analista"],
  "admin:config": ["Admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Action = keyof typeof ACTIONS;

/** `prefix` casa com o caminho inteiro ou com um segmento (/admin não casa com /administrador). */
function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => matches(path, p));
}

export function canAccess(role: Role | null | undefined, path: string): boolean {
  if (isPublicPath(path)) return true;
  if (!isRole(role)) return false;
  const rule = ROUTE_RULES.find(([prefix]) => matches(path, prefix));
  return rule ? rule[1].includes(role) : false;
}

export function can(role: Role | null | undefined, action: Action): boolean {
  return isRole(role) && (ACTIONS[action] as readonly Role[]).includes(role);
}
