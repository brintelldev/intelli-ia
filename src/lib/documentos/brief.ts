import "@/lib/zod-pt";
import { z } from "zod";
import { estimateTokens } from "@/lib/pdf/document";
import { NO_INFO } from "@/lib/templates";
import { locateSnippet, type CheckedAnalysis, type PageIn } from "./analysis";

// Parecer técnico (item 116): 5 seções fixas, cada achado com página e trecho literal. Puro: schema, escolha das páginas
// que vão ao modelo, validação do que ele escreve e montagem das seções em Markdown.

const str = (max: number) => z.string().trim().max(max);

/** A análise (T-14) volta do navegador: é dado do próprio usuário, mas entra limitada e sem confiar no formato. */
export const AnalysisInput = z.object({
  relevanceBySection: z.array(z.object({ title: str(200), score: z.number(), pageRef: z.number(), snippet: str(500), verified: z.boolean() })).max(30),
  taxonomy: z.array(str(120)).max(12),
  keywordMatches: z
    .array(z.object({ keyword: str(60), count: z.number().optional(), occurrences: z.array(z.object({ context: str(500), page: z.number(), verified: z.boolean() })).max(10) }))
    .max(30),
  summary: str(3000),
  suggestions: z.array(str(500)).max(10),
});

export const BriefBody = z
  .object({
    pages: z.array(z.object({ number: z.int().min(1), content: z.string() })).min(1, "Envie o texto do documento").max(3000),
    keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    filename: z.string().trim().max(200).default("documento.pdf"),
    modelId: z.string().max(100).optional(),
    analysis: AnalysisInput.optional(),
  })
  .refine((b) => b.pages.reduce((n, p) => n + p.content.length, 0) <= 2_000_000, { message: "Documento grande demais (máximo 2 milhões de caracteres)", path: ["pages"] })
  .refine((b) => b.pages.some((p) => p.content.trim()), { message: "O documento não tem texto", path: ["pages"] });
export type BriefInput = z.infer<typeof BriefBody>;

export const SEVERITIES = ["alta", "media", "baixa"] as const;

// "objetoAnalise" (e não "objectoAnalise"): o PRD tinha um typo.
export const BriefSchema = z.object({
  objetoAnalise: z.string().describe("Identificação do documento e escopo da análise, em 2 a 3 frases"),
  metodologia: z.string().describe("Critérios e palavras-chave utilizados, em 1 a 2 frases"),
  achadosPrincipais: z
    .array(
      z.object({
        keyword: z.string().describe("A palavra-chave a que o achado se refere"),
        finding: z.string().describe("O achado, objetivo e fiel ao documento, em 1 ou 2 frases"),
        pageRef: z.number().describe("Página (marcador [Página N]) onde está o trecho"),
        quote: z.string().describe("Trecho LITERAL e curto (até 150 caracteres) copiado do documento que sustenta o achado"),
      }),
    )
    .describe("Um achado para cada palavra-chave que aparece no documento (no máximo 2 por palavra-chave)"),
  analiseRiscos: z
    .array(
      z.object({
        risk: z.string().describe("Ponto crítico, lacuna ou risco identificado no documento, em 1 frase"),
        severity: z.enum(SEVERITIES),
        pageRef: z.number().describe("Página onde está o trecho que o sustenta"),
        quote: z.string().describe("Trecho LITERAL e curto (até 150 caracteres) que sustenta o risco"),
      }),
    )
    .describe("De 3 a 5 riscos, só os que o texto do documento sustenta"),
  conclusao: z.string().describe("Síntese executiva em 3 frases"),
  recomendacoes: z.array(z.string()).describe("De 3 a 4 recomendações práticas, cada uma em 1 frase"),
});
export type RawBrief = z.infer<typeof BriefSchema>;

export type CheckedBrief = {
  objetoAnalise: string;
  metodologia: string;
  achadosPrincipais: { keyword: string; finding: string; pageRef: number | null; quote: string; verified: boolean }[];
  analiseRiscos: { risk: string; severity: (typeof SEVERITIES)[number]; pageRef: number | null; quote: string; verified: boolean }[];
  conclusao: string;
  recomendacoes: string[];
};

// ── que páginas vão ao modelo ─────────────────────────────────────────────────────────

/** O parecer usa o modelo mais caro (Opus): acima disto o texto inteiro não vai, só as páginas que sustentam a análise. */
export const BRIEF_DIRECT_TOKENS = 40_000;
export const BRIEF_EVIDENCE_TOKENS = 50_000;

