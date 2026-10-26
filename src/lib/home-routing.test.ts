import assert from "node:assert/strict";
import { test } from "node:test";
import { relativeTime, initials } from "./format";
import { routeForQuery } from "./home-routing";
import { modulesFor, pageTitle } from "./modules";

test("command bar: palavras-chave levam ao módulo (Analista)", () => {
  assert.equal(routeForQuery("analisar contrato", "Analista"), "/documentos");
  assert.equal(routeForQuery("Quero ler este PDF", "Analista"), "/documentos");
  assert.equal(routeForQuery("pesquisar a CLT em 2024", "Analista"), "/pesquisa");
  assert.equal(routeForQuery("perguntar sobre a base", "Analista"), "/chat");
  assert.equal(routeForQuery("converse comigo", "Analista"), "/pesquisa"); // "conversa" não casa com "converse"
});

test("command bar: ignora acento e caixa", () => {
  assert.equal(routeForQuery("ANÁLISE de risco", "Admin"), "/documentos");
  assert.equal(routeForQuery("Análise", "Admin"), "/documentos");
});

test("command bar: sem palavra-chave vai para a pesquisa; vazio também", () => {
  assert.equal(routeForQuery("bom dia", "Admin"), "/pesquisa");
  assert.equal(routeForQuery("", "Admin"), "/pesquisa");
});

test("command bar: documentos vence quando há mais de uma palavra-chave", () => {
  assert.equal(routeForQuery("pesquisa sobre o contrato", "Admin"), "/documentos");
});

test("command bar: Leitor nunca é mandado para um 403 (cai no chat)", () => {
  assert.equal(routeForQuery("analisar contrato", "Leitor"), "/chat");
  assert.equal(routeForQuery("pesquisar algo", "Leitor"), "/chat");
  assert.equal(routeForQuery("bom dia", "Leitor"), "/chat");
  assert.equal(routeForQuery("perguntar", "Leitor"), "/chat");
});

test("módulos por perfil: o que a navegação mostra", () => {
  const hrefs = (r: "Admin" | "Analista" | "Leitor") => modulesFor(r).map((m) => m.href);
  assert.deepEqual(hrefs("Admin"), ["/documentos", "/pesquisa", "/chat", "/admin/dashboard"]);
  assert.deepEqual(hrefs("Analista"), ["/documentos", "/pesquisa", "/chat", "/admin/dashboard"]);
  assert.deepEqual(hrefs("Leitor"), ["/chat"]);
  assert.equal(modulesFor("Admin").at(-1)?.label, "Admin");
  assert.equal(modulesFor("Analista").at(-1)?.label, "Dashboard");
});

test("título da TopBar", () => {
  assert.deepEqual(pageTitle("/documentos"), { section: "Análise de Documentos" });
  assert.deepEqual(pageTitle("/chat/abc"), { section: "Chat RAG" });
  assert.deepEqual(pageTitle("/admin/dashboard"), { section: "Admin", page: "Dashboard" });
  assert.equal(pageTitle("/home"), null);
});

test("initials", () => {
  assert.equal(initials("Maria da Silva"), "MS");
  assert.equal(initials("Admin"), "AD");
  assert.equal(initials("  "), "?");
});

test("relativeTime", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const ago = (ms: number) => relativeTime(new Date(now.getTime() - ms), now);
  assert.equal(ago(10_000), "agora");
  assert.equal(ago(5 * 60_000), "há 5 minutos");
  assert.equal(ago(2 * 3_600_000), "há 2 horas");
  assert.equal(ago(86_400_000), "ontem");
  assert.equal(ago(3 * 86_400_000), "há 3 dias");
  assert.match(ago(60 * 86_400_000), /2026/); // passou de 30 dias: data
});
