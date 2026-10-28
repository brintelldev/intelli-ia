import "@/lib/zod-pt";
import { z } from "zod";
import { AUDIENCES, SIZES } from "./analysis";
import { AnalysisInput } from "./brief";
import { DEFAULT_FORMAT, formatCriteria, TemplateSchema, type Template } from "@/lib/templates";

// Resumo do documento (item 115) refeito SEM repetir a análise: só o resumo, com o tamanho e o público escolhidos,
// em texto corrido ou nas seções do modelo da pessoa. Puro: schema, formato efetivo e prompts.

export const SummaryBody = z
  .object({
    pages: z.array(z.object({ number: z.int().min(1), content: z.string() })).min(1, "Envie o texto do documento").max(3000),
    keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    filename: z.string().trim().max(200).default("documento.pdf"),
    modelId: z.string().max(100).optional(),
    analysis: AnalysisInput.optional(),
    summary: z.object({ size: z.enum(SIZES), audience: z.enum(AUDIENCES) }),
    templateId: z.string().max(60).optional(),
    template: TemplateSchema.optional(),
  })
  .refine((b) => b.pages.reduce((n, p) => n + p.content.length, 0) <= 2_000_000, { message: "Documento grande demais (máximo 2 milhões de caracteres)", path: ["pages"] })
  .refine((b) => b.pages.some((p) => p.content.trim()), { message: "O documento não tem texto", path: ["pages"] });
export type SummaryInput = z.infer<typeof SummaryBody>;

export const PlainSummarySchema = z.object({ summary: z.string().describe("O resumo do documento, em Markdown") });

/** Tamanho e público escolhidos nos controles valem sobre o que o modelo de seções diz (tom e tamanho); o resto (detalhe, citações) fica. */
export function effectiveFormat(template: Template | null, opts: SummaryInput["summary"]): Template["format"] {
  return { ...(template?.format ?? DEFAULT_FORMAT), tone: opts.audience, length: opts.size };
}

/** Para quem o resumo é escrito: o que muda de verdade entre os públicos (estrutura, vocabulário e o que se destaca). */
export const AUDIENCE_PERSONA: Record<SummaryInput["summary"]["audience"], string> = {
  tecnico: "Escreva para especialistas da área: use a terminologia exata do documento, com números, prazos, percentuais e condições, em prosa densa e precisa, sem simplificar.",
  executivo: "Escreva para um gestor sem tempo: abra com a conclusão e o que exige decisão; use tópicos curtos e frases diretas; destaque valores, prazos e riscos em negrito; sem jargão e sem citar o texto do documento.",
  juridico: "Escreva para um parecerista jurídico: identifique cada ponto pelo nome e número da cláusula ou artigo, transcreva entre aspas o trecho decisivo, aponte lacunas, ambiguidades e riscos jurídicos, em linguagem formal e cautelosa (\"em tese\", \"salvo melhor juízo\").",
};

const WORDS: Record<SummaryInput["summary"]["size"], string> = { curto: "no máximo 80 palavras", medio: "entre 120 e 250 palavras", longo: "entre 300 e 500 palavras" };

/** Regra de tamanho: no texto corrido vale para o resumo INTEIRO; nas seções do modelo, para cada seção. */
export function lengthRule(size: SummaryInput["summary"]["size"], sections: boolean): string {
  return sections
    ? `Tamanho: cada seção deve ter ${WORDS[size]}. É um limite, não uma sugestão.`
    : `Tamanho: o resumo INTEIRO deve ter ${WORDS[size]}, no total. É um limite, não uma sugestão. Escreva em texto corrido ou em poucos tópicos, sem dividir em seções com títulos.`;
}

/** Teto de tokens de saída: acompanha o tamanho pedido (inclui margem para o raciocínio dos modelos atuais, além do JSON), para uma resposta longa demais não vir cortada. */
export function maxTokensFor(size: SummaryInput["summary"]["size"], sections: number): number {
  const base = { curto: 2400, medio: 3200, longo: 4800 }[size];
  return Math.min(8000, sections > 0 ? base * sections : base);
}

export const SUMMARY_SYSTEM = [
  "Você resume documentos para um profissional que precisa entender o essencial rapidamente.",
  "Cubra o documento INTEIRO, não só o começo, e dê destaque às palavras-chave de interesse (onde aparecem e o que o documento diz sobre elas).",
  "O texto do documento traz marcadores [Página N]. Ao citar o documento, indique a página no formato (p. 3); não use marcadores numéricos como [1].",
  "Seja fiel ao texto: não invente informação. Se algo não consta, diga que não consta.",
].join("\n");

export function buildSummaryPrompt(opts: {
  audience?: SummaryInput["summary"]["audience"]; documentBlock: string; analysisBlock?: string; keywords: readonly string[]; filename: string; partial: boolean; format: Template["format"]; template: Template | null }): string {
  // formatCriteria diz "cada seção": aqui a linha de tamanho é trocada pela regra certa para texto corrido ou seções
  const [tone, , detail, , language] = formatCriteria({ ...opts.format, citations: false });
  const criteria = [tone, lengthRule(opts.format.length, opts.template !== null), detail, language].map((c) => `- ${c}`).join("\n");
  return [
    `Documento: ${opts.filename}`,
    opts.keywords.length ? `Palavras-chave de interesse: ${opts.keywords.join("; ")}` : "",
    opts.partial ? "ATENÇÃO: abaixo estão apenas as páginas mais relevantes do documento (o documento completo é maior)." : "",
    opts.documentBlock,
    opts.analysisBlock ?? "",
    opts.template
      ? [
          "Escreva o resumo em EXATAMENTE estas seções, nesta ordem e com estes títulos:",
          ...opts.template.sections.map((s, i) => `${i + 1}. "${s.title}"${s.instructions ? `: ${s.instructions}` : ""}`),
        ].join("\n")
      : "Escreva um resumo do documento orientado às palavras-chave (se houver).",
    opts.audience ? `Público-alvo: ${AUDIENCE_PERSONA[opts.audience]}` : "",
    `Critérios de formatação:\n${criteria}`,
    opts.format.citations ? "- Ao citar o documento, indique a página no formato (p. 3)." : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
