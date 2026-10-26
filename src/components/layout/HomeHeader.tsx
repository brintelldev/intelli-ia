import { BellIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { modulesFor } from "@/lib/modules";
import { isRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

// Header fixo de 56px, sem sidebar (a Home tem layout próprio). Só links para páginas que existem:
// o protótipo do Stitch tinha Workspace/History/Settings, que não fazem parte do escopo.
export function HomeHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/home" aria-label="Intelli AI, início" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
          <Logo className="text-lg" />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-6 md:flex">
          <Suspense fallback={<Skeleton className="h-4 w-64" />}>
            <HomeNav />
          </Suspense>
        </nav>

        <div className="flex items-center gap-2">
          <NotificationsMenu />
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

const linkClass =
  "rounded text-sm text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-primary";

async function HomeNav() {
  const session = await getSession();
  const role = session?.user.role;
  if (!isRole(role)) return null;
  return (
    <>
      <Link href="/home" aria-current="page" className="rounded text-sm font-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
        Início
      </Link>
      {modulesFor(role).map((m) => (
        <Link key={m.key} href={m.href} className={linkClass}>
          {m.label}
        </Link>
      ))}
    </>
  );
}

// Ainda não há notificações no produto: o menu existe (como no protótipo) e diz isso.
function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Notificações" />}
      >
        <BellIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem disabled>Nenhuma notificação por enquanto</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
