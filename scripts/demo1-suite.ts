// Bateria do Demo 1 (T-19): roda os 5 PDFs de test-data/demo1 pelo fluxo REAL (leitura, OCR se escaneado, análise e parecer,
// com os modelos de verdade) e confere as páginas citadas contra o gabarito (expected.json). GASTA tokens (~US$ 0,5).
//   npm run demo1-suite                          servidor em http://localhost:3001, conta Analista do seed
//   npm run demo1-suite -- --only=regulamento     só os arquivos cujo nome contém o texto
//   npm run demo1-suite -- --base=https://app.exemplo.com    (e DEMO_EMAIL / DEMO_PASSWORD no ambiente)
// Sai com código 1 se algum fato ficar na página errada ou se a citação não existir na página citada.
import "./load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractPDF } from "../src/lib/pdf/extract-client";
import type { ExtractedDocument } from "../src/lib/pdf/types";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const BASE = (arg("base") ?? "http://localhost:3001").replace(/\/$/, "");
const ONLY = arg("only");
const EMAIL = process.env.DEMO_EMAIL ?? "analista@intellisuite.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Analista@2025"; // senha de demonstração do README (pública)
const DIR = path.resolve("test-data/demo1");

type Fact = { keyword: string; page: number; contem: string };
type Entry = { tipo: string; paginas: number; fatos: Fact[] };
const raw = JSON.parse(readFileSync(path.join(DIR, "expected.json"), "utf8")) as Record<string, Entry | string>;
const expected = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_"))) as Record<string, Entry>;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!r.ok) throw new Error(`login falhou (${r.status})`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

/** Lê o stream de mensagens da API e devolve o último `data-<type>` com `phase: "final"` (ou lança com o erro do stream). */
async function stream<T>(cookie: string, api: string, body: object, type: string): Promise<{ final: T; ms: number }> {
  const t0 = Date.now();
  const r = await fetch(`${BASE}${api}`, { method: "POST", headers: { "content-type": "application/json", cookie, origin: BASE }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${api}: HTTP ${r.status} ${await r.text()}`);
  let final: T | undefined;
  let buf = "";
  const dec = new TextDecoder();
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      const c = JSON.parse(p) as { type: string; data?: { phase?: string }; errorText?: string };
      if (c.type === "error") throw new Error(`${api}: ${c.errorText}`);
      if (c.type === type && c.data?.phase === "final") final = c.data as T;
    }
  }
  if (!final) throw new Error(`${api}: o stream terminou sem resultado final`);
  return { final, ms: Date.now() - t0 };
}

async function pagesOf(cookie: string, file: string): Promise<{ doc: ExtractedDocument; method: "digital" | "OCR" }> {
  const bytes = readFileSync(path.join(DIR, file));
  const doc = await extractPDF(new File([bytes], file, { type: "application/pdf" }));
  if (!doc.isScanned) return { doc, method: "digital" };
  const form = new FormData();
  form.append("file", new File([bytes], file, { type: "application/pdf" }));
  const r = await fetch(`${BASE}/api/documentos/parse-pdf`, { method: "POST", headers: { cookie, origin: BASE }, body: form });
  if (!r.ok) throw new Error(`parse-pdf: HTTP ${r.status} ${await r.text()}`);
  return { doc: (await r.json()) as ExtractedDocument, method: "OCR" };
}

type Analysis = { analysis: { keywordMatches: { keyword: string; occurrences: { page: number; verified: boolean; context: string }[] }[]; relevanceBySection: { score: number }[] } };
type Brief = { brief: { achadosPrincipais: { keyword: string; finding: string; pageRef: number | null; quote: string; verified: boolean }[]; analiseRiscos: { quote: string; pageRef: number | null; verified: boolean }[] }; sections: unknown[]; partialEvidence: boolean };

async function main() {
  const cookie = await login();
  let failures = 0;
  const lines: string[] = [];
  for (const [file, exp] of Object.entries(expected)) {
    if (ONLY && !file.includes(ONLY)) continue;
    const problems: string[] = [];
    const t0 = Date.now();
    const { doc, method } = await pagesOf(cookie, file);
    const readMs = Date.now() - t0;
    if (doc.pages.length !== exp.paginas) problems.push(`páginas lidas: ${doc.pages.length} (esperado ${exp.paginas})`);
    const pages = doc.pages.map((p) => ({ number: p.number, content: p.content }));
    const keywords = exp.fatos.map((f) => f.keyword);
    const base = { pages, keywords, filename: file };

    const a = await stream<Analysis>(cookie, "/api/documentos/analyze", { ...base, index: false }, "data-analysis");
    const b = await stream<Brief>(cookie, "/api/documentos/generate-brief", { ...base, analysis: a.final.analysis }, "data-brief");

    const onPage = (n: number | null) => doc.pages.find((p) => p.number === n)?.content ?? "";
    for (const f of exp.fatos) {
      const occ = a.final.analysis.keywordMatches.find((k) => fold(k.keyword) === fold(f.keyword))?.occurrences ?? [];
      if (!occ.some((o) => o.verified && o.page === f.page)) problems.push(`análise: "${f.keyword}" não tem ocorrência verificada na p. ${f.page} (achou: ${occ.map((o) => `p.${o.page}${o.verified ? "" : "?"}`).join(", ") || "nenhuma"})`);
      const finds = b.final.brief.achadosPrincipais.filter((x) => fold(x.keyword) === fold(f.keyword));
      const hit = finds.find((x) => x.verified && x.pageRef === f.page && fold(`${x.finding} ${x.quote}`).includes(fold(f.contem)));
      if (!hit) problems.push(`parecer: "${f.keyword}" sem achado verificado na p. ${f.page} contendo "${f.contem}" (achou: ${finds.map((x) => `p.${x.pageRef}${x.verified ? "" : "?"}`).join(", ") || "nenhum"})`);
    }
    // conferência independente da do servidor: toda citação verificada existe MESMO na página citada
    for (const x of [...b.final.brief.achadosPrincipais, ...b.final.brief.analiseRiscos]) {
      if (!x.verified || x.pageRef == null || !x.quote) continue;
      const needle = x.quote.split(/…|\.{3}/).map(fold).sort((m, n) => n.length - m.length)[0];
      if (needle.length >= 12 && !fold(onPage(x.pageRef)).includes(needle)) problems.push(`citação "verificada" que NÃO está na p. ${x.pageRef}: "${x.quote.slice(0, 60)}"`);
    }
    const ok = problems.length === 0;
    if (!ok) failures++;
    lines.push(`${ok ? "✔" : "✘"} ${file.padEnd(32)} ${exp.tipo.slice(0, 22).padEnd(22)} leitura ${method} ${(readMs / 1000).toFixed(1)}s | análise ${(a.ms / 1000).toFixed(1)}s | parecer ${(b.ms / 1000).toFixed(1)}s${b.final.partialEvidence ? " (páginas selecionadas)" : ""} | ${exp.fatos.length} fatos`);
    for (const p of problems) lines.push(`    ✘ ${p}`);
    console.log(lines.at(ok ? -1 : -(problems.length + 1)));
    for (const p of problems) console.log(`    ✘ ${p}`);
  }
  console.log(failures ? `\n${failures} arquivo(s) com problema.` : "\nTUDO OK: páginas e citações conferem em todos os arquivos.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("erro na bateria:", e instanceof Error ? e.message : e);
  process.exit(1);
});
