import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "./http-error";
import { MAX_PDF_BYTES, assertPdf, assertText, readPdfUpload } from "./upload";

const bytes = (s: string) => new TextEncoder().encode(s);
const rejects = (fn: () => unknown, status: number, code: string) =>
  assert.throws(fn, (e) => e instanceof HttpError && e.status === status && e.code === code, `${status}/${code}`);

test("PDF válido passa (cabeçalho no início ou com lixo antes, dentro de 1 KB)", () => {
  assert.doesNotThrow(() => assertPdf(bytes("%PDF-1.7\n1 0 obj")));
  assert.doesNotThrow(() => assertPdf(bytes("\n\n  lixo antes do cabeçalho %PDF-1.4 resto")));
  assert.doesNotThrow(() => assertPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))); // só o cabeçalho
});

test("arquivo que não é PDF é recusado, mesmo que o nome diga .pdf (a decisão é pelos bytes)", () => {
  rejects(() => assertPdf(bytes("<html><script>alert(1)</script></html>")), 400, "invalid_pdf");
  rejects(() => assertPdf(bytes("MZ\x90\x00 executável")), 400, "invalid_pdf");
  rejects(() => assertPdf(bytes("PK\x03\x04 zip")), 400, "invalid_pdf");
  rejects(() => assertPdf(bytes("%PDF")), 400, "invalid_pdf"); // incompleto: falta o hífen
  rejects(() => assertPdf(bytes("x".repeat(2000) + "%PDF-1.4")), 400, "invalid_pdf"); // cabeçalho depois de 1 KB
});

test("arquivo vazio é recusado", () => {
  rejects(() => assertPdf(new Uint8Array(0)), 400, "empty_file");
});

test("PDF acima de 50 MB é recusado com 413", () => {
  const big = new Uint8Array(MAX_PDF_BYTES + 1);
  big.set(bytes("%PDF-1.7"));
  rejects(() => assertPdf(big), 413, "file_too_large");
  const exact = new Uint8Array(MAX_PDF_BYTES);
  exact.set(bytes("%PDF-1.7"));
  assert.doesNotThrow(() => assertPdf(exact), "exatamente 50 MB ainda passa");
});

test("readPdfUpload: lê e valida; recusa pelo tamanho ANTES de ler o conteúdo", async () => {
  const ok = new File([bytes("%PDF-1.7 conteúdo")], "contrato.pdf", { type: "application/pdf" });
  assert.equal((await readPdfUpload(ok)).length, ok.size);

  const falso = new File([bytes("<html>oi</html>")], "contrato.pdf", { type: "application/pdf" }); // mente no nome e no tipo
  await assert.rejects(readPdfUpload(falso), (e) => e instanceof HttpError && e.code === "invalid_pdf");

  let leu = false;
  const gigante = { size: MAX_PDF_BYTES + 1, arrayBuffer: async () => ((leu = true), new ArrayBuffer(0)) } as unknown as File;
  await assert.rejects(readPdfUpload(gigante), (e) => e instanceof HttpError && e.status === 413);
  assert.equal(leu, false, "não leu o arquivo para a memória");
});

test("texto: vazio, binário e grande demais são recusados", () => {
  assert.doesNotThrow(() => assertText("Cláusula 1 – Objeto"));
  rejects(() => assertText("   \n "), 400, "empty_text");
  rejects(() => assertText("abc\0def"), 400, "invalid_text");
  rejects(() => assertText("a".repeat(2 * 1024 * 1024 + 1)), 413, "file_too_large");
  assert.doesNotThrow(() => assertText("a".repeat(2 * 1024 * 1024)));
});
