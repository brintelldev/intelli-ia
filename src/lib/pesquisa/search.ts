// Somente servidor. Não é Server Action: as rotas da T-23 cuidarão de autenticação e orçamento LLM.
import { getCached, setCached } from "@/lib/cache";
import { createSearch } from "./search-core";
import { runTavily } from "./tavily-budget";

export { SOURCE_DOMAINS } from "./search-core";
export type { SourceFilter, SearchResult, ExtractResult } from "./search-core";
export { TAVILY_CREDIT_LIMIT } from "./tavily-usage";
export { getMonthlyTavilyCredits } from "./tavily-budget";

export const { search, extract } = createSearch({
  apiKey: () => process.env.TAVILY_API_KEY,
  searxngUrl: () => process.env.SEARXNG_URL || "http://localhost:8080",
  fetch: (...args) => fetch(...args),
  getCached: async (key) => (await getCached(key))?.value ?? null,
  setCached: (key, value) => setCached(key, value, "demo2", 24),
  runTavily,
});
