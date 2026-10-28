/** Teto único: deixa 150 dos 1.000 créditos gratuitos para a apresentação. */
export const TAVILY_CREDIT_LIMIT = 850;
/** Basic search e lote de até três extrações custam no máximo um crédito por chamada. */
export function tavilyUsage(payload: unknown): { tavilyCredits: number; tavilyUsageUnknown: boolean } {
  const credits = (payload as { usage?: { credits?: unknown } } | null)?.usage?.credits;
  const known = typeof credits === "number" && Number.isFinite(credits) && credits >= 0;
  return { tavilyCredits: known ? credits : 1, tavilyUsageUnknown: !known };
}
