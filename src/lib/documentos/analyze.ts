import { generateText, Output, streamText, type DeepPartial, type LanguageModel, type UIMessage, type UIMessageStreamWriter } from "ai";
import { estimateTokens } from "@/lib/pdf/document";
import { step, type StepData } from "@/lib/stream-steps";
import { buildSectionsSchema, formatCriteria, normalizeSections, type Template } from "@/lib/templates";
import { withUntrustedRule, wrapUntrusted } from "@/lib/untrusted";
import {
  ANALYSIS_SYSTEM, buildAnalysisPrompt, checkAnalysis, DocumentAnalysisSchema, groupPages, MAP_SYSTEM, needsMapReduce, pagesToText,
  type AnalyzeInput, type CheckedAnalysis, type RawAnalysis,
} from "./analysis";
import { pumpPartials } from "./stream-object";

export type AnalysisPart =
  | { phase: "partial"; analysis: DeepPartial<RawAnalysis> }
  | { phase: "final"; analysis: CheckedAnalysis; mapReduce: boolean; sourceId?: string; chunkCount?: number };
export type AnalysisMessage = UIMessage<never, { step: StepData; analysis: AnalysisPart }>;

type Usage = { inputTokens?: number | undefined; outputTokens?: number | undefined };
/**
 * `mapCalls` guarda o uso de CADA chamada de resumo por partes: o preço depende do tamanho de cada chamada (faixa de
 * prompt longo), então somar os tokens antes de calcular o custo cobraria a faixa errada.
 */
export type AnalysisResult = { checked: CheckedAnalysis; mainUsage: Usage; mapCalls: Usage[]; mapReduce: boolean };

const PARTIAL_EVERY_MS = 200; // o objeto parcial cresce a cada token: reenviar tudo a cada um seria desperdício
const MAP_CONCURRENCY = 3;
/** A resposta com seções do modelo cabe em mais tokens que o padrão de um chat; o do LlmConfig vale como piso. */
export const MIN_OUTPUT_TOKENS = 8000;

/**
 * Análise completa com progresso em etapas e o objeto parcial em streaming (`data-analysis`). Sem banco: o
 * modelo, o índice do chat e o relógio entram por parâmetro, para poder testar com modelo simulado.
 * Falha na indexação NÃO derruba a análise (a pessoa já tem o resultado); falha do modelo sobe como erro.
 */
