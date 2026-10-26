import { z } from "zod";

export const MAX_KEYWORDS = 10;
export const MAX_KEYWORD_CHARS = 60;
/** Quanto do documento vai para o modelo: sugerir termos não precisa do texto inteiro (e custa por token). */
export const EXCERPT_CHARS = 24_000;

export const SuggestBody = z.object({
  text: z.string().min(1, "Envie o texto do documento").max(2_000_000, "Documento grande demais"),
  /** palavras-chave que a pessoa já digitou: não são sugeridas de novo */
  existing: z.array(z.string().max(MAX_KEYWORD_CHARS * 2)).max(50).optional(),
  filename: z.string().max(200).optional(),
});

/**
 * Trecho que representa o documento: se for longo, começo (onde ficam objeto e definições), meio e fim
 * (conclusões, penalidades, anexos) em partes iguais, para não sugerir termos só do cabeçalho.
 */
export function excerptForPrompt(text: string, max = EXCERPT_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const part = Math.floor(max / 3);
  const mid = Math.floor(t.length / 2) - Math.floor(part / 2);
  return [t.slice(0, part), t.slice(mid, mid + part), t.slice(-part)].join("\n[…]\n");
}

/** Limpa a saída do modelo: sem vazios, duplicados (ignora caixa e acento), já informados, longos demais ou com cara de frase. */
export function cleanKeywords(raw: readonly string[], existing: readonly string[] = [], max = MAX_KEYWORDS): string[] {
  const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set(existing.map(key));
  const out: string[] = [];
  for (const r of raw) {
    const k = r.replace(/^[\s\-–•*\d.)]+/, "").replace(/[\s.;,]+$/, "").replace(/\s+/g, " ").trim();
    if (!k || k.length > MAX_KEYWORD_CHARS || k.split(" ").length > 6) continue;
    if (seen.has(key(k))) continue;
    seen.add(key(k));
    out.push(k);
    if (out.length === max) break;
  }
  return out;
}

export const KEYWORD_SYSTEM = [
  "Você ajuda analistas a revisar documentos extensos.",
  `Sugira até ${MAX_KEYWORDS} palavras-chave ou expressões curtas (1 a 4 palavras) que mais ajudem a localizar e analisar os temas importantes do documento.`,
  "Prefira termos específicos do documento (obrigações, prazos, penalidades, partes, objeto, riscos) a palavras genéricas.",
  "Escreva em português, sem repetir os termos já informados e sem explicações.",
].join("\n");

// ── entrada de palavras-chave na tela (puro, usado pelo KeywordInput) ────────────────────

export const MAX_KEYWORD_CHIPS = 30; // o mesmo limite da API de análise
const keyOf = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Texto digitado ou colado → termos: separa por vírgula, ponto e vírgula e quebra de linha. */
export function splitKeywordInput(text: string): string[] {
  return text.split(/[,;\n]+/).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export type AddResult = { keywords: string[]; added: string[]; duplicates: string[]; tooLong: string[]; overflow: string[] };

/**
 * Acrescenta termos sem repetir (ignora caixa e acento) e respeitando os limites da API (60 caracteres, 30 termos).
 * Devolve também o que ficou de fora e por quê, para a tela avisar em vez de descartar em silêncio.
 */
export function addKeywords(current: readonly string[], incoming: readonly string[], max = MAX_KEYWORD_CHIPS): AddResult {
  const keywords = [...current];
  const seen = new Set(current.map(keyOf));
  const r: AddResult = { keywords, added: [], duplicates: [], tooLong: [], overflow: [] };
  for (const raw of incoming) {
    const k = raw.replace(/\s+/g, " ").trim();
    if (!k) continue;
    if (k.length > MAX_KEYWORD_CHARS) r.tooLong.push(k);
    else if (seen.has(keyOf(k))) r.duplicates.push(k);
    else if (keywords.length >= max) r.overflow.push(k);
    else {
      keywords.push(k);
      seen.add(keyOf(k));
      r.added.push(k);
    }
  }
  return r;
}
