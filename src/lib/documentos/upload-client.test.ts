import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dropRejectionMessage, MAX_PAGES, MESSAGES, processPdf, UploadError, type UploadErrorCode } from "./upload-client";
import { addKeywords, MAX_KEYWORD_CHIPS, splitKeywordInput } from "./keywords";
import { buildDocument, protectedDocument } from "@/lib/pdf/document";
import { MAX_PDF_BYTES } from "@/lib/upload";

const fixture = (name: string, type = "application/pdf") => new File([readFileSync(new URL(`../pdf/fixtures/${name}`, import.meta.url))], name, { type });
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const code = async (p: Promise<unknown>): Promise<UploadErrorCode | undefined> => (await p.then(() => undefined, (e) => (e as UploadError).code));

test("PDF digital: extrai no navegador, método 'digital', sem chamar o servidor", async () => {
  let ocrCalls = 0;
  const phases: string[] = [];
  const r = await processPdf(fixture("digital-10p.pdf"), { onPhase: (p) => phases.push(p.phase), deps: { ocr: async () => { ocrCalls++; throw new Error("não deveria"); } } });
  assert.equal(r.method, "digital");
  assert.equal(r.doc.pages.length, 10);
  assert.equal(ocrCalls, 0);
  assert.deepEqual([...new Set(phases)], ["reading"]);
});

test("PDF só de imagem: vai ao OCR, o resultado do servidor vale e o método é 'escaneado'", async () => {
  const phases: string[] = [];
  const ocrDoc = buildDocument("Texto lido pelo OCR com bastante conteúdo útil para a análise do documento.");
  const r = await processPdf(fixture("scanned-1p.pdf"), { onPhase: (p) => phases.push(p.phase), deps: { ocr: async () => ocrDoc } });
  assert.equal(r.method, "escaneado");
  assert.equal(r.doc.text, ocrDoc.text);
  assert.deepEqual(phases.filter((p, i, a) => a.indexOf(p) === i), ["reading", "ocr"]);
});

test("PDF com SENHA (arquivo protegido de verdade): erro orientativo, sem chamar o OCR", async () => {
  let ocr = 0;
  const e = await processPdf(fixture("protected-1p.pdf"), { deps: { ocr: async () => { ocr++; return buildDocument("x"); } } }).then(() => null, (x) => x as UploadError);
  assert.equal(e?.code, "protected");
  assert.equal(e?.message, MESSAGES.protected);
  assert.match(e!.message, /protegido por senha/);
  assert.equal(ocr, 0);
});

test("o tipo vem dos bytes: texto com nome .pdf e PDF corrompido são recusados com mensagens diferentes", async () => {
  assert.equal(await code(processPdf(new File(["isto não é um pdf"], "x.pdf", { type: "application/pdf" }))), "invalid");
  assert.equal(await code(processPdf(new File([new Uint8Array(0)], "vazio.pdf"))), "invalid");
  const broken = new File([new TextEncoder().encode("%PDF-1.4\nlixo sem estrutura nenhuma")], "quebrado.pdf");
  const e = await processPdf(broken).then(() => null, (x) => x as UploadError);
  assert.equal(e?.code, "invalid");
  assert.equal(e?.message, MESSAGES.corrupted);
});

test("limites: arquivo acima de 50 MB, documento com páginas demais ou sem nenhum texto", async () => {
  assert.equal(await code(processPdf(new File([new Uint8Array(MAX_PDF_BYTES + 1)], "grande.pdf"))), "too_large");
  const pages = Array.from({ length: MAX_PAGES + 1 }, (_, i) => `p${i} ` + "texto ".repeat(200));
  const many = buildDocument(pages.join("<!-- PAGE_BREAK -->"));
  assert.equal(await code(processPdf(fixture("digital-10p.pdf"), { deps: { extract: async () => many } })), "too_long");
  const huge = buildDocument("x".repeat(2_000_001));
  assert.equal(await code(processPdf(fixture("digital-10p.pdf"), { deps: { extract: async () => huge } })), "too_long");
  assert.equal(await code(processPdf(fixture("digital-10p.pdf"), { deps: { extract: async () => ({ ...buildDocument("a ".repeat(1000)), text: "  " }) } })), "no_text");
  assert.equal(await code(processPdf(fixture("digital-10p.pdf"), { deps: { extract: async () => protectedDocument() } })), "protected");
});