export async function runAnalysis(opts: {
  writer: Pick<UIMessageStreamWriter<AnalysisMessage>, "write">;
  input: AnalyzeInput;
  /** modelo de seções efetivo (já com a seção obrigatória), se a pessoa escolheu ou montou um */
  template: Template | null;
  models: { main: LanguageModel; fast: LanguageModel };
  settings: { temperature: number; maxOutputTokens: number };
  signal?: AbortSignal;
  indexDocument?: (a: CheckedAnalysis) => Promise<{ sourceId: string; chunkCount: number }>;
}): Promise<AnalysisResult> {
  const { writer, input, template, models, settings, signal, indexDocument } = opts;
  const pages = input.pages;
  const tokens = pages.reduce((n, p) => n + estimateTokens(p.content), 0);

  step(writer, "read", "Lendo o documento", "running");
  const mapReduce = needsMapReduce(pages);
  step(writer, "read", "Documento lido", "done", { pages: pages.length, tokens });

  // 1) documentos longos: notas por partes com o modelo barato (map); o modelo principal recebe as notas (reduce)
  let documentBlock: string;
  const mapCalls: Usage[] = [];
  if (mapReduce) {
    const groups = groupPages(pages);
    step(writer, "map", `Resumindo o documento em ${groups.length} partes`, "running", { done: 0, total: groups.length });
    const notes: string[] = new Array(groups.length);
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < groups.length) {
        const i = next++;
        const g = groups[i];
        const r = await generateText({
          model: models.fast,
          temperature: 0.1,
          maxOutputTokens: 3000,
          abortSignal: signal,
          system: withUntrustedRule(MAP_SYSTEM),
          prompt: [
            wrapUntrusted(pagesToText(g), { id: i + 1, source: input.filename }),
            input.keywords.length ? `Palavras-chave: ${input.keywords.join("; ")}` : "",
            `Páginas ${g[0].number} a ${g.at(-1)!.number}.`,
          ].filter(Boolean).join("\n\n"),
        });
        notes[i] = `Notas das páginas ${g[0].number} a ${g.at(-1)!.number}:\n${r.text.trim()}`;
        mapCalls.push(r.totalUsage);
        step(writer, "map", `Resumindo o documento em ${groups.length} partes`, "running", { done: ++done, total: groups.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAP_CONCURRENCY, groups.length) }, worker));
    step(writer, "map", `Documento resumido em ${groups.length} partes`, "done", { done: groups.length, total: groups.length });
    documentBlock = wrapUntrusted(notes.join("\n\n"), { id: 1, source: `${input.filename} (notas por partes)` });
  } else {
    documentBlock = wrapUntrusted(pagesToText(pages), { id: 1, source: input.filename });
  }

  // 2) análise estruturada em streaming
  const sizeCriteria = !template && input.summary ? formatCriteria({ tone: input.summary.audience, length: input.summary.size, detail: "resumido", citations: false }) : null;
  const extra = template
    ? [
        "Além dos demais campos, preencha `summarySections` com EXATAMENTE estas seções, nesta ordem e com estes títulos:",
        ...template.sections.map((s, i) => `${i + 1}. "${s.title}"${s.instructions ? `: ${s.instructions}` : ""}`),
        "Critérios de formatação das seções:",
        // aqui não há lista numerada de fontes: a referência ao documento é a PÁGINA
        ...formatCriteria({ ...template.format, citations: false }).map((c) => `- ${c}`),
        template.format.citations ? "- Ao citar o documento, indique a página no formato (p. 3); não use marcadores numéricos como [1]." : "",
      ].filter(Boolean).join("\n")
    : sizeCriteria
      ? ["O campo `summary` deve seguir estes critérios:", ...sizeCriteria.slice(0, 3).map((c) => `- ${c}`)].join("\n")
      : "";
  const schema = template ? DocumentAnalysisSchema.extend({ summarySections: buildSectionsSchema(template).shape.sections }) : DocumentAnalysisSchema;

  step(writer, "analyze", "Analisando o documento", "running");
  const result = streamText({
    model: models.main,
    ...settings,
    maxOutputTokens: Math.max(settings.maxOutputTokens, MIN_OUTPUT_TOKENS),
    abortSignal: signal,
    system: withUntrustedRule(ANALYSIS_SYSTEM),
    prompt: buildAnalysisPrompt({ documentBlock, keywords: input.keywords, filename: input.filename, extra }),
    output: Output.object({ schema }),
  });

  await pumpPartials(result.partialOutputStream, PARTIAL_EVERY_MS, (partial) =>
    writer.write({ type: "data-analysis", id: "analysis", data: { phase: "partial", analysis: partial as DeepPartial<RawAnalysis> } }),
  );
  let raw: RawAnalysis;
  try {
    raw = (await result.output) as RawAnalysis;
  } catch (e) {
    step(writer, "analyze", "A análise falhou", "error");
    throw e;
  }
  const mainUsage = await result.totalUsage;

  const checked = checkAnalysis(raw, pages, input.keywords);
  if (template) checked.summarySections = normalizeSections(template, raw.summarySections ?? []);
  step(writer, "analyze", "Análise concluída", "done", { sections: checked.relevanceBySection.length });
  writer.write({ type: "data-analysis", id: "analysis", data: { phase: "final", analysis: checked, mapReduce } });

  // 3) índice para o chat (Demo 3): o resultado já foi entregue; falhar aqui não o invalida
  if (indexDocument) {
    step(writer, "index", "Indexando para o chat", "running");
    try {
      const { sourceId, chunkCount } = await indexDocument(checked);
      step(writer, "index", "Documento disponível no chat", "done", { chunks: chunkCount });
      writer.write({ type: "data-analysis", id: "analysis", data: { phase: "final", analysis: checked, mapReduce, sourceId, chunkCount } });
    } catch (e) {
      console.error("analyze: indexação falhou:", e instanceof Error ? e.message.split("\n").at(-1) : e);
      step(writer, "index", "Não foi possível indexar para o chat", "error");
    }
  }
  return { checked, mainUsage, mapCalls, mapReduce };
}
