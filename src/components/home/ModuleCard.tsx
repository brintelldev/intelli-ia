import Link from "next/link";
import { MODULE_ICON } from "@/components/layout/module-icons";
import { Card, CardContent } from "@/components/ui/card";
import { ACCENT_CLASS, type AppModule } from "@/lib/modules";
import { cn } from "@/lib/utils";

// O card inteiro é o link (um alvo de clique grande); o glow no hover vem do <Card accent>.
export function ModuleCard({ module: m }: { module: AppModule }) {
  const c = ACCENT_CLASS[m.accent];
  const Icon = MODULE_ICON[m.key];
  return (
    <Link
      href={m.href}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card accent={m.accent} className="h-full [--card-spacing:--spacing(6)]">
        <CardContent className="flex h-full flex-col gap-4">
          <span className={cn("flex size-11 items-center justify-center rounded-full", c.iconBg, c.text)}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-text-primary">{m.title}</h2>
            <p className="text-sm text-text-secondary">{m.description}</p>
          </div>
          <span className={cn("mt-auto text-sm font-medium transition-transform duration-150 group-hover:translate-x-0.5", c.text)}>
            Abrir módulo →
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
