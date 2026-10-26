// Catálogo dos modelos de IA (puro: pode ser importado por componentes de cliente, como o
// ModelSelector, sem puxar os SDKs dos provedores). A lista é conferida contra a API de cada
// provedor por scripts/check-models.ts. IDs no formato "provedor:modelo".

export const PROVIDERS = ["anthropic", "openai", "google"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

// Requisito: GPT, Claude e Gemini, cada um pela chave direta do próprio provedor.
export const AVAILABLE_MODELS = [
  { id: "anthropic:claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic" },
  { id: "anthropic:claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic" },
  { id: "anthropic:claude-haiku-5-5", label: "Claude Haiku 5.5", provider: "anthropic" },
  { id: "google:gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "google" },
  { id: "openai:gpt-6.1-sol", label: "GPT-6.1 Sol", provider: "openai" },
] as const satisfies readonly { id: string; label: string; provider: ProviderId }[];

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export function isModelId(value: unknown): value is ModelId {
  return AVAILABLE_MODELS.some((m) => m.id === value);
}

export function providerOf(id: ModelId): ProviderId {
  return AVAILABLE_MODELS.find((m) => m.id === id)!.provider;
}

/** Nome do modelo na API do provedor: "anthropic:claude-sonnet-5-5" -> "claude-sonnet-5-5". */
export function apiModelName(id: ModelId): string {
  return id.slice(id.indexOf(":") + 1);
}
