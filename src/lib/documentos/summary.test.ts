import { test } from "node:test";
import assert from "node:assert/strict";
import { createUIMessageStream, readUIMessageStream, type UIMessage } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { buildSummaryPrompt, effectiveFormat, lengthRule, maxTokensFor, SummaryBody } from "./summary";
import { runSummary, type SummaryMessage, type SummaryPart } from "./summary-run";
import { DEFAULT_FORMAT, NO_INFO, withMandatory, type Template } from "@/lib/templates";
import { stepsOf } from "@/lib/stream-steps";

const finish = { unified: "stop", raw: undefined } as const;
const usage = { inputTokens: { total: 80, noCache: 80, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 30, text: 30, reasoning: undefined } };
const streamOf = (text: string) =>
  ({
    stream: convertArrayToReadableStream([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "1" },
      ...(text.match(/[\s\S]{1,30}/g) ?? []).map((delta) => ({ type: "text-delta", id: "1", delta })),
      { type: "text-end", id: "1" },
      { type: "finish", finishReason: finish, usage },
    ] as never[]),
  }) as never;

const pages = [{ number: 2, content: "CLÁUSULA QUARTA – DO SLA. Disponibilidade mensal de 99,5%." }];
const base = { pages, keywords: ["SLA"], filename: "c.pdf", summary: { size: "curto", audience: "executivo" } };
const body = (over: object = {}) => SummaryBody.parse({ ...base, ...over });

async function run(model: MockLanguageModelV4, over: Partial<Parameters<typeof runSummary>[0]> = {}) {
  let result: Awaited<ReturnType<typeof runSummary>> | undefined;
  let error: unknown;
  const stream = createUIMessageStream<SummaryMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      try {
        result = await runSummary({ writer, input: body(), evidence: { pages, partial: false }, template: null, model, settings: { temperature: 0.2, maxOutputTokens: 2000 }, ...over });
      } catch (e) {
        error = e;
      }
    },
  });
  let last: UIMessage | undefined;
  for await (const m of readUIMessageStream({ stream })) last = m;
  const part = (last!.parts.find((p) => p.type === "data-summary") as { data: SummaryPart } | undefined)?.data;
  return { result, error, steps: stepsOf(last!), part };
}

test("SummaryBody: exige tamanho e público; templateId e template são opcionais", () => {
  assert.ok(SummaryBody.safeParse(base).success);
  assert.ok(!SummaryBody.safeParse({ ...base, summary: undefined }).success);
  assert.ok(!SummaryBody.safeParse({ ...base, summary: { size: "gigante", audience: "tecnico" } }).success);
  assert.ok(!SummaryBody.safeParse({ ...base, summary: { size: "curto", audience: "infantil" } }).success);
  assert.ok(!SummaryBody.safeParse({ ...base, pages: [{ number: 1, content: "  " }] }).success);
});

test("effectiveFormat: tamanho e público dos controles vencem o modelo de seções; detalhe e citações ficam", () => {
  const t: Template = { sections: [{ title: "A" }], format: { tone: "juridico", length: "longo", citations: false, detail: "detalhado" } };
  assert.deepEqual(effectiveFormat(t, { size: "curto", audience: "executivo" }), { tone: "executivo", length: "curto", citations: false, detail: "detalhado" });
  assert.deepEqual(effectiveFormat(null, { size: "medio", audience: "tecnico" }), { ...DEFAULT_FORMAT, tone: "tecnico", length: "medio" });
});

test("o prompt muda com o público: técnico, executivo e jurídico dão instruções diferentes", () => {
  const p = (audience: "tecnico" | "executivo" | "juridico") =>
    buildSummaryPrompt({ documentBlock: "<doc/>", keywords: ["SLA"], filename: "c.pdf", partial: false, template: null, audience, format: effectiveFormat(null, { size: "curto", audience }) });
  const [t, e, j] = [p("tecnico"), p("executivo"), p("juridico")];
  assert.match(t, /técnica e precisa/);
  assert.match(e, /executiva e direta/);
  assert.match(j, /jurídica formal/);
  assert.notEqual(t, e);
  assert.match(t, /Público-alvo: Escreva para especialistas/);
  assert.match(e, /Público-alvo: Escreva para um gestor sem tempo/);
  assert.match(j, /Público-alvo: Escreva para um parecerista jurídico/);
  assert.match(j, /em tese/);
  assert.match(e, /resumo INTEIRO deve ter no máximo 80 palavras, no total/);
  assert.doesNotMatch(e, /cada seção/i, "no texto corrido o limite vale para o resumo todo");
  assert.match(p("tecnico"), /página no formato \(p\. 3\)/);
});

