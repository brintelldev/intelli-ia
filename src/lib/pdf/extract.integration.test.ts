import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractPDF } from "./extract-client";
import { chunkDocument } from "./chunker";

const pdf = (name: string) => new File([readFileSync(new URL(`./fixtures/${name}`, import.meta.url))], name);

test("PDF digital de 10 páginas: extrai em < 3 s, não é escaneado e gera chunks coerentes", async () => {
  const t0 = performance.now();
  const doc = await extractPDF(pdf("digital-10p.pdf"));
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `levou ${Math.round(ms)} ms`);
  assert.equal(doc.pages.length, 10);
  assert.equal(doc.isScanned, false);
  assert.equal(doc.isProtected, false);
  assert.match(doc.pages[9].content, /^10\.1 A administracao/);
  const chunks = chunkDocument(doc);
  assert.ok(chunks.length > 5);
  assert.equal(chunks[0].metadata.startPage, 1);
  assert.equal(chunks.at(-1)!.metadata.startPage, 10);
});

test("PDF só de imagem: marcado como escaneado (a tela deve usar o docling)", async () => {
  const doc = await extractPDF(pdf("scanned-1p.pdf"));
  assert.equal(doc.isScanned, true);
  assert.equal(doc.text.trim(), "");
});
