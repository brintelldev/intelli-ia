import { highlightTerms } from "@/lib/documentos/highlight";
import { cn } from "@/lib/utils";

/** Texto com as palavras-chave marcadas (sem alterar o que está escrito: ignora caixa e acento ao procurar). */
export function HighlightedText({ text, terms, className }: { text: string; terms: readonly string[]; className?: string }) {
  return (
    <span className={className}>
      {highlightTerms(text, terms).map((seg, i) =>
        seg.mark ? (
          <mark key={i} className="rounded-sm bg-accent-docs/20 px-0.5 text-text-primary">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

/** Referência de página: botão quando dá para abrir o trecho; texto simples (com aviso) quando o trecho não foi localizado. */
export function PageRef({ page, verified, onOpen, className }: { page: number | null | undefined; verified?: boolean; onOpen?: () => void; className?: string }) {
  if (page == null) return null;
  const base = "inline-flex items-center rounded border px-1.5 py-0.5 text-xs tabular-nums";
  if (verified === false) {
    return (
      <span className={cn(base, "border-dashed border-border text-text-muted", className)} title="O trecho citado não foi localizado no texto do documento">
        p. {page} · não localizado
      </span>
    );
  }
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cn(base, "border-accent-docs/30 text-accent-docs transition-colors hover:bg-accent-docs/10 focus-visible:ring-2 focus-visible:ring-accent-docs/50 focus-visible:outline-none", className)} title="Ver o trecho no documento">
      p. {page}
    </button>
  ) : (
    <span className={cn(base, "border-border text-text-secondary", className)}>p. {page}</span>
  );
}