test("lengthRule e maxTokensFor: limite total no texto corrido, por seção no modelo; teto acompanha o tamanho", () => {
  assert.match(lengthRule("medio", false), /INTEIRO deve ter entre 120 e 250 palavras, no total/);
  assert.match(lengthRule("longo", true), /cada seção deve ter entre 300 e 500 palavras/);
  assert.deepEqual([maxTokensFor("curto", 0), maxTokensFor("medio", 0), maxTokensFor("longo", 0)], [2400, 3200, 4800]);
  assert.equal(maxTokensFor("medio", 4), 8000, "multiplica pelo nº de seções");
  assert.equal(maxTokensFor("longo", 12), 8000, "com teto");
  const withTpl = buildSummaryPrompt({ documentBlock: "<d/>", keywords: [], filename: "c.pdf", partial: false, audience: "tecnico", format: effectiveFormat(null, { size: "curto", audience: "tecnico" }), template: { sections: [{ title: "A" }], format: DEFAULT_FORMAT } });
  assert.match(withTpl, /cada seção deve ter no máximo 80 palavras/);
});

test("resumo em texto corrido: etapas, texto final aparado e uso informado", async () => {
  const model = new MockLanguageModelV4({ doStream: async () => streamOf(JSON.stringify({ summary: "  O SLA exige 99,5% (p. 2).  " })) });
  const r = await run(model);
  assert.equal(r.error, undefined);
  assert.ok(model.doStreamCalls[0].maxOutputTokens! >= 2400, "reserva tokens para raciocínio e objeto final");
  assert.deepEqual(model.doStreamCalls[0].providerOptions?.anthropic, {effort:"low"});
  assert.deepEqual(r.steps.map((s) => [s.id, s.status]), [["prepare", "done"], ["write", "done"]]);
  assert.deepEqual(r.part, { phase: "final", summary: "O SLA exige 99,5% (p. 2).", sections: undefined, partialEvidence: false });
  assert.deepEqual([r.result!.usage.inputTokens, r.result!.usage.outputTokens], [80, 30]);
  const prompt = JSON.stringify(model.doStreamCalls[0].prompt);
  assert.match(prompt, /executiva e direta/);
  assert.match(prompt, /<documento/);
});

test("com modelo de seções: títulos e ordem pedidos, faltante vira aviso, e a Metodologia obrigatória entra", async () => {
  const tpl = withMandatory({ sections: [{ title: "Contexto" }, { title: "Impactos para RH" }], format: DEFAULT_FORMAT }, "demo1_summary");
  const model = new MockLanguageModelV4({ doStream: async () => streamOf(JSON.stringify({ sections: [{ title: "contexto", content: "ctx" }, { title: "Inventada", content: "x" }] })) });
  const r = await run(model, { template: tpl });
  assert.ok(r.part?.phase === "final");
  if (r.part?.phase !== "final") return;
  assert.deepEqual(r.part.sections, [
    { heading: "Contexto", content: "ctx" },
    { heading: "Impactos para RH", content: NO_INFO },
    { heading: "Metodologia", content: NO_INFO },
  ]);
  assert.equal(r.part.summary, undefined);
  assert.match(JSON.stringify(model.doStreamCalls[0].prompt), /EXATAMENTE estas seções/);
});

test("evidência parcial é informada ao modelo; resposta inválida vira erro com a etapa em erro", async () => {
  const ok = new MockLanguageModelV4({ doStream: async () => streamOf(JSON.stringify({ summary: "x" })) });
  const r = await run(ok, { evidence: { pages, partial: true } });
  assert.match(JSON.stringify(ok.doStreamCalls[0].prompt), /apenas as páginas mais relevantes/);
  assert.ok(r.part?.phase === "final" && r.part.partialEvidence);
  const bad = await run(new MockLanguageModelV4({ doStream: async () => streamOf("não é JSON") }));
  assert.ok(bad.error);
  assert.equal(bad.steps.find((s) => s.id === "write")?.status, "error");
});
