import { APICallError, LoadAPIKeyError, wrapLanguageModel, type LanguageModel } from "ai";
import { HttpError } from "@/lib/http-error";
import { AVAILABLE_MODELS, isModelId, providerOf, type ModelId } from "@/lib/models";

// Lógica pura do gateway de LLM (sem banco nem chaves): escolha do modelo e fallback. Fica separada
// de lib/llm.ts para os testes não precisarem do client do Prisma.

export type RawModel = Parameters<typeof wrapLanguageModel>[0]["model"];

// ── escolha do modelo (pura, testável) ──────────────────────────────────────────────

export type ConfigRow = {
  primaryModel: string;
  fallbackModel: string;
  temperature: number;
  maxTokens: number;
};

export type PickInput = {
  /** modelId vindo da requisição (seletor de modelo da tela). Inválido ou desativado = erro 400. */
  override?: string | null;
  /** User.modelOverride do usuário logado. Se estiver obsoleto, é ignorado em silêncio. */
  userOverride?: string | null;
  module: ConfigRow | null;
  global: ConfigRow | null;
  disabledProviders: readonly string[];
  unconfiguredProviders?: readonly string[];
  /**
   * Tarefa auxiliar e barata (sugerir palavras-chave): usa o modelo de FALLBACK configurado como principal
   * e o de nome principal como reserva. Ignora o `userOverride`, que é a escolha da pessoa para o trabalho
   * principal, não para esta chamada. Um `override` explícito continua valendo.
   */
  preferFallback?: boolean;
};

export type Picked = {
  primary: ModelId;
  fallback: ModelId | null;
  config: ConfigRow;
  source: "request" | "user" | "module" | "global" | "any";
};

/**
 * Ordem: modelId da requisição → modelOverride do usuário → LlmConfig do módulo → LlmConfig global.
 * Modelo de provedor desativado (AppSetting.disabledProviders) é pulado. O fallback vem da mesma
 * configuração, deve ser outro modelo e também de um provedor ativo.
 */
export function pickModels(i: PickInput): Picked {
  const config = i.module ?? i.global;
  if (!config) throw new Error("LlmConfig ausente (nem do módulo nem a global): rode o seed.");

  const enabled = (id: unknown): id is ModelId => isModelId(id) && !i.disabledProviders.includes(providerOf(id)) && !i.unconfiguredProviders?.includes(providerOf(id));

  if (i.override) {
    if (!isModelId(i.override)) throw new HttpError(400, "Modelo de IA inválido.");
    if (i.unconfiguredProviders?.includes(providerOf(i.override))) throw new HttpError(503,"O provedor desse modelo está sem chave configurada. Fale com o administrador.");
    if (!enabled(i.override)) throw new HttpError(400, "O provedor desse modelo está desativado.");
  }

  const candidates: [Picked["source"], string | null | undefined][] = i.preferFallback
    ? [
        ["request", i.override],
        ["module", i.module?.fallbackModel],
        ["global", i.global?.fallbackModel],
        ["module", i.module?.primaryModel],
        ["global", i.global?.primaryModel],
      ]
    : [
        ["request", i.override],
        ["user", i.userOverride],
        ["module", i.module?.primaryModel],
        ["global", i.global?.primaryModel],
        // configuração com o primário desativado: o fallback dela ainda pode servir
        ["module", i.module?.fallbackModel],
        ["global", i.global?.fallbackModel],
      ];
  let primary: ModelId | undefined;
  let source: Picked["source"] = "any";
  for (const [src, id] of candidates) {
    if (enabled(id)) {
      primary = id;
      source = src;
      break;
    }
  }
  if (!primary) {
    // nada configurado está utilizável: qualquer modelo de provedor ativo é melhor que falhar
    primary = AVAILABLE_MODELS.find((m) => enabled(m.id))?.id;
  }
  if (!primary) throw new HttpError(503, "Nenhum provedor de IA está ativo. Fale com o administrador.");

  const reserve = i.preferFallback
    ? [i.module?.primaryModel, i.global?.primaryModel]
    : [i.module?.fallbackModel, i.global?.fallbackModel];
  const fallback = reserve.find((id): id is ModelId => enabled(id) && id !== primary) ?? null;

  return { primary, fallback, config, source };
}

// ── fallback ─────────────────────────────────────────────────────────────────────

export type ModelState = {
  /** modelo que de fato respondeu: use este (e não o primário) para calcular o custo */
  activeModelId: ModelId;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

/** Falha do provedor (não do pedido): limite, indisponibilidade, rede ou chave ausente. */
export function shouldFallback(e: unknown): boolean {
  if (e instanceof Error && e.name === "TimeoutError") return true;
  if (e instanceof Error && e.name === "AbortError") return false; // cancelamento do usuário
  if (LoadAPIKeyError.isInstance(e)) return true; // um provedor sem chave não pode derrubar a demo
  if (APICallError.isInstance(e)) {
    const s = e.statusCode;
    if (s === undefined) return e.isRetryable;
    return s === 429 || s === 408 || s >= 500; // 4xx do pedido (400, 401, 403, 404) não se resolve trocando
  }
  return e instanceof TypeError; // fetch failed
}

function describe(e: unknown): string {
  if (APICallError.isInstance(e)) return e.statusCode ? `HTTP ${e.statusCode}` : "falha de rede";
  return e instanceof Error ? e.name : "erro";
}

/**
 * Envolve o modelo primário: se a CHAMADA falhar (429/5xx/rede/sem chave), tenta o de fallback uma
 * vez, no mesmo pedido. Vale para geração normal e streaming. Não há como recuperar um stream que
 * cai no meio da resposta (já saiu texto para o usuário): nesse caso o erro segue normalmente.
 */
export function withFallbackModel(primary: RawModel, fallback: RawModel, fallbackId: ModelId, state: ModelState): LanguageModel {
  const fb = wrapLanguageModel({ model: fallback, middleware: [] });
  const switchTo = (e: unknown) => {
    if (!shouldFallback(e)) throw e;
    state.activeModelId = fallbackId;
    state.fallbackUsed = true;
    state.fallbackReason = describe(e);
  };
  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (e) {
          switchTo(e);
          return fb.doGenerate(params);
        }
      },
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (e) {
          switchTo(e);
          return fb.doStream(params);
        }
      },
    },
  });
}
