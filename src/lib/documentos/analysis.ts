import "@/lib/zod-pt";
import { z } from "zod";
import { estimateTokens } from "@/lib/pdf/document";
import { LENGTHS, TONES, TemplateSchema } from "@/lib/templates";

// Análise de um documento por palavras-chave (itens 112 a 114): relevância por seção, trechos onde cada
// termo aparece, taxonomia e resumo. Este módulo é puro: schema, prompts e a VALIDAÇÃO do que o modelo diz
// (nº de página e trecho citado precisam existir no documento).

export const SIZES = LENGTHS; // curto | medio | longo
export const AUDIENCES = TONES; // tecnico | executivo | juridico

export type PageIn = { number: number; content: string };

export const AnalyzeBody = z
  .object({
    pages: z.array(z.object({ number: z.int().min(1), content: z.string() })).min(1, "Envie o texto do documento").max(3000),
    keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    filename: z.string().trim().max(200).default("documento.pdf"),
    modelId: z.string().max(100).optional(),
    /** modelo de seções salvo (do sistema ou da pessoa) OU um rascunho inline; sem nenhum, só o resumo curto */
    templateId: z.string().max(60).optional(),
    template: TemplateSchema.optional(),
    /** tamanho e público do resumo (item 115) */
    summary: z.object({ size: z.enum(SIZES), audience: z.enum(AUDIENCES) }).optional(),
    /** grava o texto no banco vetorial para o chat poder responder sobre ele */
    index: z.boolean().default(true),
  })
  .refine((b) => b.pages.reduce((n, p) => n + p.content.length, 0) <= 2_000_000, { message: "Documento grande demais (máximo 2 milhões de caracteres)", path: ["pages"] })
  .refine((b) => b.pages.some((p) => p.content.trim()), { message: "O documento não tem texto", path: ["pages"] });
export type AnalyzeInput = z.infer<typeof AnalyzeBody>;

export const DocumentAnalysisSchema = z.object({
  relevanceBySection: z
    .array(
      z.object({
        title: z.string().describe("Título da seção ou do tema do documento"),
        score: z.number().describe("Relevância da seção para as palavras-chave, de 0 a 100"),
        pageRef: z.number().describe("Número da página onde a seção começa"),
        snippet: z.string().describe("Trecho LITERAL e curto (até 200 caracteres) copiado da seção"),
      }),
    )
    .describe("Entre 4 e 12 seções, da mais para a menos relevante"),
  taxonomy: z.array(z.string()).describe("Temas principais do documento, de 3 a 8, em poucas palavras"),
  keywordMatches: z
    .array(
      z.object({
        keyword: z.string(),
        occurrences: z
          .array(z.object({ context: z.string().describe("Trecho LITERAL e curto (até 200 caracteres) onde o termo aparece"), page: z.number() }))
          .describe("Até 5 ocorrências mais importantes"),
      }),
    )
    .describe("Uma entrada para cada palavra-chave informada"),
  summary: z.string().describe("Resumo do documento orientado às palavras-chave, em até 5 frases"),
  suggestions: z.array(z.string()).describe("Até 5 pontos de atenção ou próximos passos"),
});
export type RawAnalysis = z.infer<typeof DocumentAnalysisSchema> & { summarySections?: { title: string; content: string }[] };

export type CheckedAnalysis = {
  relevanceBySection: { title: string; score: number; pageRef: number; snippet: string; verified: boolean }[];
  taxonomy: string[];
  keywordMatches: { keyword: string; count: number; occurrences: { context: string; page: number; verified: boolean }[] }[];
  summary: string;
  suggestions: string[];
  summarySections?: { heading: string; content: string }[];
};

// ── validação ────────────────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Procura o trecho citado no texto de verdade (sem caixa, acento nem pontuação). Trecho com "…" é procurado pelo
 * maior pedaço. Devolve a página onde achou (a citada, se ela contém) ou `null`.
 */
export function locateSnippet(snippet: string, pages: readonly PageIn[], claimed?: number): number | null {
  const parts = snippet.split(/…|\.{3}/).map(norm).filter((p) => p.length >= 12);
  const needle = parts.sort((a, b) => b.length - a.length)[0] ?? norm(snippet);
  if (needle.length < 12) return null;
  const normed = pages.map((p) => ({ n: p.number, t: norm(p.content) }));
  const onClaimed = normed.find((p) => p.n === claimed && p.t.includes(needle));
  return onClaimed?.n ?? normed.find((p) => p.t.includes(needle))?.n ?? null;
}

const clampPage = (n: number, pages: readonly PageIn[]) => {
  const nums = pages.map((p) => p.number);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? Math.round(n) : lo));
};

/**
 * O modelo erra número de página e inventa trecho. Aqui: nota 0 a 100 inteira; o trecho é procurado no documento e a
 * página é CORRIGIDA para onde ele realmente está; sem o trecho no documento, `verified: false` (a tela não deve
 * destacá-lo) e a página é só limitada ao intervalo existente.
 */
