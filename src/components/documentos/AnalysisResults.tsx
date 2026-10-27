import { ListTreeIcon, SparklesIcon, TagsIcon } from "lucide-react";
import { scoreTone, type AnalysisView, type ScoreTone } from "@/lib/documentos/views";
import { cn } from "@/lib/utils";
import { HighlightedText, PageRef } from "./HighlightedText";

const BADGE: Record<ScoreTone, string> = { high: "border-accent-docs/40 text-accent-docs", mid: "border-accent-admin/40 text-accent-admin", low: "border-destructive/40 text-destructive" };

/**
 * Resultado da análise: resumo e temas, palavras-chave (com os trechos onde aparecem, marcados) e as seções por
 * relevância. Funciona com o objeto parcial do stream (`complete: false`) e com o final conferido. Cada seção tem o id
 * `analysis-section-N` para a barra lateral rolar até ela.
 */
export function AnalysisResults({
  view,
  keywords,
  activeIndex,
  onOpenPage,
  className,
}: {
  view: AnalysisView;
  keywords: readonly string[];
  activeIndex?: number | null;
  onOpenPage?: (page: number, quote: string) => void;
  className?: string;
}) {
  const streaming = !view.complete;
  const terms = keywords.length ? keywords : view.keywords.map((k) => k.keyword);
  return (
    <div className={cn("space-y-8", className)} aria-busy={streaming} data-testid="analysis-results">
      {(view.summary || view.taxonomy.length > 0) && (
        <section aria-labelledby="an-resumo" className="space-y-3">
          <h2 id="an-resumo" className="flex items-center gap-2 text-lg font-semibold">
            <SparklesIcon className="size-4 text-accent-docs" /> Resumo
          </h2>
          {view.summary && <p className="text-sm leading-relaxed text-text-primary"><HighlightedText text={view.summary} terms={terms} /></p>}
          {view.taxonomy.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Temas">
              {view.taxonomy.map((t) => (
                <li key={t} className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 text-xs text-text-secondary">{t}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view.keywords.length > 0 && (
        <section aria-labelledby="an-keywords" className="space-y-3">
          <h2 id="an-keywords" className="flex items-center gap-2 text-lg font-semibold">
            <TagsIcon className="size-4 text-accent-docs" /> Palavras-chave
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {view.keywords.map((k) => {
              const shown = k.occurrences.filter((o) => o.verified !== false);
              return (
                <li key={k.keyword} className="space-y-2 rounded-xl border border-border bg-surface p-3" data-testid="keyword-card">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{k.keyword}</span>
                    {k.count != null && (
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] tabular-nums", k.count ? "border-accent-docs/40 text-accent-docs" : "border-border text-text-muted")}>
                        {k.count} {k.count === 1 ? "ocorrência" : "ocorrências"}
                      </span>
                    )}
                  </div>
                  {shown.length ? (
                    <ul className="space-y-2">
                      {shown.map((o, i) => (
                        <li key={i} className="space-y-1 text-sm text-text-secondary">
                          <HighlightedText text={o.context} terms={[k.keyword, ...terms]} />
                          <div>
                            <PageRef page={o.page} verified={o.verified} onOpen={o.page != null && onOpenPage ? () => onOpenPage(o.page!, o.context) : undefined} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !streaming && <p className="text-sm text-text-muted">Não encontrada no documento.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view.sections.length > 0 && (
        <section aria-labelledby="an-secoes" className="space-y-3">
          <h2 id="an-secoes" className="flex items-center gap-2 text-lg font-semibold">
            <ListTreeIcon className="size-4 text-accent-docs" /> Seções por relevância
          </h2>
          <ol className="space-y-3">
            {view.sections.map((s, i) => {
              const tone = scoreTone(s.score);
              return (
                <li
                  key={`${i}-${s.title}`}
                  id={`analysis-section-${i}`}
                  data-active={activeIndex === i ? "true" : undefined}
                  className={cn("scroll-mt-20 rounded-xl border bg-surface p-4 transition-shadow duration-500", activeIndex === i ? "border-accent-docs/60 shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-docs)_18%,transparent)]" : "border-border")}
                >
                  <div className="flex items-start gap-3">
                    <h3 className="min-w-0 flex-1 text-sm font-semibold text-text-primary">{s.title}</h3>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", BADGE[tone])}>{Math.round(s.score)}</span>
                  </div>
                  {s.snippet && (
                    <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm text-text-secondary">
                      <HighlightedText text={s.snippet} terms={terms} />
                    </blockquote>
                  )}
                  {s.pageRef != null && (
                    <div className="mt-2">
                      <PageRef page={s.pageRef} verified={s.verified} onOpen={onOpenPage && s.snippet ? () => onOpenPage(s.pageRef!, s.snippet!) : undefined} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {view.suggestions.length > 0 && (
        <section aria-labelledby="an-sugestoes" className="space-y-2">
          <h2 id="an-sugestoes" className="text-lg font-semibold">Pontos de atenção</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {view.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {streaming && <p className="text-sm text-text-secondary" role="status">Analisando o documento…</p>}
    </div>
  );
}
