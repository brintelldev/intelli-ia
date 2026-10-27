import { Output, streamText, type LanguageModel, type UIMessage, type UIMessageStreamWriter } from "ai";
import { step, type StepData } from "@/lib/stream-steps";
import { buildSectionsSchema, normalizeSections, type Template } from "@/lib/templates";
import { withUntrustedRule, wrapUntrusted } from "@/lib/untrusted";
import { pagesToText } from "./analysis";
import { analysisBlockText, type Evidence } from "./brief";
import { pumpPartials } from "./stream-object";
import { buildSummaryPrompt, effectiveFormat, maxTokensFor, PlainSummarySchema, SUMMARY_SYSTEM, type SummaryInput } from "./summary";

export type SummaryPart =
  | { phase: "partial"; summary?: string; sections?: { title?: string; content?: string }[] }
  | { phase: "final"; summary?: string; sections?: { heading: string; content: string }[]; partialEvidence: boolean };
export type SummaryMessage = UIMessage<never, { step: StepData; summary: SummaryPart }>;

type Usage = { inputTokens?: number | undefined; outputTokens?: number | undefined };
const PARTIAL_EVERY_MS = 150;

/** Refaz só o resumo (texto corrido ou seções do modelo), em streaming. Sem banco: o modelo entra por parâmetro. */
export async function runSummary(opts: {
  writer: Pick<UIMessageStreamWriter<SummaryMessage>, "write">;
  input: SummaryInput;
  evidence: Evidence;
  template: Template | null;
  model: LanguageModel;
  settings: { temperature: number; maxOutputTokens: number };
  signal?: AbortSignal;
}): Promise<{ usage: Usage; summary?: string; sections?: { heading: string; content: string }[] }> {
  const { writer, input, evidence, template } = opts;
  const format = effectiveFormat(template, input.summary);

  step(writer, "prepare", evidence.partial ? "Selecionando as páginas mais relevantes" : "Preparando o documento", "running");
  step(writer, "prepare", evidence.partial ? "Páginas selecionadas" : "Documento preparado", "done", { pages: evidence.pages.length, total: input.pages.length });

  step(writer, "write", "Redigindo o resumo", "running");
  const result = streamText({
    model: opts.model,
    ...opts.settings,
    // o teto acompanha o tamanho pedido (e o nº de seções); o LlmConfig.maxTokens não vale aqui
    maxOutputTokens: maxTokensFor(input.summary.size, template?.sections.length ?? 0),
    abortSignal: opts.signal,
    system: withUntrustedRule(SUMMARY_SYSTEM),
    prompt: buildSummaryPrompt({
      documentBlock: wrapUntrusted(pagesToText(evidence.pages), { id: 1, source: input.filename }),
      analysisBlock: input.analysis ? wrapUntrusted(analysisBlockText(input.analysis), { id: 2, source: "análise prévia" }) : undefined,
      keywords: input.keywords,
      filename: input.filename,
      partial: evidence.partial,
      format,
      template,
      audience: input.summary.audience,
    }),
    // os dois schemas têm formas diferentes e o tipo da saída é resolvido depois (`out`, abaixo)
    output: Output.object({ schema: (template ? buildSectionsSchema(template) : PlainSummarySchema) as typeof PlainSummarySchema }),
  });

  await pumpPartials(result.partialOutputStream, PARTIAL_EVERY_MS, (p) => {
    const part = p as { summary?: string; sections?: { title?: string; content?: string }[] };
    writer.write({ type: "data-summary", id: "summary", data: { phase: "partial", summary: part.summary, sections: part.sections } });
  });
  let out: { summary?: string; sections?: { title: string; content: string }[] };
  try {
    out = (await result.output) as typeof out;
  } catch (e) {
    step(writer, "write", "A redação do resumo falhou", "error");
    throw e;
  }
  const usage = await result.totalUsage;
  step(writer, "write", "Resumo redigido", "done");

  const sections = template ? normalizeSections(template, out.sections ?? []) : undefined;
  const summary = template ? undefined : (out.summary ?? "").trim();
  writer.write({ type: "data-summary", id: "summary", data: { phase: "final", summary, sections, partialEvidence: evidence.partial } });
  return { usage, summary, sections };
}
