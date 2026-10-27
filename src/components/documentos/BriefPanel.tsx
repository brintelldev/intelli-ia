import { CompassIcon, FileTextIcon, FlagIcon, SearchCheckIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react";
import { SafeMarkdown } from "@/components/shared/SafeMarkdown";
import type { BriefView } from "@/lib/documentos/views";
import { cn } from "@/lib/utils";
import { PageRef } from "./HighlightedText";

const SEVERITY = {
  alta: { label: "Alta", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  media: { label: "Média", cls: "border-accent-admin/40 bg-accent-admin/10 text-accent-admin" },
  baixa: { label: "Baixa", cls: "border-border bg-surface-raised text-text-secondary" },
} as const;

function Section({ n, icon: Icon, title, children, pending }: { n: number; icon: LucideIcon; title: string; children?: React.ReactNode; pending?: boolean }) {
  return (
    <section aria-labelledby={`brief-${n}`} className="space-y-3 rounded-xl border border-border bg-surface p-5" data-testid={`brief-section-${n}`}>
      <h2 id={`brief-${n}`} className="flex items-center gap-3 text-base font-semibold text-text-primary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-docs/15 text-sm font-bold text-accent-docs tabular-nums">{n}</span>
        <Icon className="size-4 text-accent-docs" aria-hidden />
        {title}
      </h2>
      {pending ? (
        <div className="space-y-2" aria-hidden>
          <div className="skeleton-shimmer h-3 w-11/12 rounded" />
          <div className="skeleton-shimmer h-3 w-8/12 rounded" />
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * Parecer técnico (item 116): as 5 seções fixas, cada achado e risco com a página (clicável: abre o trecho no documento)
 * e a citação literal. Funciona com o objeto parcial do stream (seções que ainda não chegaram aparecem como esqueleto).
 */
export function BriefPanel({
  view,
  onOpenPage,
  className,
}: {
  view: BriefView;
  onOpenPage?: (page: number, quote: string) => void;
  className?: string;
}) {
  const wait = !view.complete;
  const open = (page: number | null, quote: string) => (page != null && onOpenPage ? () => onOpenPage(page, quote) : undefined);
  return (
    <div className={cn("space-y-4", className)} aria-busy={wait} data-testid="brief-panel">
      <Section n={1} icon={FileTextIcon} title="Objeto da Análise" pending={wait && !view.objeto}>
        {view.objeto && <SafeMarkdown>{view.objeto}</SafeMarkdown>}
      </Section>

      <Section n={2} icon={CompassIcon} title="Metodologia" pending={wait && !view.metodologia}>
        {view.metodologia && <SafeMarkdown>{view.metodologia}</SafeMarkdown>}
        {view.facts && <SafeMarkdown className="mt-2 rounded-lg bg-surface-raised px-3 py-2 text-text-secondary">{view.facts}</SafeMarkdown>}
      </Section>

      <Section n={3} icon={SearchCheckIcon} title="Achados Principais" pending={wait && view.achados.length === 0}>
        <ul className="space-y-3">
          {view.achados.map((a, i) => (
            <li key={`${a.keyword}-${i}`} className="space-y-1.5" data-testid="finding">
              <p className="text-sm text-text-primary">
                {a.keyword && <span className="mr-2 rounded-md border border-accent-docs/30 bg-surface-raised px-1.5 py-0.5 text-xs font-medium">{a.keyword}</span>}
                {a.finding} <PageRef page={a.pageRef} verified={a.verified} onOpen={open(a.pageRef, a.quote)} />
              </p>
              {a.quote && a.verified !== false && <blockquote className="border-l-2 border-accent-docs/40 pl-3 text-sm text-text-secondary italic">{a.quote}</blockquote>}
            </li>
          ))}
        </ul>
      </Section>

      <Section n={4} icon={ShieldAlertIcon} title="Análise de Riscos" pending={wait && view.riscos.length === 0}>
        {view.riscos.length ? (
          <ul className="space-y-2.5">
            {view.riscos.map((r, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 text-sm text-text-primary" data-testid="risk">
                {r.severity && <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", SEVERITY[r.severity].cls)}>{SEVERITY[r.severity].label}</span>}
                <span className="min-w-0 flex-1">{r.risk}</span>
                <PageRef page={r.pageRef} verified={r.verified} onOpen={open(r.pageRef, r.quote)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum risco relevante foi identificado no texto analisado.</p>
        )}
      </Section>

      <Section n={5} icon={FlagIcon} title="Conclusão e Recomendações" pending={wait && !view.conclusao}>
        {view.conclusao && <SafeMarkdown>{view.conclusao}</SafeMarkdown>}
        {view.recomendacoes.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-text-primary">
            {view.recomendacoes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
