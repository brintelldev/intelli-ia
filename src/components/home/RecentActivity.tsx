import { ACTIVITY, ACCENT_CLASS, MODULES } from "@/lib/modules";
import { MODULE_ICON } from "@/components/layout/module-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ActivityMenu } from "./ActivityMenu";

// Últimas 3 ações do próprio usuário (UsageEvent). "View All History" do protótipo ficou de fora:
// ainda não existe página de histórico.
export async function RecentActivity() {
  const session = await getSession();
  if (!session) return null;

  const events = await prisma.usageEvent.findMany({
    where: { userId: session.user.id, status: "success", action: { in: Object.keys(ACTIVITY) } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, action: true, metadata: true, createdAt: true },
  });
  const now = new Date();

  return (
    <section aria-labelledby="recent-activity" className="w-full max-w-5xl">
      <h2 id="recent-activity" className="mb-3 text-xs font-semibold tracking-widest text-text-muted uppercase">
        Atividade recente
      </h2>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
          Nenhuma atividade ainda. Abra um dos módulos acima para começar.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface">
          {events.map((e) => {
            const a = ACTIVITY[e.action];
            const key = MODULES.find((m) => m.href === a.href)!.key;
            const Icon = MODULE_ICON[key];
            const meta = (e.metadata ?? {}) as { title?: unknown };
            const title = typeof meta.title === "string" && meta.title.trim() ? meta.title : a.label;
            return (
              <li key={e.id} className="group/row flex items-center gap-3 px-4 py-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", ACCENT_CLASS[a.accent].iconBg, ACCENT_CLASS[a.accent].text)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-secondary">
                    {a.label} • {relativeTime(e.createdAt, now)}
                  </p>
                </div>
                <ActivityMenu href={a.href} label={title} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="w-full max-w-5xl" role="status" aria-label="Carregando atividade recente">
      <Skeleton className="mb-3 h-3 w-32" />
      <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-border">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[60px] rounded-none" />
        ))}
      </div>
    </div>
  );
}
