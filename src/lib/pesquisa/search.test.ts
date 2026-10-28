import { test } from "node:test";
import assert from "node:assert/strict";
import { createSearch, type SearchDependencies, type SearchResult } from "./search-core";

const gov = { url: "https://www.gov.br/trabalho/clt", title: "CLT", content: "Legislação", score: 0.9 };
function setup(options: { key?: string; blocked?: boolean; reply?: (url: string, init?: RequestInit) => Response | Promise<Response> } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const cache = new Map<string, unknown>();
  const deps: SearchDependencies = {
    apiKey: () => options.key ?? "chave-ficticia",
    searxngUrl: () => "http://localhost:8080",
    fetch: async (input, init) => {
      const url = String(input); calls.push({ url, init });
      return options.reply?.(url, init) ?? Response.json({ results: [gov], usage: { credits: 1 } });
    },
    getCached: async (key) => cache.get(key) ?? null,
    setCached: async (key, value) => { cache.set(key, value); },
    runTavily: async (_operation, request) => options.blocked ? null : request(),
  };
  return { ...createSearch(deps), calls, cache };
}

test("Tavily basic: cinco fontes, filtro estrito, sem domínio impostor e cache por consulta/filtro", async () => {
  const s = setup({ reply: () => Response.json({ usage: { credits: 1 }, results: [
    gov, { ...gov, url: "https://gov.br.evil.com/x" }, { ...gov, url: "javascript:alert(1)" }, gov,
  ] }) });
  const result = await s.search(" CLT 2024 ", "gov");
  assert.deepEqual(result, [{ url: gov.url, title: "CLT", snippet: "Legislação", score: 0.9, type: "gov", origin: "tavily" }]);
  const body = JSON.parse(s.calls[0].init!.body as string);
  assert.equal(body.search_depth, "basic"); assert.equal(body.max_results, 5);
  assert.equal(body.include_usage, true); assert.equal(body.include_domains_mode, "restrict");
  assert.ok(body.include_domains.includes("gov.br"));
  assert.deepEqual(await s.search("CLT 2024", "gov"), result);
  assert.equal(s.calls.length, 1);
  await s.search("CLT 2024", "all"); assert.equal(s.calls.length, 2);
});

for (const status of [401, 429, 432, 433, 500]) test(`Tavily HTTP ${status}: fallback na mesma consulta e formato uniforme`, async () => {
  const s = setup({ reply: (url) => url.includes("tavily") ? new Response("segredo não pode vazar", { status }) : Response.json({ results: [gov, { ...gov, url: "https://gov.br.evil.com/" }] }) });
  const r = await s.search("CLT 2024", "gov");
  assert.equal(r.length, 1); assert.equal(r[0].origin, "searxng");
  assert.equal(r[0].snippet, "Legislação"); assert.ok(r[0].score >= 0 && r[0].score <= 1);
  const url = new URL(s.calls[1].url);
  assert.ok(url.searchParams.get("q")!.includes("CLT 2024"));
  assert.equal(url.searchParams.get("format"), "json"); assert.equal(url.searchParams.get("language"), "pt-BR");
});

for (const mode of ["sem chave", "cota bloqueada", "rede", "JSON inválido", "formato inválido"]) test(`fallback: ${mode}`, async () => {
  const s = setup({ key: mode === "sem chave" ? "" : undefined, blocked: mode === "cota bloqueada", reply: (url) => {
    if (!url.includes("tavily")) return Response.json({ results: [gov] });
    if (mode === "rede") throw new Error("falhou");
    if (mode === "JSON inválido") return new Response("{");
    return Response.json({ unexpected: true });
  } });
  assert.equal((await s.search("CLT 2024", "gov"))[0].origin, "searxng");
  if (["sem chave", "cota bloqueada"].includes(mode)) assert.equal(s.calls.length, 1);
});

test("SearXNG: score relativo, ordenação, tipo por hostname e limite de cinco", async () => {
  const s = setup({ key: "", reply: () => Response.json({ results: [
    { ...gov, score: 2 }, { ...gov, url: "https://scielo.br/a", score: 10 },
    ...Array.from({ length: 7 }, (_, i) => ({ ...gov, url: `https://example.com/${i}`, score: i })),
  ] }) });
  const r = await s.search("teste", "all");
  assert.equal(r.length, 5); assert.equal(r[0].type, "academic"); assert.equal(r[0].score, 1);
  assert.ok(r.every((v, i) => i === 0 || r[i - 1].score >= v.score));
});

test("falha dos dois provedores devolve vazio sem guardar erro no cache", async () => {
  const s = setup({ reply: () => { throw new Error("rede"); } });
  assert.deepEqual(await s.search("CLT", "gov"), []); assert.equal(s.cache.size, 0);
});

test("consulta vazia e filtro inválido não gastam rede", async () => {
  const s = setup();
  assert.deepEqual(await s.search(" ", "gov"), []);
  await assert.rejects(() => s.search("x", "ruim" as "gov"), /filtro/i);
  assert.equal(s.calls.length, 0);
});

test("Extract: top três únicos, basic, ordem da entrada, failed_results mesmo com HTTP 200 e cache", async () => {
  const urls = [gov.url, "https://scielo.br/a", "https://example.com/b", "https://example.com/c"];
  const s = setup({ reply: () => Response.json({ usage: { credits: 1 }, results: [
    { url: urls[2], raw_content: "terceiro" }, { url: urls[0], raw_content: "primeiro" },
    { url: urls[1], raw_content: "inválido" }, { url: "https://intruso.com", raw_content: "intruso" },
  ], failed_results: [{ url: urls[1], error: "falhou" }] }) });
  assert.deepEqual(await s.extract([urls[0], ...urls]), [{ url: urls[0], content: "primeiro" }, { url: urls[2], content: "terceiro" }]);
  const body = JSON.parse(s.calls[0].init!.body as string);
  assert.deepEqual(body.urls, urls.slice(0, 3)); assert.equal(body.extract_depth, "basic");
  assert.equal(body.format, "markdown"); assert.equal(body.include_usage, true);
  await s.extract([urls[0], urls[2]]); assert.equal(s.calls.length, 1);
});

test("Extract indisponível/sem chave: vazio, sem fingir extração de snippets", async () => {
  for (const options of [{ key: "" }, { blocked: true }, { reply: () => new Response("erro", { status: 432 }) }]) {
    assert.deepEqual(await setup(options).extract([gov.url]), []);
  }
});

test("cache fora do ar não derruba a busca", async () => {
  const s = createSearch({ apiKey: () => "", searxngUrl: () => "http://localhost:8080", fetch: async () => Response.json({ results: [gov] }),
    getCached: async () => { throw Error("db"); }, setCached: async () => { throw Error("db"); }, runTavily: async () => null });
  const result: SearchResult[] = await s.search("CLT", "gov"); assert.equal(result.length, 1);
});
