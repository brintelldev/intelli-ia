import { canAccess, type Role } from "@/lib/rbac";

// Catálogo único dos módulos: sidebar, bottom nav, header e cards da Home leem daqui.
// Sem JSX (importável de qualquer lugar); os ícones ficam em components/layout/module-icons.tsx.
export type Accent = "docs" | "search" | "chat" | "admin" | "primary";

export type AppModule = {
  key: "documentos" | "pesquisa" | "chat" | "admin";
  href: string;
  label: string; // sidebar / nav
  title: string; // título da página e do card
  description: string;
  accent: Accent;
};

export const MODULES: readonly AppModule[] = [
  {
    key: "documentos",
    href: "/documentos",
    label: "Documentos",
    title: "Análise de Documentos",
    description: "Processe PDFs, contratos e relatórios com precisão neural.",
    accent: "docs",
  },
  {
    key: "pesquisa",
    href: "/pesquisa",
    label: "Pesquisa",
    title: "Pesquisa Web",
    description: "Acesso à internet em tempo real para sintetizar as informações mais recentes.",
    accent: "search",
    },
  {
    key: "chat",
    href: "/chat",
    label: "Chat",
    title: "Chat RAG",
    description: "Interaja com sua base de conhecimento privada usando embeddings customizados.",
    accent: "chat",
  },
];

// O Admin vê "Admin"; o Analista entra só no dashboard em leitura (PRD 4), então vê "Dashboard".
export function adminModule(role: Role): AppModule {
  return {
    key: "admin",
    href: "/admin/dashboard",
    label: role === "Admin" ? "Admin" : "Dashboard",
    title: role === "Admin" ? "Administração" : "Dashboard",
    description: "Métricas de uso, modelos de IA e usuários.",
    accent: "admin",
  };
}

/** Módulos que o perfil pode abrir, na ordem da navegação (Admin/Dashboard por último). */
export function modulesFor(role: Role): AppModule[] {
  const list = MODULES.filter((m) => canAccess(role, m.href));
  const admin = adminModule(role);
  return canAccess(role, admin.href) ? [...list, admin] : list;
}

/** Título da TopBar a partir do caminho; null se não for uma página de módulo. */
export function pageTitle(pathname: string): { section: string; page?: string } | null {
  if (pathname.startsWith("/admin")) {
    const sub: Record<string, string> = { "/admin/dashboard": "Dashboard", "/admin/llm": "Configuração de IA" };
    return { section: "Admin", page: sub[pathname] };
  }
  const m = MODULES.find((x) => pathname === x.href || pathname.startsWith(x.href + "/"));
  return m ? { section: m.title } : null;
}

// Classes completas (o Tailwind só gera o que aparece escrito por inteiro no código).
export const ACCENT_CLASS: Record<Accent, { text: string; border: string; bg: string; iconBg: string }> = {
  docs: { text: "text-accent-docs", border: "border-accent-docs", bg: "bg-accent-docs", iconBg: "bg-accent-docs/12" },
  search: { text: "text-accent-search", border: "border-accent-search", bg: "bg-accent-search", iconBg: "bg-accent-search/12" },
  chat: { text: "text-accent-chat", border: "border-accent-chat", bg: "bg-accent-chat", iconBg: "bg-accent-chat/12" },
  admin: { text: "text-accent-admin", border: "border-accent-admin", bg: "bg-accent-admin", iconBg: "bg-accent-admin/12" },
  primary: { text: "text-accent-primary", border: "border-accent-primary", bg: "bg-accent-primary", iconBg: "bg-accent-primary/12" },
};

// Eventos do UsageEvent que aparecem na "Recent Activity" (uma linha por trabalho do usuário;
// cache hits, exports e eventos do Admin ficam de fora).
export const ACTIVITY: Record<string, { label: string; accent: Accent; href: string }> = {
  pdf_analysis: { label: "Análise de documento", accent: "docs", href: "/documentos" },
  brief_generation: { label: "Parecer técnico", accent: "docs", href: "/documentos" },
  web_search: { label: "Pesquisa web", accent: "search", href: "/pesquisa" },
  chat_message: { label: "Chat RAG", accent: "chat", href: "/chat" },
  document_ingest: { label: "Documento indexado", accent: "chat", href: "/chat" },
};