export function checkAnalysis(raw: RawAnalysis, pages: readonly PageIn[], keywords: readonly string[] = []): CheckedAnalysis {
  // remove vazios e repetidos (sem caixa nem acento), mantendo a primeira grafia
  const clean = (xs: readonly string[], max: number) => {
    const seen = new Set<string>();
    return xs.map((x) => x.trim()).filter((x) => x && !seen.has(norm(x)) && seen.add(norm(x))).slice(0, max);
  };

  const relevanceBySection = (raw.relevanceBySection ?? []).map((s) => {
    const found = locateSnippet(s.snippet, pages, s.pageRef);
    return {
      title: s.title.trim(),
      score: Math.min(100, Math.max(0, Math.round(Number.isFinite(s.score) ? s.score : 0))),
      pageRef: found ?? clampPage(s.pageRef, pages),
      snippet: s.snippet.trim(),
      verified: found !== null,
    };
  });

  const byKey = new Map((raw.keywordMatches ?? []).map((m) => [norm(m.keyword), m]));
  // uma entrada por palavra-chave pedida, na ordem em que a pessoa as digitou (as que o modelo omitiu ficam com 0)
  const asked = keywords.length ? keywords : (raw.keywordMatches ?? []).map((m) => m.keyword);
  const keywordMatches = asked.map((keyword) => {
    const m = byKey.get(norm(keyword));
    const occurrences = (m?.occurrences ?? []).slice(0, 5).map((o) => {
      const found = locateSnippet(o.context, pages, o.page);
      return { context: o.context.trim(), page: found ?? clampPage(o.page, pages), verified: found !== null };
    });
    return { keyword, count: occurrences.filter((o) => o.verified).length, occurrences };
  });

  return {
    relevanceBySection,
    taxonomy: clean(raw.taxonomy ?? [], 12),
    keywordMatches,
    summary: (raw.summary ?? "").trim(),
    suggestions: clean(raw.suggestions ?? [], 8),
  };
}

// ── prompts ──────────────────────────────────────────────────────────────────────────

export const pagesToText = (pages: readonly PageIn[]) => pages.map((p) => `[Página ${p.number}]\n${p.content.trim()}`).join("\n\n");

export const ANALYSIS_SYSTEM = [
  "Você é um analista que revisa documentos longos (contratos, normas, relatórios) para um profissional.",
  "O texto do documento traz marcadores [Página N]. Use SEMPRE esses números nas referências de página.",
  "Todo trecho que você citar (campo snippet ou context) deve ser copiado LITERALMENTE do documento, curto (até 200 caracteres), sem parafrasear.",
  "Não invente informação: se uma palavra-chave não aparece no documento, devolva a lista de ocorrências vazia para ela.",
  "Escreva em português do Brasil.",
].join("\n");

export function buildAnalysisPrompt(opts: { documentBlock: string; keywords: readonly string[]; filename: string; extra?: string }): string {
  return [
    `Documento: ${opts.filename}`,
    opts.keywords.length ? `Palavras-chave de interesse: ${opts.keywords.join("; ")}` : "Nenhuma palavra-chave foi informada: avalie a relevância geral e a taxonomia dos temas.",
    opts.documentBlock,
    "Analise o documento: relevância por seção (0 a 100), ocorrências de cada palavra-chave com trecho literal e página, taxonomia, resumo e pontos de atenção.",
    opts.extra ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── documentos longos (map-reduce) ───────────────────────────────────────────────────

/** Acima disto (tokens estimados) o documento não vai inteiro ao modelo: resume por partes e consolida. */
// ponytail: 120 mil tokens cabe com folga nas janelas atuais (200 mil+) junto da resposta; para 1 milhão de tokens
// de janela dá para subir o limite e evitar a perda de detalhe do resumo por partes.
export const DIRECT_LIMIT_TOKENS = 120_000;
export const GROUP_TOKENS = 40_000;

export const needsMapReduce = (pages: readonly PageIn[]) => pages.reduce((n, p) => n + estimateTokens(p.content), 0) > DIRECT_LIMIT_TOKENS;

/** Grupos de páginas seguidas de até `max` tokens (uma página maior que o limite fica sozinha). */
export function groupPages(pages: readonly PageIn[], max = GROUP_TOKENS): PageIn[][] {
  const groups: PageIn[][] = [];
  let cur: PageIn[] = [];
  let tokens = 0;
  for (const p of pages) {
    const t = estimateTokens(p.content);
    if (cur.length && tokens + t > max) {
      groups.push(cur);
      cur = [];
      tokens = 0;
    }
    cur.push(p);
    tokens += t;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export const MAP_SYSTEM = [
  "Você prepara notas de um trecho de um documento longo para uma análise posterior.",
  "O texto traz marcadores [Página N]. Escreva notas curtas em tópicos que preservem: os temas de cada seção com a página, e, para cada palavra-chave, onde ela aparece, com um trecho LITERAL curto e a página.",
  "Não invente nada que não esteja no trecho. Não comente nem opine.",
].join("\n");
