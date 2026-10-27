import { AlertTriangleIcon } from "lucide-react";
import { scoreTone, type ScoreTone, type SectionView } from "@/lib/documentos/views";
import { cn } from "@/lib/utils";

const BAR: Record<ScoreTone, string> = { high: "bg-accent-docs", mid: "bg-accent-admin", low: "bg-destructive" };
const TEXT: Record<ScoreTone, string> = { high: "text-accent-docs", mid: "text-accent-admin", low: "text-destructive" };

/**
 * Índice analítico: as seções do documento com a nota de relevância (0 a 100) em barra: verde acima de 70, amarela de 30
 * a 70, vermelha abaixo de 30. Clicar chama `onSelect` (a tela rola até a seção e a destaca).
 */
export function AnalysisSidebar({
  sections,
  activeIndex,
  onSelect,
  className,
}: {
  sections: SectionView[];
  activeIndex?: number | null;
  onSelect: (index: number) => void;
  className?: string;
}) {
  if (!sections.length) return null;
  return (
    <nav aria-label="Índice analítico" className={cn("space-y-1", className)} data-testid="analysis-sidebar">
      <p className="px-2 pb-1 text-xs font-medium tracking-wide text-text-muted uppercase">Relevância por seção</p>
      <ol className="space-y-0.5">
        {sections.map((s, i) => {
          const tone = scoreTone(s.score);
          return (
            <li key={`${i}-${s.title}`}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={activeIndex === i ? "true" : undefined}
                data-tone={tone}
                className={cn(
                  "group w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent-docs/50 focus-visible:outline-none",
                  activeIndex === i && "bg-surface-raised",
                )}
              >
                <span className="flex items-start gap-2 text-sm text-text-primary">
                  <span className="line-clamp-2 min-w-0 flex-1">{s.title}</span>
                  {s.verified === false && <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-label="Trecho não localizado no documento" />}
                  <span className={cn("shrink-0 text-xs font-semibold tabular-nums", TEXT[tone])}>{Math.round(s.score)}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={Math.round(s.score)} aria-valuemin={0} aria-valuemax={100} aria-label={`Relevância de ${s.title}`}>
                    <span className={cn("block h-full rounded-full transition-[width] duration-500", BAR[tone])} style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }} />
                  </span>
                  {s.pageRef != null && <span className="text-[11px] text-text-muted tabular-nums">p. {s.pageRef}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
