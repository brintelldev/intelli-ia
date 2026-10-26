import { isModelId, type ModelId } from "@/lib/models";

// Preço em USD por 1 milhão de tokens. O custo é calculado na hora do uso (track(), T-06) e
// GRAVADO no evento: mudar esta tabela depois não reescreve o histórico.
//
// Fontes (conferidas em 26/10/2026; reconferir antes da demo, os preços mudam):
//   Anthropic  https://platform.claude.com/docs/en/about-claude/pricing
//   OpenAI     https://developers.openai.com/api/docs/pricing
//   Google     https://ai.google.dev/gemini-api/docs/pricing
//
// Cada modelo tem uma lista por data de vigência (`from`, inclusive, em UTC), porque o preço do
// Gemini 3.8 Flash dobra em 01/01/2027. `long` é a faixa de prompt longo, quando o provedor
// cobra diferente acima de um certo tamanho de entrada.
// Fora do cálculo (v1): cache de prompt, batch e processamento regional (+10%): não usamos.
type Rate = { inputPerM: number; outputPerM: number };
type Tier = Rate & { from: string; long?: Rate & { overInputTokens: number } };

const SINCE = "2000-01-01";

export const PRICING: Record<ModelId, readonly Tier[]> = {
  "anthropic:claude-sonnet-5-5": [{ from: SINCE, inputPerM: 2, outputPerM: 10 }],
  "anthropic:claude-opus-5-5": [{ from: SINCE, inputPerM: 4, outputPerM: 20 }],
  "anthropic:claude-haiku-5-5": [
    { from: SINCE, inputPerM: 0.1, outputPerM: 0.5, long: { overInputTokens: 100_000, inputPerM: 0.5, outputPerM: 2.5 } },
  ],
  "google:gemini-3.8-flash": [
    { from: SINCE, inputPerM: 0.75, outputPerM: 3.75 },
    { from: "2027-01-01", inputPerM: 1.5, outputPerM: 7.5 },
  ],
  // Prompts acima de 272 mil tokens custam mais, mas o OpenAI não publica o valor na página: ignorado
  // (nossos documentos ficam muito abaixo disso).
  "openai:gpt-6.1-sol": [{ from: SINCE, inputPerM: 2, outputPerM: 10 }],
};

function day(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Tarifa vigente do modelo na data `at`, ou null se o modelo não tiver preço nessa data. */
export function rateFor(modelId: string, at: Date = new Date()): Tier | null {
  if (!isModelId(modelId)) return null;
  const d = day(at);
  const valid = PRICING[modelId].filter((t) => t.from <= d);
  return valid.length ? valid.reduce((a, b) => (a.from >= b.from ? a : b)) : null;
}

/** Custo em USD. Modelo sem preço lança erro: custo 0 silencioso esconderia gasto real. */
export function costUsd(modelId: string, inputTokens: number, outputTokens: number, at: Date = new Date()): number {
  if (![inputTokens, outputTokens].every((n) => Number.isFinite(n) && n >= 0)) {
    throw new Error(`Tokens inválidos para o cálculo de custo: ${inputTokens} / ${outputTokens}`);
  }
  const tier = rateFor(modelId, at);
  if (!tier) throw new Error(`Sem preço para o modelo "${modelId}" em lib/pricing.ts`);
  const rate = tier.long && inputTokens > tier.long.overInputTokens ? tier.long : tier;
  return (inputTokens * rate.inputPerM + outputTokens * rate.outputPerM) / 1_000_000;
}
