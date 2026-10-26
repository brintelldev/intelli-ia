import type { ReactNode } from "react";
import { RoleGate } from "@/components/auth/RoleGate";
import { HomeFooter } from "@/components/layout/HomeFooter";
import { HomeHeader } from "@/components/layout/HomeHeader";
import { ROLES } from "@/lib/rbac";

// A Home tem layout próprio, SEM sidebar. A moldura (header e footer) fica fora do gate para
// entrar na casca estática; o conteúdo só aparece depois de a sessão ser validada.
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <HomeHeader />
      <div className="flex flex-1 flex-col pt-14">
        <RoleGate roles={ROLES}>{children}</RoleGate>
      </div>
      <HomeFooter />
    </div>
  );
}
