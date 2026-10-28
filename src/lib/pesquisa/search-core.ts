import { createHash } from "node:crypto";

export type SourceFilter = "all" | "gov" | "academic" | "all_filtered";
export const SOURCE_DOMAINS: Record<SourceFilter, string[]> = {
  all: [],
  gov: ["gov.br", "leg.br", "jus.br", "stf.jus.br", "stj.jus.br", "tst.jus.br", "cnj.jus.br", "in.gov.br"],
  academic: ["scielo.br", "periodicos.capes.gov.br", "bdtd.ibict.br"],
  all_filtered: ["gov.br", "leg.br", "jus.br", "scielo.br", "periodicos.capes.gov.br"],
};
export type SearchResult = {
  url: string; title: string; snippet: string; score: number;
  type: "gov" | "academic" | "web";
  origin: "tavily" | "searxng" | "lexml" | "openalex" | "senado";
  category?: string; topics?: string[]; relevance?: number; summary?: string;
};
export type ExtractResult = { url: string; content: string };
export type TavilyOperation = "search" | "extract";
export type SearchDependencies = {
  apiKey: () => string | undefined;
  searxngUrl: () => string;
  fetch: typeof fetch;
  getCached: (key: string) => Promise<unknown | null>;
  setCached: (key: string, value: unknown) => Promise<void>;
  /** null = cota/banco indisponível; a função request só roda quando houver reserva. */
  runTavily: (operation: TavilyOperation, request: () => Promise<unknown>) => Promise<unknown | null>;
};
const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_EXTRACT = 3;
const record = (v: unknown): Record<string, unknown> => typeof v === "object" && v !== null ? v as Record<string, unknown> : {};
const text = (v: unknown): string => typeof v === "string" ? v : "";
// Mesmo formato de lib/cache.cacheKey, sem importar o client do banco nos testes puros.
const keyFor = (parts: string[]) => createHash("sha256").update(JSON.stringify(["web-search-v1", ...parts])).digest("hex");
function httpUrl(value: unknown): URL | null {
  try {
    const url = new URL(text(value));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}
function matches(host: string, domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}
function normalize(payload: unknown, filter: SourceFilter, origin: "tavily" | "searxng"): SearchResult[] {
  const rows = record(payload).results;
  if (!Array.isArray(rows)) throw new Error("Resposta de busca inválida.");
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const item of rows) {
    const r = record(item), url = httpUrl(r.url);
    if (!url || (SOURCE_DOMAINS[filter].length && !matches(url.hostname, SOURCE_DOMAINS[filter]))) continue;
    url.hash = "";
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const rawScore = typeof r.score === "number" && Number.isFinite(r.score) ? Math.max(0, r.score) : 0;
    results.push({ url: url.href, title: text(r.title), snippet: text(r.content), score: rawScore,
      type: matches(url.hostname, SOURCE_DOMAINS.gov) ? "gov" : matches(url.hostname, SOURCE_DOMAINS.academic) ? "academic" : "web", origin });
  }
  // O score do SearXNG é uma soma por engine, sem teto. Normalizar mantém a ordem;
  // não representa probabilidade nem é comparável entre consultas/provedores.
  const max = Math.max(1, ...results.map((r) => r.score));
  for (const r of results) r.score = origin === "searxng" ? r.score / max : Math.min(1, r.score);
  return results.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

/** Adaptadores isolados de rede/banco: testes não carregam chaves nem fazem chamadas externas. */
export function createSearch(deps: SearchDependencies) {
  async function read<T>(key: string): Promise<T | null> {
    try { return await deps.getCached(key) as T | null; } catch { return null; }
  }
  async function write(key: string, value: unknown) {
    try { await deps.setCached(key, value); } catch { /* cache é opcional */ }
  }
  async function tavily(operation: TavilyOperation, body: Record<string, unknown>, signal?:AbortSignal) {
    const apiKey = deps.apiKey()?.trim();
    if (!apiKey) return null;
    return deps.runTavily(operation, async () => {
      const response = await deps.fetch(`https://api.tavily.com/${operation}`, {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, include_usage: true }), signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS),...(signal?[signal]:[])]), redirect: "error",
      });
      // Não incluir corpo/headers/erro do provedor: podem conter a chave ou a consulta.
      if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
      return response.json();
    });
  }
  async function search(query: string, filter: SourceFilter): Promise<SearchResult[]> {
    if (!Object.hasOwn(SOURCE_DOMAINS, filter)) throw new Error("Filtro de fonte inválido.");
    const q = query.trim();
    if (!q) return [];
    const key = keyFor(["query", q, filter]);
    const hit = await read<SearchResult[]>(key);
    if (hit) return hit;
    let results: SearchResult[] | null = null;
    try {
      const payload = await tavily("search", { query: q, search_depth: "basic", max_results: MAX_RESULTS,
        topic: "general", language: "pt", country: "brazil", include_domains: SOURCE_DOMAINS[filter], include_domains_mode: "restrict",
        auto_parameters: false, include_answer: false, include_raw_content: false });
      if (payload !== null) results = normalize(payload, filter, "tavily");
    } catch { /* qualquer erro tenta SearXNG na mesma consulta */ }
    if (!results?.length) {
      try {
        const url = new URL("search", `${deps.searxngUrl().replace(/\/$/, "")}/`);
        const domains = SOURCE_DOMAINS[filter];
        const restriction = domains.length ? ` (${domains.map((d) => `site:${d}`).join(" OR ")})` : "";
        url.search = new URLSearchParams({ q: q + restriction, format: "json", language: "pt-BR" }).toString();
        const response = await deps.fetch(url.href, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });
        if (!response.ok) return [];
        results = normalize(await response.json(), filter, "searxng");
      } catch { return []; }
    }
    if (results.length) await write(key, results);
    return results;
  }
  /** A entrada já deve vir em ordem de relevância e, na T-22, aprovada pelo robots.txt. */
  async function extract(urls: string[],signal?:AbortSignal): Promise<ExtractResult[]> {
    const selected = [...new Set(urls.map((v) => httpUrl(v)?.href).filter((v): v is string => !!v))].slice(0, MAX_EXTRACT);
    const content = new Map<string, string>();
    for (const url of selected) {
      const hit = await read<ExtractResult>(keyFor(["extract", url]));
      if (hit?.url === url && hit.content) content.set(url, hit.content);
    }
    const missing = selected.filter((url) => !content.has(url));
    if (missing.length) {
      try {
        const payload = record(await tavily("extract", { urls: missing, extract_depth: "basic", format: "markdown" },signal));
        const failed = new Set(Array.isArray(payload.failed_results) ? payload.failed_results.map((r) => text(record(r).url)) : []);
        for (const row of Array.isArray(payload.results) ? payload.results : []) {
          const r = record(row), url = text(r.url), value = text(r.raw_content);
          if (!missing.includes(url) || failed.has(url) || !value.trim()) continue;
          content.set(url, value);
          await write(keyFor(["extract", url]), { url, content: value });
        }
      } catch { /* ponytail: T-21b ligará o scraper seguro às URLs sem extração. */ }
    }
    return selected.flatMap((url) => content.has(url) ? [{ url, content: content.get(url)! }] : []);
  }
  return { search, extract };
}

/** Limites por fonte antes de qualquer prompt de classificação/síntese. URLs não são truncadas. */
export function boundSearchResult(source:SearchResult):SearchResult|null{if(source.url.length>4096)return null;return{...source,title:source.title.slice(0,500),snippet:source.snippet.slice(0,3000)};}
