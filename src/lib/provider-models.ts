// Leitura das listas de modelos que cada provedor devolve (GET /v1/models etc.). Puro, para o
// scripts/check-models.ts e para os testes. Formatos conferidos na documentação de cada API.

type Json = Record<string, unknown>;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Anthropic: { data: [{ id: "claude-sonnet-5-5", ... }], has_more } */
export function anthropicIds(json: unknown): string[] {
  return asArray((json as Json | null)?.data).flatMap((m) => str((m as Json)?.id) ?? []);
}

/** OpenAI: { data: [{ id: "gpt-6.1-sol", ... }] } */
export function openaiIds(json: unknown): string[] {
  return asArray((json as Json | null)?.data).flatMap((m) => str((m as Json)?.id) ?? []);
}

/** Google: { models: [{ name: "models/gemini-3.8-flash", ... }], nextPageToken } */
export function googleIds(json: unknown): string[] {
  return asArray((json as Json | null)?.models).flatMap((m) => {
    const name = str((m as Json)?.name);
    return name ? [name.replace(/^models\//, "")] : [];
  });
}

/** Família de um modelo (para sugerir parecidos quando o ID não existe): "claude-sonnet-5-5" -> "claude-sonnet". */
export function familyOf(name: string): string {
  return name.split("-").slice(0, 2).join("-");
}

export function similarIds(all: readonly string[], name: string, limit = 5): string[] {
  const family = familyOf(name);
  return all.filter((id) => id.startsWith(family)).sort().slice(0, limit);
}
