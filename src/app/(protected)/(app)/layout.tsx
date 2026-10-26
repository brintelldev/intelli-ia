import type { ReactNode } from "react";
import { Suspense } from "react";
import { RoleGate } from "@/components/auth/RoleGate";
import { BottomNav, Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { UserMenu } from "@/components/layout/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLES } from "@/lib/rbac";

// Layout com sidebar das rotas /documentos, /pesquisa, /chat e /admin (a Home não usa).
// Sidebar e TopBar ficam fora do gate (casca estática); cada página ainda restringe o seu perfil
// com o próprio <RoleGate>.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar>
          {/* no mobile a sidebar some: o menu do usuário (e o Sair) vem para a TopBar */}
          <Suspense fallback={<Skeleton className="size-8 rounded-full md:hidden" />}>
            <UserMenu className="md:hidden" />
          </Suspense>
        </TopBar>
        <div className="flex flex-1 flex-col pb-16 md:pb-0">
          <RoleGate roles={ROLES}>{children}</RoleGate>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
