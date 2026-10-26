import type { ExtractedDocument } from "./types";

/** Marcador que o pdf2md põe entre as páginas; o docling é configurado para usar o mesmo. */
export const PAGE_BREAK = "<!-- PAGE_BREAK -->";

/** Abaixo disto, em média por página, o PDF é tratado como escaneado (só imagem). */
export const SCANNED_TOKENS_PER_PAGE = 200;

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
  return {
    text: pages.map((p) => p.content).join("\n\n"),
    pages,
    isScanned: total / pages.length < SCANNED_TOKENS_PER_PAGE,
    isProtected: opts.isProtected ?? false,
  };
}

/** PDF com senha: não há texto a extrair. */
export function protectedDocument(): ExtractedDocument {
  return { text: "", pages: [], isScanned: false, isProtected: true };
}
