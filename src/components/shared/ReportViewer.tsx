import { cn } from "@/lib/utils";
import { SafeMarkdown } from "./SafeMarkdown";

export type ReportSection = { heading: string; content: string };
export type ReportCitation = { label: string; url?: string; score?: number };

/** Em `[1]`, `[2]`… o número vira link para a fonte (só se a fonte existir: `[7]` sem fonte 7 fica como texto). */
export function linkCitations(md: string, count: number): string {
  return md.replace(/\[(\d{1,3})\](?![(:])/g, (m, n: string) => (Number(n) >= 1 && Number(n) <= count ? `[${m}](#cit-${n})` : m));
}

const slug = (i: number) => `secao-${i + 1}`;

/**
 * Relatório em seções com âncoras, índice lateral, citações numeradas e estado de streaming.
 * `streaming` mostra o cursor na última seção; `pendingHeadings` são as seções que o modelo ainda não
 * começou (aparecem como esqueleto, para a pessoa ver o formato que vem por aí).
 */
export function ReportViewer({
  title,
  sections,
  citations,
  streaming = false,
  pendingHeadings = [],
  className,
}: {
  title?: string;
  sections: ReportSection[];
  citations?: ReportCitation[];
  streaming?: boolean;
  pendingHeadings?: string[];
  className?: string;
}) {
  const count = citations?.length ?? 0;
  const toc = [...sections.map((s) => s.heading), ...pendingHeadings.filter((h) => !sections.some((s) => s.heading === h))];
  const nothingYet = sections.length === 0 && pendingHeadings.length === 0;

  return (
    <article className={cn("grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]", className)} aria-busy={streaming}>
      {toc.length > 1 && (
        <nav aria-label="Seções do relatório" className="hidden lg:block">
          <ol className="sticky top-6 space-y-1 border-l border-border text-sm">
            {toc.map((h, i) => (
              <li key={`${i}-${h}`}>
                {i < sections.length ? (
                  <a href={`#${slug(i)}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-text-secondary hover:border-accent-primary hover:text-text-primary">
                    {h}
                  </a>
                ) : (
                  <span className="-ml-px block py-1 pl-3 text-text-muted">{h}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="min-w-0 space-y-8">
        {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}

        {sections.map((s, i) => {
          const last = i === sections.length - 1;
          return (
            <section key={`${i}-${s.heading}`} id={slug(i)} aria-labelledby={`${slug(i)}-h`} className="scroll-mt-20">
              <h2 id={`${slug(i)}-h`} className="mb-2 text-lg font-semibold">
                {s.heading}
              </h2>
              <SafeMarkdown>{linkCitations(s.content, count)}</SafeMarkdown>
              {streaming && last && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent-primary align-middle" />}
            </section>
          );
        })}

        {streaming &&
          pendingHeadings
            .filter((h) => !sections.some((s) => s.heading === h))
            .map((h) => (
              <section key={h} aria-hidden className="space-y-2">
                <h2 className="text-lg font-semibold text-text-muted">{h}</h2>
                <div className="skeleton-shimmer h-3 w-11/12 rounded" />
                <div className="skeleton-shimmer h-3 w-9/12 rounded" />
              </section>
            ))}

        {streaming && nothingYet && <p className="text-sm text-text-secondary">Gerando o relatório…</p>}

        {count > 0 && (
          <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-20">
            <h2 id="fontes-h" className="mb-2 text-lg font-semibold">
              Fontes
            </h2>
            <ol className="space-y-1.5 text-sm">
              {citations!.map((c, i) => (
                <li key={i} id={`cit-${i + 1}`} className="scroll-mt-20 target:text-accent-primary flex gap-2">
                  <span className="w-6 shrink-0 text-text-muted">[{i + 1}]</span>
                  <span className="min-w-0">
                    {c.url && /^https?:\/\//i.test(c.url) ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-primary underline underline-offset-2 break-words">
                        {c.label}
                      </a>
                    ) : (
                      c.label
                    )}
                    {c.score != null && <span className="ml-2 text-xs text-text-muted">relevância {Math.round(c.score * 100)}%</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </article>
  );
}
