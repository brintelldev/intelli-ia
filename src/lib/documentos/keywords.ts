import { z } from "zod";

export const MAX_KEYWORDS = 10;
const MAX_KEYWORD_CHARS = 60;
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
