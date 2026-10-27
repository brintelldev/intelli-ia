// Destaque de termos e localização de trechos num texto, ignorando caixa, acento e pontuação. Puro (sem DOM):
// devolve posições no texto ORIGINAL para a tela marcar sem alterar o que está escrito.

export type Segment = { text: string; mark: boolean };

type Folded = { folded: string; map: number[] };

/**
 * Versão "dobrada" do texto (sem acento, minúscula) e, para cada caractere dobrado, a posição no original.
 * `loose` também troca qualquer sequência de pontuação/espaço por um único espaço (para comparar trechos citados).
 */
function fold(text: string, loose: boolean): Folded {
  let folded = "";
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    const base = text[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const ch of base) {
      const isWord = /[\p{L}\p{N}]/u.test(ch);
      if (loose && !isWord) {
        if (!lastSpace) {
          folded += " ";
          map.push(i);
          lastSpace = true;
        }
        continue;
      }
      folded += ch;
      map.push(i);
      lastSpace = !isWord && /\s/.test(ch);
    }
  }
  return { folded, map };
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/** Intervalos [início, fim) no original onde algum termo aparece (o termo precisa começar numa palavra: "multa" marca "multas"). */
export function findTerms(text: string, terms: readonly string[]): [number, number][] {
  const { folded, map } = fold(text, false);
  const ranges: [number, number][] = [];
  for (const raw of terms) {
    const t = fold(raw.trim(), false).folded;
    if (t.length < 2) continue;
    let from = 0;
    for (let at = folded.indexOf(t, from); at !== -1; at = folded.indexOf(t, from)) {
      from = at + t.length;
      if (isWordChar(folded[at - 1])) continue;
      ranges.push([map[at], map[from - 1] + 1]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Quebra o texto em trechos marcados e não marcados (a concatenação devolve o texto original, intacto). */
export function highlightTerms(text: string, terms: readonly string[]): Segment[] {
  return segmentsFor(text, findTerms(text, terms));
}

export function segmentsFor(text: string, ranges: readonly (readonly [number, number])[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s > pos) out.push({ text: text.slice(pos, s), mark: false });
    out.push({ text: text.slice(s, e), mark: true });
    pos = e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), mark: false });
  return out.length ? out : [{ text, mark: false }];
}

/**
 * Onde está o trecho citado no texto da página: [início, fim) no original, ou `null`. Compara sem caixa, acento nem
 * pontuação; "trecho … trecho" vale pelo maior pedaço (o modelo às vezes corta o meio).
 */
export function findQuote(text: string, quote: string): [number, number] | null {
  const pieces = quote.split(/…|\.{3}/).map((p) => fold(p.trim(), true).folded.trim()).filter((p) => p.length >= 12);
  const needle = pieces.sort((a, b) => b.length - a.length)[0] ?? fold(quote.trim(), true).folded.trim();
  if (needle.length < 12) return null;
  const { folded, map } = fold(text, true);
  const at = folded.indexOf(needle);
  if (at === -1) return null;
  return [map[at], map[at + needle.length - 1] + 1];
}
