import { ApprovalBadge } from "@/components/admin/AdminNav";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { modulesFor } from "@/lib/modules";
import { isRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Logo } from "./Logo";
import { MODULE_ICON } from "./module-icons";
import { NavItem } from "./NavItem";
import { UserAvatar } from "./UserAvatar";

// A moldura (logo, larguras) é estática e entra na casca pré-renderizada; só o que depende da
// sessão (itens por perfil e usuário) fica em <Suspense> com skeleton.
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface md:flex md:w-16 xl:w-60">
      <div className="flex h-14 items-center justify-center border-b border-border xl:justify-start xl:px-5">
        <Logo className="text-lg" textClassName="hidden xl:inline" />
      </div>
      <nav aria-label="Principal" className="flex flex-col gap-1 py-3">
        <Suspense fallback={<NavSkeleton />}>
          <SidebarNav />
        </Suspense>
      </nav>
      <ApprovalBadge />
      <div className="mt-auto border-t border-border p-3">
        <Suspense fallback={<Skeleton className="mx-auto h-9 w-9 rounded-full xl:mx-0 xl:w-full" />}>
          <SidebarUser />
        </Suspense>
      </div>
    </aside>
  );
}

async function SidebarNav() {
  const session = await getSession();
  const role = session?.user.role;
  if (!isRole(role)) return null;
  return modulesFor(role).map((m) => {
    const Icon = MODULE_ICON[m.key];
    return (
      <NavItem
        key={m.key}
        href={m.href}
        label={m.label}
        accent={m.accent}
        match={m.key === "admin" ? "/admin" : m.href}
        icon={<Icon className="size-5 shrink-0" aria-hidden="true" />}
      />
    );
  });
}

function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3" role="status" aria-label="Carregando navegação">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

const ROLE_BADGE = { Admin: "admin", Analista: "search", Leitor: "secondary" } as const;

async function SidebarUser() {
  const session = await getSession();
  const role = session?.user.role;
  if (!session || !isRole(role)) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-3 xl:justify-start">
        <UserAvatar name={session.user.name} />
        <div className="hidden min-w-0 flex-col items-start gap-1 xl:flex">
          <span className="max-w-full truncate text-sm font-medium">{session.user.name}</span>
          <Badge variant={ROLE_BADGE[role]}>{role}</Badge>
        </div>
      </div>
      <LogoutButton className="w-full justify-center xl:justify-start" labelClassName="hidden xl:inline" />
    </div>
  );
}

// Mobile (< 768px): a sidebar vira navegação inferior com os mesmos itens.
export function BottomNav() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden"
    >
      <Suspense fallback={<div className="h-16 flex-1" />}>
        <BottomNavItems />
      </Suspense>
    </nav>
  );
}

async function BottomNavItems() {
  const session = await getSession();
  const role = session?.user.role;
  if (!isRole(role)) return null;
  return modulesFor(role).map((m) => {
    const Icon = MODULE_ICON[m.key];
    return (
      <NavItem
        key={m.key}
        variant="bottom"
        href={m.href}
        label={m.label}
        accent={m.accent}
        match={m.key === "admin" ? "/admin" : m.href}
        icon={<Icon className="size-5" aria-hidden="true" />}
      />
    );
  });
}