export type Evidence = { pages: PageIn[]; partial: boolean };

/**
 * Documento até `BRIEF_DIRECT_TOKENS`: inteiro. Maior: as páginas citadas pela análise (seções mais relevantes primeiro, depois
 * as ocorrências das palavras-chave), até `BRIEF_EVIDENCE_TOKENS`, em ordem de página. Sem análise e documento grande: `null`
 * (a rota responde 400, porque escolher páginas às cegas daria um parecer sem base).
 */
export function selectEvidence(pages: readonly PageIn[], analysis?: z.infer<typeof AnalysisInput> | CheckedAnalysis): Evidence | null {
  const total = pages.reduce((n, p) => n + estimateTokens(p.content), 0);
  if (total <= BRIEF_DIRECT_TOKENS) return { pages: [...pages], partial: false };
  if (!analysis) return null;

  const byNumber = new Map(pages.map((p) => [p.number, p]));
  const ranked: number[] = [
    ...[...analysis.relevanceBySection].sort((a, b) => b.score - a.score).filter((s) => s.verified).map((s) => s.pageRef),
    ...analysis.keywordMatches.flatMap((k) => k.occurrences.filter((o) => o.verified).map((o) => o.page)),
  ];
  const chosen: PageIn[] = [];
  let used = 0;
  for (const n of ranked) {
    const p = byNumber.get(n);
    if (!p || chosen.includes(p)) continue;
    const t = estimateTokens(p.content);
    if (used + t > BRIEF_EVIDENCE_TOKENS) continue;
    chosen.push(p);
    used += t;
  }
  if (!chosen.length) return null;
  return { pages: chosen.sort((a, b) => a.number - b.number), partial: true };
}

// ── validação ────────────────────────────────────────────────────────────────────────

const normKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const textOr = (s: string | undefined) => (s ?? "").trim() || NO_INFO;

/**
 * Garante o contrato do parecer: as 5 seções nunca ficam vazias (viram o aviso padrão); cada trecho citado é procurado no
 * documento INTEIRO e a página é corrigida para onde ele está (`verified`); toda palavra-chave pedida tem ao menos uma
 * linha em "Achados", mesmo que seja "não encontrada" (para quem lê saber que foi procurada).
 */
export function checkBrief(raw: RawBrief, pages: readonly PageIn[], keywords: readonly string[] = []): CheckedBrief {
  const nums = pages.map((p) => p.number);
  const clamp = (n: number) => Math.min(Math.max(...nums), Math.max(Math.min(...nums), Math.round(Number.isFinite(n) ? n : nums[0])));
  const anchor = (quote: string, page: number) => {
    const found = locateSnippet(quote, pages, page);
    return { pageRef: found ?? clamp(page), verified: found !== null };
  };

  const achados = (raw.achadosPrincipais ?? [])
    .filter((a) => a.finding?.trim())
    .map((a) => ({ keyword: a.keyword.trim(), finding: a.finding.trim(), quote: a.quote.trim(), ...anchor(a.quote, a.pageRef) }));
  const withNull = achados as CheckedBrief["achadosPrincipais"];
  for (const k of keywords) {
    if (!achados.some((a) => normKey(a.keyword) === normKey(k))) {
      withNull.push({ keyword: k, finding: "Nenhum trecho do documento trata deste termo.", pageRef: null, quote: "", verified: true });
    }
  }
  // na ordem das palavras-chave pedidas; achados de termos que a pessoa não pediu ficam no fim
  const order = new Map(keywords.map((k, i) => [normKey(k), i]));
  withNull.sort((a, b) => (order.get(normKey(a.keyword)) ?? 999) - (order.get(normKey(b.keyword)) ?? 999));

  const rank = { alta: 0, media: 1, baixa: 2 } as const;
  const riscos = (raw.analiseRiscos ?? [])
    .filter((r) => r.risk?.trim())
    .map((r) => ({ risk: r.risk.trim(), severity: r.severity, quote: r.quote.trim(), ...anchor(r.quote, r.pageRef) }))
    .sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    objetoAnalise: textOr(raw.objetoAnalise),
    metodologia: textOr(raw.metodologia),
    achadosPrincipais: withNull,
    analiseRiscos: riscos,
    conclusao: textOr(raw.conclusao),
    recomendacoes: (raw.recomendacoes ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 8),
  };
}

