import { Output, streamText, type DeepPartial, type LanguageModel, type UIMessage, type UIMessageStreamWriter } from "ai";
import { step, type StepData } from "@/lib/stream-steps";
import { withUntrustedRule, wrapUntrusted } from "@/lib/untrusted";
import { pagesToText } from "./analysis";
import { analysisBlockText, BRIEF_SYSTEM, briefToSections, BriefSchema, buildBriefPrompt, checkBrief, methodologyFacts, type BriefInput, type CheckedBrief, type Evidence, type RawBrief } from "./brief";
import { pumpPartials } from "./stream-object";

export type BriefPart =
  | { phase: "partial"; brief: DeepPartial<RawBrief> }
  | { phase: "final"; brief: CheckedBrief; sections: { heading: string; content: string }[]; partialEvidence: boolean };
export type BriefMessage = UIMessage<never, { step: StepData; brief: BriefPart }>;

type Usage = { inputTokens?: number | undefined; outputTokens?: number | undefined };
const PARTIAL_EVERY_MS = 200;
const MIN_OUTPUT_TOKENS = 6000;

/**
 * Redige o parecer em streaming (`data-brief`, parcial e depois final já conferido) com etapas de progresso. Sem banco:
 * o modelo entra por parâmetro. `modelLabel` é lido DEPOIS da chamada, porque o fallback pode ter respondido no lugar.
 */
export async function runBrief(opts: {
  writer: Pick<UIMessageStreamWriter<BriefMessage>, "write">;
  input: BriefInput;
  evidence: Evidence;
  model: LanguageModel;
  settings: { temperature: number; maxOutputTokens: number };
  modelLabel: () => string;
  date: string;
  signal?: AbortSignal;
}): Promise<{ brief: CheckedBrief; sections: { heading: string; content: string }[]; usage: Usage }> {
  const { writer, input, evidence } = opts;

  step(writer, "prepare", evidence.partial ? "Selecionando as páginas mais relevantes" : "Preparando o documento", "running");
  step(writer, "prepare", evidence.partial ? "Páginas selecionadas" : "Documento preparado", "done", { pages: evidence.pages.length, total: input.pages.length });

  step(writer, "write", "Redigindo o parecer", "running");
  const result = streamText({
    model: opts.model,
    ...opts.settings,
    maxOutputTokens: Math.max(opts.settings.maxOutputTokens, MIN_OUTPUT_TOKENS),
    abortSignal: opts.signal,
    system: withUntrustedRule(BRIEF_SYSTEM),
    prompt: buildBriefPrompt({
      documentBlock: wrapUntrusted(pagesToText(evidence.pages), { id: 1, source: input.filename }),
      analysisBlock: input.analysis ? wrapUntrusted(analysisBlockText(input.analysis), { id: 2, source: "análise prévia" }) : undefined,
      keywords: input.keywords,
      filename: input.filename,
      partial: evidence.partial,
    }),
    output: Output.object({ schema: BriefSchema }),
  });
  await pumpPartials(result.partialOutputStream, PARTIAL_EVERY_MS, (partial) =>
    writer.write({ type: "data-brief", id: "brief", data: { phase: "partial", brief: partial as DeepPartial<RawBrief> } }),
  );
  let raw: RawBrief;
  try {
    raw = (await result.output) as RawBrief;
  } catch (e) {
    step(writer, "write", "A redação do parecer falhou", "error");
    throw e;
  }
  const usage = await result.totalUsage;
  step(writer, "write", "Parecer redigido", "done");

  step(writer, "verify", "Conferindo páginas e trechos", "running");
  const brief = checkBrief(raw, input.pages, input.keywords);
  const sections = briefToSections(
    brief,
    methodologyFacts({ filename: input.filename, pages: input.pages.length, keywords: input.keywords, modelLabel: opts.modelLabel(), partial: evidence.partial, date: opts.date }),
  );
  const verified = [...brief.achadosPrincipais, ...brief.analiseRiscos].filter((x) => x.pageRef !== null);
  step(writer, "verify", "Referências conferidas", "done", { verified: verified.filter((x) => x.verified).length, total: verified.length });
  writer.write({ type: "data-brief", id: "brief", data: { phase: "final", brief, sections, partialEvidence: evidence.partial } });
  return { brief, sections, usage };
}
