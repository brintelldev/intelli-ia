import assert from "node:assert/strict";
import { test } from "node:test";
import { APICallError, generateText, LoadAPIKeyError, streamText } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { HttpError } from "./http-error";
import { pickModels, shouldFallback, withFallbackModel, type ConfigRow, type ModelState } from "./llm-core";

// ── pickModels ──────────────────────────────────────────────────────────────────────
const cfg = (primaryModel: string, fallbackModel: string): ConfigRow => ({
  primaryModel,
  fallbackModel,
  temperature: 0.7,
  maxTokens: 4096,
});
const SONNET = "anthropic:claude-sonnet-5-5";
const OPUS = "anthropic:claude-opus-5-5";
const GEMINI = "google:gemini-3.8-flash";
const GPT = "openai:gpt-6.1-sol";

const base = { module: cfg(SONNET, GEMINI), global: cfg(OPUS, GPT), disabledProviders: [] as string[] };

test("precedência: requisição > usuário > módulo > global", () => {
  assert.deepEqual(pick({ override: GPT, userOverride: OPUS }), { primary: GPT, source: "request" });
  assert.deepEqual(pick({ userOverride: OPUS }), { primary: OPUS, source: "user" });
  assert.deepEqual(pick({}), { primary: SONNET, source: "module" });
  assert.deepEqual(pick({ module: null }), { primary: OPUS, source: "global" });
});
function pick(over: Partial<Parameters<typeof pickModels>[0]>) {
  const r = pickModels({ ...base, ...over });
  return { primary: r.primary, source: r.source };
}

test("fallback vem da mesma configuração e nunca é o próprio primário", () => {
  assert.equal(pickModels(base).fallback, GEMINI);
  assert.equal(pickModels({ ...base, override: GEMINI }).fallback, GPT); // módulo usa Gemini de fallback: igual ao primário, cai na global
  assert.equal(pickModels({ ...base, module: cfg(SONNET, SONNET), global: cfg(SONNET, SONNET) }).fallback, null);
});

test("provedor desativado é pulado (primário e fallback)", () => {
  const r = pickModels({ ...base, disabledProviders: ["anthropic"] });
  // primário do módulo (Sonnet) e da global (Opus) são Anthropic: usa o fallback do MÓDULO (Gemini);
  // o fallback resultante é então o da global (GPT), por ser outro modelo de provedor ativo.
  assert.equal(r.primary, GEMINI);
  assert.equal(r.fallback, GPT);
  const only = pickModels({ ...base, disabledProviders: ["google", "openai"] });
  assert.equal(only.primary, SONNET);
  assert.equal(only.fallback, null, "fallbacks são Google e OpenAI, ambos desativados");
});

test("usuário com modelOverride obsoleto (desconhecido ou provedor desativado) é ignorado, sem erro", () => {
  assert.equal(pickModels({ ...base, userOverride: "anthropic/claude-sonnet-5.5" }).primary, SONNET);
  assert.equal(pickModels({ ...base, userOverride: GPT, disabledProviders: ["openai"] }).primary, SONNET);
});

test("modelId da requisição inválido ou de provedor desativado é erro 400, não troca silenciosa", () => {
  assert.throws(() => pickModels({ ...base, override: "gpt-4" }), (e) => e instanceof HttpError && e.status === 400);
  assert.throws(
    () => pickModels({ ...base, override: GPT, disabledProviders: ["openai"] }),
    (e) => e instanceof HttpError && e.status === 400,
  );
});

test("sem configuração de módulo usa a global; sem nenhuma, erro claro", () => {
  assert.equal(pickModels({ ...base, module: null }).config.primaryModel, OPUS);
  assert.throws(() => pickModels({ ...base, module: null, global: null }), /rode o seed/);
});

test("tudo desativado: 503; config inválida mas um provedor ativo: usa o catálogo", () => {
  assert.throws(
    () => pickModels({ ...base, disabledProviders: ["anthropic", "openai", "google"] }),
    (e) => e instanceof HttpError && e.status === 503,
  );
  const r = pickModels({ module: cfg("x:y", "z:w"), global: null, disabledProviders: ["anthropic"] });
  assert.equal(r.source, "any");
  assert.ok(["google:gemini-3.8-flash", "openai:gpt-6.1-sol"].includes(r.primary));
});

