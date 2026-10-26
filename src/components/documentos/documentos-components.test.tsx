import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { KeywordInput } from "./KeywordInput";
import { PDFUploadZone } from "./PDFUploadZone";

test("PDFUploadZone: estado inicial acessível, com o limite, o que é local e o aviso de privacidade", () => {
  const out = renderToStaticMarkup(<PDFUploadZone onChange={() => {}} />);
  assert.match(out, /role="button"/);
  assert.match(out, /aria-label="Enviar PDF/);
  assert.match(out, /Arraste um PDF ou clique para escolher/);
  assert.match(out, /Até 50 MB/);
  assert.match(out, /PDF digital é lido no seu navegador/);
  assert.match(out, /data-testid="privacy-notice"/);
  assert.match(out, /accept="application\/pdf,\.pdf"/);
  assert.ok(!/multiple/.test(out), "um PDF por vez");
});

test("KeywordInput: chips com botão de remover acessível, contador e placeholder só quando vazio", () => {
  const empty = renderToStaticMarkup(<KeywordInput value={[]} onChange={() => {}} />);
  assert.match(empty, /placeholder="Ex: rescisão, SLA, responsabilidade civil"/);
  assert.match(empty, /0 de 30/);
  const out = renderToStaticMarkup(<KeywordInput value={["rescisão", "SLA"]} onChange={() => {}} />);
  assert.equal((out.match(/data-testid="keyword-chip"/g) ?? []).length, 2);
  assert.match(out, /aria-label="Remover rescisão"/);
  assert.match(out, /2 de 30/);
  assert.ok(!/placeholder=/.test(out) || /placeholder=""/.test(out), "sem placeholder quando já há chips");
  assert.ok(!out.includes("keyword-suggestions"), "sem documento, sem bloco de sugestões");
});

test("KeywordInput: desabilitado bloqueia o campo e os botões", () => {
  const out = renderToStaticMarkup(<KeywordInput value={["a"]} onChange={() => {}} disabled />);
  assert.match(out, /<input[^>]*disabled/);
  assert.match(out, /<button[^>]*disabled=""[^>]*aria-label="Remover a"|<button[^>]*aria-label="Remover a"[^>]*disabled=""/);
});