test("OCR indisponível ou sem texto: as mensagens do servidor chegam à pessoa", async () => {
  const reply = (status: number, body: object) => (globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch);
  reply(503, { error: "Leitura de PDF escaneado indisponível no momento.", code: "docling_unavailable" });
  const a = await processPdf(fixture("scanned-1p.pdf")).then(() => null, (x) => x as UploadError);
  assert.deepEqual([a?.code, a?.message], ["ocr_unavailable", "Leitura de PDF escaneado indisponível no momento."]);
  reply(422, { error: "Nenhum texto foi encontrado neste PDF.", code: "no_text" });
  assert.equal(await code(processPdf(fixture("scanned-1p.pdf"))), "no_text");
  reply(502, { error: "Não foi possível ler este PDF.", code: "docling_failed" });
  assert.equal(await code(processPdf(fixture("scanned-1p.pdf"))), "ocr_failed");
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  assert.equal(await code(processPdf(fixture("scanned-1p.pdf"))), "ocr_unavailable");
});

test("cancelar durante o OCR: erro 'aborted' (não é falha)", async () => {
  const ctl = new AbortController();
  // como o fetch de verdade: rejeita já se o sinal chegou abortado e, senão, quando ele abortar
  globalThis.fetch = ((_u: string, init: RequestInit) =>
    new Promise((_, rej) => {
      const fail = () => rej(new DOMException("abort", "AbortError"));
      if (init.signal!.aborted) fail();
      else init.signal!.addEventListener("abort", fail);
    })) as typeof fetch;
  const p = processPdf(fixture("scanned-1p.pdf"), { signal: ctl.signal, onPhase: (x) => x.phase === "ocr" && ctl.abort() });
  assert.equal(await code(p), "aborted");
});

test("dropRejectionMessage: tamanho, tipo e quantidade", () => {
  assert.match(dropRejectionMessage(["file-too-large"]), /limite de 50 MB/);
  assert.match(dropRejectionMessage(["file-invalid-type"]), /arquivo PDF/);
  assert.match(dropRejectionMessage(["too-many-files"]), /um PDF por vez/);
  assert.match(dropRejectionMessage(["outro"]), /Não foi possível/);
});

test("splitKeywordInput: separa por vírgula, ponto e vírgula e linha; apara e ignora vazios", () => {
  assert.deepEqual(splitKeywordInput(" rescisão , SLA;  multa\nresponsabilidade   civil,, "), ["rescisão", "SLA", "multa", "responsabilidade civil"]);
  assert.deepEqual(splitKeywordInput("  ,  "), []);
});

test("addKeywords: sem repetidos (caixa e acento), limite de tamanho e de quantidade, e diz o que ficou de fora", () => {
  const r = addKeywords(["Rescisão"], ["rescisao", "SLA", "sla", "x".repeat(61), " multa "]);
  assert.deepEqual(r.keywords, ["Rescisão", "SLA", "multa"]);
  assert.deepEqual([r.added, r.duplicates.length, r.tooLong.length], [["SLA", "multa"], 2, 1]);
  const full = addKeywords(Array.from({ length: MAX_KEYWORD_CHIPS }, (_, i) => `t${i}`), ["novo", "t1"]);
  assert.equal(full.keywords.length, MAX_KEYWORD_CHIPS);
  assert.deepEqual([full.overflow, full.duplicates], [["novo"], ["t1"]]);
  assert.deepEqual(addKeywords([], ["a"], 1).keywords, ["a"]);
  assert.deepEqual(addKeywords(["a"], ["b"], 1).overflow, ["b"]);
});
