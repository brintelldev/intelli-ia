"use client";

import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findQuote, segmentsFor } from "@/lib/documentos/highlight";
import type { PageIn } from "@/lib/documentos/analysis";
import { HighlightedText } from "./HighlightedText";

export type PageTarget = { page: number; quote?: string };

/**
 * Mostra o texto de uma página do documento com o trecho citado destacado e rola até ele (o "link âncora para o trecho
 * original" do parecer). O texto é o que foi extraído do PDF, não uma imagem da página. Navega entre as páginas.
 */
export function PageViewerDialog({
  pages,
  target,
  keywords = [],
  onNavigate,
  onClose,
}: {
  pages: readonly PageIn[];
  target: PageTarget | null;
  keywords?: readonly string[];
  onNavigate: (page: number) => void;
  onClose: () => void;
}) {
  const markRef = useRef<HTMLElement | null>(null);
  const index = target ? pages.findIndex((p) => p.number === target.page) : -1;
  const page = index >= 0 ? pages[index] : null;
  const range = page && target?.quote ? findQuote(page.content, target.quote) : null;

  useEffect(() => {
    if (!page || !range) return;
    // o conteúdo do diálogo monta depois do open: espera o quadro seguinte para achar o trecho
    const id = requestAnimationFrame(() => markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [page, range]);

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl" data-testid="page-viewer">
        <DialogHeader>
          <DialogTitle>{page ? `Página ${page.number}` : "Página não encontrada"}</DialogTitle>
          <DialogDescription>
            {range ? "O trecho citado está destacado." : target?.quote && page ? "O trecho citado não foi localizado nesta página." : "Texto extraído do documento."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap text-text-secondary" tabIndex={0} aria-label="Texto da página">
          {page ? (
            range ? (
              segmentsFor(page.content, [range]).map((seg, i) =>
                seg.mark ? (
                  <mark key={i} ref={(el) => { markRef.current = el; }} data-quote-mark className="rounded-sm bg-accent-docs/30 px-0.5 text-text-primary">
                    {seg.text}
                  </mark>
                ) : (
                  <HighlightedText key={i} text={seg.text} terms={keywords} />
                ),
              )
            ) : (
              <HighlightedText text={page.content} terms={keywords} />
            )
          ) : (
            "Esta página não está no texto extraído."
          )}
        </div>
        {page && pages.length > 1 && (
          <div className="flex items-center justify-between">
            <Button type="button" size="sm" variant="outline" disabled={index === 0} onClick={() => onNavigate(pages[index - 1].number)}>
              <ChevronLeftIcon data-icon="inline-start" /> Anterior
            </Button>
            <span className="text-xs text-text-muted tabular-nums">{index + 1} de {pages.length}</span>
            <Button type="button" size="sm" variant="outline" disabled={index === pages.length - 1} onClick={() => onNavigate(pages[index + 1].number)}>
              Próxima <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
