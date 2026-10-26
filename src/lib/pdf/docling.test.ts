import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { extractWithDocling } from "./docling";
import { HttpError } from "@/lib/http-error";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.DOCLING_URL;
});
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
const blob = new Blob(["%PDF-1.4"]);

test("converte a resposta do docling em ExtractedDocument e envia o multipart esperado", async () => {
  process.env.DOCLING_URL = "http://docling:5001";
  let seen: { url: string; form: FormData } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url, form: init.body as FormData };
    return new Response(JSON.stringify({ status: "success", document: { md_content: "pg1<!-- PAGE_BREAK -->pg2" } }));
  }) as typeof fetch;
  const doc = await extractWithDocling(blob, "a.pdf");
  assert.equal(seen!.url, "http://docling:5001/v1/convert/file");
  assert.equal(seen!.form.get("to_formats"), "md");
  assert.ok(seen!.form.get("files") instanceof Blob);
  assert.deepEqual(doc.pages.map((p) => p.content), ["pg1", "pg2"]);
});

async function code(p: Promise<unknown>) {
  try { await p; } catch (e) { return (e as HttpError).code; }
}

test("erros viram HttpError com código estável", async () => {
  assert.equal(await code(extractWithDocling(blob, "a.pdf")), "docling_unavailable"); // sem DOCLING_URL
  process.env.DOCLING_URL = "http://docling:5001";
  globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
  assert.equal(await code(extractWithDocling(blob, "a.pdf")), "docling_unavailable");
  globalThis.fetch = reply(500, {}) as typeof fetch;
  assert.equal(await code(extractWithDocling(blob, "a.pdf")), "docling_failed");
  globalThis.fetch = reply(200, { status: "failure", document: {} }) as typeof fetch;
  assert.equal(await code(extractWithDocling(blob, "a.pdf")), "docling_failed");
  globalThis.fetch = reply(200, { status: "success", document: { md_content: "  " } }) as typeof fetch;
  assert.equal(await code(extractWithDocling(blob, "a.pdf")), "no_text");
});
