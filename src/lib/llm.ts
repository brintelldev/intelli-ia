import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { pickModels, withFallbackModel, type ModelState, type Picked, type RawModel } from "@/lib/llm-core";
import { apiModelName, providerOf, type ModelId } from "@/lib/models";
import { prisma } from "@/lib/prisma";

// Gateway de LLM: cada chamada vai DIRETO ao provedor do modelo (Anthropic, OpenAI ou Google),
// com a chave dele. Quem escolhe o modelo é o banco (LlmConfig, User.modelOverride, AppSetting),
// lido a cada chamada: o Admin troca no painel e a próxima requisição já usa o modelo novo.
// A lógica de escolha e de fallback (sem banco) está em lib/llm-core.ts.

export type ModuleKey = "demo1" | "demo2" | "demo3";

/** Modelo de um ID "provedor:modelo". A chave do provedor é lida do ambiente na hora da chamada. */
export function resolveModel(id: ModelId): RawModel {
  const name = apiModelName(id);
  switch (providerOf(id)) {
    case "anthropic":
      return anthropic(name);
    case "openai":
      return openai(name);
    case "google":
      return google(name);
  }
}

// ── getModel ─────────────────────────────────────────────────────────────────────

export type ModelSelection = {
  /** pronto para streamText/generateText, com o fallback embutido */
  model: LanguageModel;
  modelId: ModelId;
  fallbackModelId: ModelId | null;
  source: Picked["source"];
  /** parâmetros do LlmConfig: `streamText({ model, ...sel.settings })` */
  settings: { temperature: number; maxOutputTokens: number };
  /** lido DEPOIS da chamada, para o track() gravar o modelo que realmente respondeu */
  state: ModelState;
};

/** Provedores desativados pelo Admin (AppSetting.disabledProviders). Lido do banco a cada chamada. */
export async function getDisabledProviders(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: "disabledProviders" } });
  return Array.isArray(row?.value) ? row.value.filter((v): v is string => typeof v === "string") : [];
}

export async function getModel(
  module: ModuleKey,
  opts: { userId?: string | null; overrideModelId?: string | null } = {},
): Promise<ModelSelection> {
  const [configs, user, disabledProviders] = await Promise.all([
    prisma.llmConfig.findMany({ where: { module: { in: [module, "global"] } } }),
    opts.userId
      ? prisma.user.findUnique({ where: { id: opts.userId }, select: { modelOverride: true } })
      : Promise.resolve(null),
    getDisabledProviders(),
  ]);

  const picked = pickModels({
    override: opts.overrideModelId,
    userOverride: user?.modelOverride,
    module: configs.find((c) => c.module === module) ?? null,
    global: configs.find((c) => c.module === "global") ?? null,
    disabledProviders,
  });

  const state: ModelState = { activeModelId: picked.primary, fallbackUsed: false };
  const primary = resolveModel(picked.primary);
  const model = picked.fallback
    ? withFallbackModel(primary, resolveModel(picked.fallback), picked.fallback, state)
    : (primary as LanguageModel);

  return {
    model,
    modelId: picked.primary,
    fallbackModelId: picked.fallback,
    source: picked.source,
    settings: { temperature: picked.config.temperature, maxOutputTokens: picked.config.maxTokens },
    state,
  };
}