// ── shouldFallback ──────────────────────────────────────────────────────────────────
const apiError = (statusCode?: number, isRetryable = false) =>
  new APICallError({ message: "x", url: "https://api.example.com", requestBodyValues: {}, statusCode, isRetryable });

test("shouldFallback: falha do provedor sim; erro do pedido ou cancelamento não", () => {
  for (const s of [429, 408, 500, 502, 503, 529]) assert.equal(shouldFallback(apiError(s)), true, String(s));
  for (const s of [400, 401, 403, 404, 422]) assert.equal(shouldFallback(apiError(s)), false, String(s));
  assert.equal(shouldFallback(apiError(undefined, true)), true, "rede, marcada como retentável");
  assert.equal(shouldFallback(apiError(undefined, false)), false);
  assert.equal(shouldFallback(new TypeError("fetch failed")), true);
  assert.equal(shouldFallback(new LoadAPIKeyError({ message: "sem chave" })), true);
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(shouldFallback(abort), false);
  assert.equal(shouldFallback(new Error("bug nosso")), false);
});

// ── fallback com modelos simulados (geração e streaming) ───────────────────────────────────
const usage = {
  inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};
const finish = { unified: "stop", raw: undefined } as const;
const generated = (text: string) =>
  ({ content: [{ type: "text", text }], finishReason: finish, usage, warnings: [] }) as never;
const streamed = (text: string) =>
  ({
    stream: convertArrayToReadableStream([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "1" },
      { type: "text-delta", id: "1", delta: text },
      { type: "text-end", id: "1" },
      { type: "finish", finishReason: finish, usage },
    ] as never[]),
  }) as never;

const newState = (): ModelState => ({ activeModelId: SONNET, fallbackUsed: false });
const ok = (text: string) => new MockLanguageModelV4({ doGenerate: async () => generated(text), doStream: async () => streamed(text) });
const failing = (e: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      throw e;
    },
    doStream: async () => {
      throw e;
    },
  });

test("fallback: primário com 429 -> responde o fallback, e o estado diz qual respondeu", async () => {
  const state = newState();
  const fallback = ok("resposta do fallback");
  const model = withFallbackModel(failing(apiError(429, true)), fallback, GEMINI, state);
  const { text } = await generateText({ model, prompt: "oi", maxRetries: 0 });
  assert.equal(text, "resposta do fallback");
  assert.deepEqual(state, { activeModelId: GEMINI, fallbackUsed: true, fallbackReason: "HTTP 429" });
  assert.equal(fallback.doGenerateCalls.length, 1);
});

test("fallback também vale para streaming (503 no início da chamada)", async () => {
  const state = newState();
  const model = withFallbackModel(failing(apiError(503, true)), ok("stream do fallback"), GEMINI, state);
  const result = streamText({ model, prompt: "oi", maxRetries: 0 });
  assert.equal(await result.text, "stream do fallback");
  assert.equal(state.fallbackUsed, true);
  assert.equal(state.activeModelId, GEMINI);
});

test("sem falha: o fallback nem é chamado e o estado não muda", async () => {
  const state = newState();
  const fallback = ok("não deveria aparecer");
  const model = withFallbackModel(ok("resposta do primário"), fallback, GEMINI, state);
  assert.equal((await generateText({ model, prompt: "oi" })).text, "resposta do primário");
  assert.deepEqual(state, { activeModelId: SONNET, fallbackUsed: false });
  assert.equal(fallback.doGenerateCalls.length, 0);
});

test("erro do pedido (400) NÃO aciona o fallback: o erro volta ao chamador", async () => {
  const state = newState();
  const fallback = ok("não deveria aparecer");
  const model = withFallbackModel(failing(apiError(400)), fallback, GEMINI, state);
  await assert.rejects(generateText({ model, prompt: "oi", maxRetries: 0 }), (e) => APICallError.isInstance(e) && e.statusCode === 400);
  assert.equal(state.fallbackUsed, false);
  assert.equal(fallback.doGenerateCalls.length, 0);
});

test("se o fallback também falhar, o erro do fallback é o que sobe", async () => {
  const state = newState();
  const model = withFallbackModel(failing(apiError(429, true)), failing(apiError(503, true)), GEMINI, state);
  await assert.rejects(generateText({ model, prompt: "oi", maxRetries: 0 }), (e) => APICallError.isInstance(e) && e.statusCode === 503);
});
