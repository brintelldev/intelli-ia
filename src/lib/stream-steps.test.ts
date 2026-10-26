import { test } from "node:test";
import assert from "node:assert/strict";
import { createUIMessageStream, readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { step, stepsOf, streamError, STREAM_ERROR_MESSAGE, type StepMessage } from "./stream-steps";
import { HttpError } from "./http-error";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function threeSteps(opts: { fail?: boolean } = {}) {
  return createUIMessageStream<StepMessage>({
    onError: streamError,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      step(writer, "a", "Interpretando", "running");
      await wait(40);
      step(writer, "a", "Interpretado", "done");
      step(writer, "b", "Buscando", "running");
      await wait(60);
      step(writer, "b", "Fontes encontradas", "done", { sources: 3, cacheHit: false });
      step(writer, "c", "Sintetizando", "running");
      await wait(20);
      if (opts.fail) {
        step(writer, "c", "Falhou", "error");
        throw new Error("detalhe interno: SELECT * FROM segredo");
      }
      step(writer, "c", "Pronto", "done");
    },
  });
}

test("3 etapas chegam em sequência no cliente e cada id aparece uma só vez (reconciliação)", async () => {
  const seen: string[] = [];
  let last: UIMessage | undefined;
  for await (const msg of readUIMessageStream({ stream: threeSteps() })) {
    last = msg;
    seen.push(stepsOf(msg).map((s) => `${s.id}:${s.status}`).join(","));
  }
  const distinct = [...new Set(seen)].filter(Boolean); // o 1º estado, vazio, é o chunk "start"
  assert.deepEqual(distinct, ["a:running", "a:done", "a:done,b:running", "a:done,b:done", "a:done,b:done,c:running", "a:done,b:done,c:done"]);
  assert.equal(last!.parts.filter((p) => p.type === "data-step").length, 3, "uma parte por etapa, não uma por atualização");
});

test("ms: 0 enquanto roda; ao concluir, o tempo desde o 'running' da mesma etapa", async () => {
  let last: UIMessage | undefined;
  for await (const m of readUIMessageStream({ stream: threeSteps() })) last = m;
  const [a, b, c] = stepsOf(last!);
  assert.ok(a.ms >= 35 && a.ms < 500, `a=${a.ms}`);
  assert.ok(b.ms >= 55 && b.ms < 500, `b=${b.ms}`);
  assert.ok(c.ms >= 15 && c.ms < 500, `c=${c.ms}`);
  // chunks brutos: o 'running' sempre sai com ms 0
  const raw: UIMessageChunk[] = [];
  const reader = threeSteps().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw.push(value);
  }
  const running = raw.filter((c) => c.type === "data-step").map((c) => (c as unknown as { data: { status: string; ms: number } }).data).filter((d) => d.status === "running");
  assert.equal(running.length, 3);
  assert.ok(running.every((d) => d.ms === 0));
});

test("extra viaja junto, mas não sobrescreve id, label, status nem ms", async () => {
  let last: UIMessage | undefined;
  for await (const m of readUIMessageStream({ stream: threeSteps() })) last = m;
  const b = stepsOf(last!)[1];
  assert.equal(b.sources, 3);
  assert.equal(b.cacheHit, false);

  const stream = createUIMessageStream<StepMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      step(writer, "x", "Rótulo", "done", { status: "error", id: "outro", label: "falso", ms: 999 });
    },
  });
  let m2: UIMessage | undefined;
  for await (const m of readUIMessageStream({ stream })) m2 = m;
  assert.deepEqual(stepsOf(m2!)[0], { id: "x", label: "Rótulo", status: "done", ms: 0 });
});

test("etapa 'done' sem 'running' antes tem ms 0 (não inventa tempo)", async () => {
  const stream = createUIMessageStream<StepMessage>({ execute: ({ writer }) => { writer.write({ type: "start" }); step(writer, "z", "Direto", "done"); } });
  let m: UIMessage | undefined;
  for await (const x of readUIMessageStream({ stream })) m = x;
  assert.equal(stepsOf(m!)[0].ms, 0);
});

test("writers diferentes não misturam o relógio das etapas com o mesmo id", async () => {
  const run = async (delay: number) => {
    let last: UIMessage | undefined;
    const stream = createUIMessageStream<StepMessage>({
      execute: async ({ writer }) => {
        writer.write({ type: "start" });
        step(writer, "same", "x", "running");
        await wait(delay);
        step(writer, "same", "x", "done");
      },
    });
    for await (const m of readUIMessageStream({ stream })) last = m;
    return stepsOf(last!)[0].ms;
  };
  const [slow, fast] = await Promise.all([run(120), run(10)]);
  assert.ok(slow >= 110 && fast < 100, `slow=${slow} fast=${fast}`);
});

test("erro no meio: a etapa aparece como 'error' e o cliente só recebe a mensagem genérica", async () => {
  const chunks: UIMessageChunk[] = [];
  const reader = threeSteps({ fail: true }).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const err = chunks.find((c) => c.type === "error") as { errorText: string } | undefined;
  assert.equal(err?.errorText, STREAM_ERROR_MESSAGE);
  assert.ok(!JSON.stringify(chunks).includes("segredo"), "o detalhe interno não vai para o navegador");
  const steps = chunks.filter((c) => c.type === "data-step").map((c) => (c as unknown as { data: { id: string; status: string } }).data);
  assert.deepEqual(steps.at(-1), { ...steps.at(-1)!, id: "c", status: "error" });
});

test("streamError: HttpError (mensagem feita para a pessoa) passa; o resto vira texto genérico", () => {
  assert.equal(streamError(new HttpError(429, "Limite diário de uso atingido.", "budget_user")), "Limite diário de uso atingido.");
  assert.equal(streamError(new Error("ECONNREFUSED 10.0.0.5:5432")), STREAM_ERROR_MESSAGE);
  assert.equal(streamError("string solta"), STREAM_ERROR_MESSAGE);
  assert.equal(streamError(null), STREAM_ERROR_MESSAGE);
});

test("stepsOf ignora partes que não são etapa", () => {
  const parts = [{ type: "text", text: "oi" }, { type: "data-step", id: "a", data: { id: "a", label: "A", status: "done", ms: 5 } }, { type: "data-outro", data: 1 }] as unknown as UIMessage["parts"];
  assert.deepEqual(stepsOf({ parts }).map((s) => s.id), ["a"]);
});

// Compilação: um writer de mensagem com MAIS data parts também aceita `step` (módulos estendem o tipo).
type Wider = UIMessage<never, { step: import("./stream-steps").StepData; sources: { n: number } }>;
test("step aceita writer de tipo mais amplo (checado em tempo de compilação)", () => {
  const stream = createUIMessageStream<Wider>({ execute: ({ writer }) => { step(writer, "w", "ok", "done"); writer.write({ type: "data-sources", data: { n: 1 } }); } });
  assert.ok(stream);
});
