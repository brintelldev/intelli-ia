/** Markdown mínimo para PDF e DOCX: o que a saída dos modelos usa de fato. HTML cru é tratado como texto. */
export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { type: "heading"; level: 1 | 2 | 3; spans: Span[] }
  | { type: "paragraph"; spans: Span[] }
  | { type: "bullet"; spans: Span[] }
  | { type: "numbered"; n: number; spans: Span[] }
  | { type: "quote"; spans: Span[] };

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith("**") || t.startsWith("__")) spans.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith("`")) spans.push({ text: t.slice(1, -1), code: true });
    else if (t.startsWith("[")) {
      const [, label, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      spans.push({ text: `${label} (${url})` }); // link vira texto com a URL visível: some em papel e em planilha
    } else spans.push({ text: t.slice(1, -1), italic: true });
    last = m.index + t.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text: "" }];
}

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", spans: parseInline(para.join(" ")) });
    para = [];
  };
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    let m: RegExpExecArray | null;
    if (!line.trim()) flush();
    else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: "heading", level: Math.min(m[1].length, 3) as 1 | 2 | 3, spans: parseInline(m[2]) });
    } else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: "bullet", spans: parseInline(m[1]) });
    } else if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: "numbered", n: Number(m[1]), spans: parseInline(m[2]) });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: "quote", spans: parseInline(m[1]) });
    } else para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Texto puro de um conteúdo markdown (para o XLSX e para contagens). */
export function stripMarkdown(md: string): string {
  return parseMarkdown(md)
    .map((b) => (b.type === "bullet" ? "• " : b.type === "numbered" ? `${b.n}. ` : "") + b.spans.map((s) => s.text).join(""))
    .join("\n");
}
