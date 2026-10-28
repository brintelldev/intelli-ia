import type { Metadata } from "next";
import { Suspense } from "react";
import { CommandBar } from "@/components/home/CommandBar";
import { ModuleCard } from "@/components/home/ModuleCard";
import { RecentActivity, RecentActivitySkeleton } from "@/components/home/RecentActivity";
import { Skeleton } from "@/components/ui/skeleton";
import { MODULES } from "@/lib/modules";
import { canAccess, isRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início · Intelli Insights" };

// Textos do hero seguem o protótipo aprovado no Stitch (em inglês); navegação e descrições dos
// módulos, em PT-BR.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-4 pt-14 pb-12 md:pt-24">
      <div className="animate-enter flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">O que vamos fazer hoje?</h1>
        <p className="text-text-secondary">Acesse seus módulos de inteligência em um só lugar.</p>
      </div>
      <Suspense fallback={<HeroSkeleton />}>
        <CommandAndModules />
      </Suspense>
      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
    </main>
  );
}

// Depende do perfil (o command bar nunca manda para uma página proibida e os cards só mostram o
// que o perfil abre), por isso lê a sessão dentro do <Suspense>.
async function CommandAndModules() {
  const session = await getSession();
  const role = session?.user.role;
  if (!isRole(role)) return null;
  const cards = MODULES.filter((m) => canAccess(role, m.href));
  return (
    <>
      <CommandBar role={role} />
      <section
        aria-label="Módulos"
        className={cn("grid w-full gap-4", cards.length >= 3 ? "md:grid-cols-3" : "mx-auto max-w-sm")}
      >
        {cards.map((m) => (
          <ModuleCard key={m.key} module={m} />
        ))}
      </section>
    </>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex w-full flex-col items-center gap-10" role="status" aria-label="Carregando">
      <Skeleton className="h-12 w-full max-w-2xl rounded-xl" />
      <div className="grid w-full gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
