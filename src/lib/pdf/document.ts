import type { ExtractedDocument } from "./types";

/** Marcador que o pdf2md põe entre as páginas; o docling é configurado para usar o mesmo. */
export const PAGE_BREAK = "<!-- PAGE_BREAK -->";

/** Abaixo disto, em média por página, o PDF PODE ser escaneado (regra do PRD)... */
export const SCANNED_TOKENS_PER_PAGE = 200;
/**
 * ...mas só se a maioria das páginas estiver praticamente VAZIA de texto. Só olhar a média classificava como escaneado um
 * PDF digital de páginas curtas (contrato de 150 tokens por página, relatório de tabelas), que iria ao OCR à toa: mais lento
 * e menos fiel que o texto que o próprio arquivo já tem. Página escaneada tem ~0 token (no máximo um carimbo ou rodapé).
 */
export const EMPTY_PAGE_TOKENS = 25;
export const EMPTY_PAGES_SHARE = 0.6;

/** Estimativa barata (~4 caracteres por token); basta para dimensionar chunks e detectar escaneado. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Monta o ExtractedDocument a partir do markdown com marcadores de página. */
export function buildDocument(markdown: string, opts: { isProtected?: boolean } = {}): ExtractedDocument {
  const pages = markdown.split(PAGE_BREAK).map((raw, i) => {
    const content = raw.trim();
    return { number: i + 1, content, tokenCount: estimateTokens(content) };
  });
  const total = pages.reduce((n, p) => n + p.tokenCount, 0);
  const empty = pages.filter((p) => p.tokenCount < EMPTY_PAGE_TOKENS).length;
  return {
    text: pages.map((p) => p.content).join("\n\n"),
    pages,
    isScanned: total / pages.length < SCANNED_TOKENS_PER_PAGE && empty / pages.length >= EMPTY_PAGES_SHARE,
    isProtected: opts.isProtected ?? false,
  };
}

/** PDF com senha: não há texto a extrair. */
export function protectedDocument(): ExtractedDocument {
  return { text: "", pages: [], isScanned: false, isProtected: true };
}