// ── Markdown (ReportViewer e exportação) ─────────────────────────────────────────────

const pageTag = (p: number | null, verified: boolean) => (p == null ? "" : ` (p. ${p}${verified ? "" : ", não localizado no texto"})`);
const SEV_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

/** Os fatos objetivos da metodologia: não dependem do que o modelo escreveu. */
export function methodologyFacts(i: { filename: string; pages: number; keywords: readonly string[]; modelLabel: string; partial: boolean; date: string }): string {
  return [
    `**Documento:** ${i.filename} (${i.pages} ${i.pages === 1 ? "página" : "páginas"}${i.partial ? "; parecer baseado nas páginas mais relevantes da análise" : ""}).`,
    `**Palavras-chave:** ${i.keywords.length ? i.keywords.join(", ") : "nenhuma informada"}.`,
    `**Elaboração:** análise assistida por IA (${i.modelLabel}) em ${i.date}, com conferência automática das páginas e dos trechos citados.`,
  ].join("\n\n");
}

/** As 5 seções do PRD, prontas para o `ReportViewer` e a exportação (cada achado com a página e o trecho). */
export function briefToSections(b: CheckedBrief, facts: string): { heading: string; content: string }[] {
  const achados = b.achadosPrincipais
    .map((a) => `- **${a.keyword}**: ${a.finding}${pageTag(a.pageRef, a.verified)}${a.quote && a.verified ? `\n  > ${a.quote}` : ""}`)
    .join("\n");
  const riscos = b.analiseRiscos.length
    ? b.analiseRiscos.map((r) => `- **${SEV_LABEL[r.severity]}**: ${r.risk}${pageTag(r.pageRef, r.verified)}`).join("\n")
    : "Nenhum risco relevante foi identificado no texto analisado.";
  return [
    { heading: "Objeto da Análise", content: b.objetoAnalise },
    { heading: "Metodologia", content: `${b.metodologia}\n\n${facts}` },
    { heading: "Achados Principais", content: achados || NO_INFO },
    { heading: "Análise de Riscos", content: riscos },
    { heading: "Conclusão e Recomendações", content: `${b.conclusao}${b.recomendacoes.length ? `\n\n${b.recomendacoes.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : ""}` },
  ];
}

// ── prompts ──────────────────────────────────────────────────────────────────────────

export const BRIEF_SYSTEM = [
  "Você é um analista sênior que redige pareceres técnicos objetivos sobre documentos, para decisão de um profissional.",
  "O texto do documento traz marcadores [Página N]. Use SEMPRE esses números nas referências de página.",
  "Todo achado e todo risco deve vir acompanhado de um trecho LITERAL do documento (campo quote, até 200 caracteres), copiado sem parafrasear, e da página em que ele está.",
  "Seja fiel ao texto: não invente cláusulas, números nem consequências que o documento não sustente. Se algo não consta, diga que não consta.",
  "Redija de forma formal e CONCISA, em português do Brasil: frases curtas, sem repetir o que já foi dito em outra seção.",
].join("\n");

export function buildBriefPrompt(opts: { documentBlock: string; analysisBlock?: string; keywords: readonly string[]; filename: string; partial: boolean }): string {
  return [
    `Documento: ${opts.filename}`,
    opts.keywords.length ? `Palavras-chave de interesse: ${opts.keywords.join("; ")}` : "Nenhuma palavra-chave foi informada: foque nos pontos mais relevantes do documento.",
    opts.partial ? "ATENÇÃO: abaixo estão apenas as páginas mais relevantes do documento (o documento completo é maior). Não afirme que algo \"não consta no documento\" com base só nelas." : "",
    opts.documentBlock,
    opts.analysisBlock ?? "",
    "Redija o parecer técnico com as 5 seções: objeto da análise, metodologia, achados principais (por palavra-chave, com trecho e página), análise de riscos e conclusão com recomendações.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const analysisBlockText = (a: z.infer<typeof AnalysisInput>) =>
  [
    "Análise prévia do documento (apoio; o texto do documento prevalece):",
    `Resumo: ${a.summary}`,
    a.taxonomy.length ? `Temas: ${a.taxonomy.join("; ")}` : "",
    ...a.keywordMatches.map((k) => `- ${k.keyword}: ${k.occurrences.filter((o) => o.verified).map((o) => `p. ${o.page}`).join(", ") || "sem ocorrência verificada"}`),
  ]
    .filter(Boolean)
    .join("\n");

