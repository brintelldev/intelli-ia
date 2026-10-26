import { z } from "zod";

// Modelos de seções e critérios de formatação definidos pela pessoa (itens 115, 121, 122).
// Puro (sem banco): o TemplateEditor (cliente), as rotas e os prompts usam o mesmo código.

export const TEMPLATE_MODULES = ["demo1_summary", "demo2_report"] as const;
export type TemplateModule = (typeof TEMPLATE_MODULES)[number];

export const TONES = ["tecnico", "executivo", "juridico"] as const;
export const LENGTHS = ["curto", "medio", "longo"] as const;
export const DETAILS = ["resumido", "detalhado"] as const;

export const MAX_SECTIONS = 12;
export const NO_INFO = "(sem informações suficientes nas fontes)";

export const TemplateSchema = z.object({
  sections: z
    .array(z.object({ title: z.string().trim().min(1, "Toda seção precisa de um título").max(80), instructions: z.string().trim().max(300).optional() }))
    .min(1, "Inclua ao menos uma seção")
    .max(MAX_SECTIONS, `No máximo ${MAX_SECTIONS} seções`),
  format: z.object({
    tone: z.enum(TONES),
    length: z.enum(LENGTHS),
    citations: z.boolean(),
    detail: z.enum(DETAILS),
  }),
});
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateSection = Template["sections"][number];

export const DEFAULT_FORMAT: Template["format"] = { tone: "tecnico", length: "medio", citations: true, detail: "resumido" };

/** Seção que não pode faltar (rastreabilidade): se a pessoa a remover, volta ao final. */
export const MANDATORY: Record<TemplateModule, TemplateSection> = {
  demo2_report: { title: "Referências", instructions: "Lista numerada com as fontes citadas (título, URL e relevância)." },
  demo1_summary: { title: "Metodologia", instructions: "Critérios, palavras-chave e modelo utilizados na análise." },
};

/** Compara títulos sem maiúsculas, acentos nem espaços sobrando ("Referencias " = "Referências"). */
export const normTitle = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function withMandatory(t: Template, module: TemplateModule): Template {
  const must = MANDATORY[module];
  if (t.sections.some((s) => normTitle(s.title) === normTitle(must.title))) return t;
  return { ...t, sections: [...t.sections, must] };
}

/**
 * Schema da saída do modelo. É propositalmente frouxo (lista de {title, content}): os provedores não
 * aceitam todas as restrições de tamanho em saída estruturada, e quem garante títulos e ordem é o
 * `normalizeSections`, depois. A descrição diz ao modelo quais são os títulos.
 */
export function buildSectionsSchema(t: Template) {
  const titles = t.sections.map((s) => s.title);
  return z.object({
    sections: z
      .array(
        z.object({
          title: z.string().describe("Título da seção, idêntico ao pedido"),
          content: z.string().describe("Conteúdo da seção em Markdown"),
        }),
      )
      .describe(`Exatamente estas seções, nesta ordem: ${titles.map((x) => `"${x}"`).join(", ")}`),
  });
}

/**
 * Garante o que foi pedido: um item por seção, na ordem e com o título do modelo. Seção que o modelo não
 * devolveu vira "(sem informações suficientes nas fontes)"; seção que ele inventou é descartada.
 * Se o título vier repetido, vale a primeira ocorrência.
 */
export function normalizeSections(t: Template, out: { title: string; content: string }[]): { heading: string; content: string }[] {
  const byTitle = new Map<string, string>();
  for (const o of out) {
    const k = normTitle(o.title);
    if (!byTitle.has(k)) byTitle.set(k, o.content.trim());
  }
  return t.sections.map((s) => ({ heading: s.title, content: byTitle.get(normTitle(s.title)) || NO_INFO }));
}

const TONE: Record<Template["format"]["tone"], string> = {
  tecnico: "Linguagem técnica e precisa, com os termos do domínio, sem simplificar o conteúdo.",
  executivo: "Linguagem executiva e direta: comece pela conclusão, frases curtas, sem jargão, foco em decisão e impacto.",
  juridico: "Linguagem jurídica formal e cautelosa: indique os fundamentos e dispositivos citados nas fontes e use expressões como \"em tese\" quando a fonte não for conclusiva.",
};
const LENGTH: Record<Template["format"]["length"], string> = {
  curto: "Cada seção com no máximo 80 palavras.",
  medio: "Cada seção entre 120 e 250 palavras.",
  longo: "Cada seção entre 300 e 500 palavras, aprofundando o assunto.",
};
const DETAIL: Record<Template["format"]["detail"], string> = {
  resumido: "Nível de detalhe: resumido, só o essencial, sem exemplos extensos.",
  detalhado: "Nível de detalhe: detalhado, com dados, números, exemplos e ressalvas das fontes.",
};

/** Os critérios de formatação (tom, tamanho, detalhe, citações, idioma), um por linha, sem o marcador "- ". */
export function formatCriteria(format: Template["format"]): string[] {
  return [
    TONE[format.tone],
    LENGTH[format.length],
    DETAIL[format.detail],
    format.citations ? "Cite as fontes no texto com marcadores numéricos entre colchetes, como [1] e [2], que correspondem à lista de fontes." : "Não use marcadores de citação no texto.",
    "Escreva em português do Brasil, em Markdown (listas e negrito quando ajudarem), sem repetir o título da seção dentro do conteúdo.",
  ];
}

/** Trecho do prompt de sistema com as seções (em ordem) e os critérios de formatação. */
export function formatInstructions(t: Template): string {
  const list = t.sections.map((s, i) => `${i + 1}. "${s.title}"${s.instructions ? `: ${s.instructions}` : ""}`).join("\n");
  return [
    "Estruture a resposta EXATAMENTE nas seções abaixo, nesta ordem e com estes títulos, sem acrescentar nem omitir seções:",
    list,
    "",
    "Critérios de formatação:",
    ...formatCriteria(t.format).map((c) => `- ${c}`),
  ].join("\n");
}

/** Identifica o modelo + critérios: entra na chave do cache da pesquisa (outro modelo = outra resposta). */
export async function templateHash(t: Template): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([t.sections.map((s) => [s.title, s.instructions ?? ""]), t.format]));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
