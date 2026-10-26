import { estimateTokens } from "./document";
import type { Chunk, ExtractedDocument } from "./types";

type Block = { text: string; page: number; section?: string; tokens: number };

const HEADING = /^#{1,6}\s+(.*)$/;

/** Quebra o texto em blocos (parágrafos); frases longas demais são divididas para caberem num chunk. */
function toBlocks(doc: ExtractedDocument, target: number): Block[] {
  const blocks: Block[] = [];
  let section: string | undefined;
  for (const page of doc.pages) {
    for (const raw of page.content.split(/\n{2,}/)) {
      const para = raw.trim();
      if (!para) continue;
      const h = HEADING.exec(para.split("\n")[0]);
      if (h) section = h[1].replace(/[*_`]/g, "").trim() || section;
      for (const text of splitLong(para, target)) {
        blocks.push({ text, page: page.number, section, tokens: estimateTokens(text) });
      }
    }
  }
  return blocks;
}

function splitLong(text: string, target: number): string[] {
  if (estimateTokens(text) <= target) return [text];
  const out: string[] = [];
  let cur = "";
  // por frase; se uma "frase" ainda for gigante (sem pontuação), corta por palavras
  for (const piece of text.split(/(?<=[.!?;:])\s+|\n/)) {
    for (const part of cutWords(piece, target)) {
      if (cur && estimateTokens(cur + " " + part) > target) {
        out.push(cur);
        cur = part;
      } else cur = cur ? cur + " " + part : part;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function cutWords(text: string, target: number): string[] {
  if (estimateTokens(text) <= target) return [text];
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (cur && estimateTokens(cur + " " + w) > target) {
      out.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Chunks por parágrafo/heading, ~`targetTokens` cada, com `overlap` (fração) do chunk anterior repetido
 * no começo do seguinte. `startPage` = página do primeiro bloco NOVO do chunk (o trecho repetido não conta);
 * `sectionTitle` = último heading visto até esse bloco.
 */
export function chunkDocument(
  doc: ExtractedDocument,
  opts: { targetTokens?: number; overlap?: number } = {},
): Chunk[] {
  const target = opts.targetTokens ?? 600;
  const overlap = opts.overlap ?? 0.15;
  const blocks = toBlocks(doc, target);
  const chunks: Chunk[] = [];

  let i = 0;
  while (i < blocks.length) {
    // 1) trecho repetido: últimos blocos do chunk anterior, até ~overlap*target tokens
    const carried: Block[] = [];
    if (chunks.length) {
      let used = 0;
      for (let k = i - 1; k >= 0 && used + blocks[k].tokens <= target * overlap; k--) {
        carried.unshift(blocks[k]);
        used += blocks[k].tokens;
      }
    }
    // 2) blocos novos até completar o alvo (pelo menos um, mesmo que passe do alvo)
    const first = i;
    let tokens = carried.reduce((n, b) => n + b.tokens, 0);
    while (i < blocks.length && (i === first || tokens + blocks[i].tokens <= target)) {
      tokens += blocks[i].tokens;
      i++;
    }
    const fresh = blocks.slice(first, i);
    chunks.push({
      content: [...carried, ...fresh].map((b) => b.text).join("\n\n"),
      metadata: {
        index: chunks.length,
        startPage: fresh[0].page,
        ...(fresh[0].section ? { sectionTitle: fresh[0].section } : {}),
      },
    });
  }
  return chunks;
}
