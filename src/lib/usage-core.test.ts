import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUDGET_MESSAGES,
  DEFAULT_TIME_ZONE,
  buildEventData,
  checkBudget,
  createTrack,
  maskPII,
  oneLine,
  resolveTimeZone,
  sanitizeMetadata,
  type EventData,
  type TrackInput,
} from "./usage-core";

const input = (over: Partial<TrackInput> = {}): TrackInput => ({
  module: "demo1",
  action: "pdf_analysis",
  userId: "u1",
  durationMs: 1234.6,
  status: "success",
  ...over,
});

// ── evento seguro ───────────────────────────────────────────────────────────────────

test("evento: arredonda duração, normaliza usuário e status", () => {
  const e = buildEventData(input());
  assert.deepEqual(e, { module: "demo1", action: "pdf_analysis", userId: "u1", durationMs: 1235, status: "success", metadata: {} });
  assert.equal(buildEventData(input({ userId: undefined })).userId, null);
  assert.equal(buildEventData(input({ durationMs: -5 })).durationMs, null);
  assert.equal(buildEventData(input({ durationMs: NaN })).durationMs, null);
  assert.equal(buildEventData(input({ durationMs: undefined })).durationMs, null);
});

test("privacidade: título cortado em 120, texto em 200, objetos e listas descartados", () => {
  const longo = "x".repeat(500);
  const m = sanitizeMetadata({
    title: longo,
    nota: longo,
    documento: { texto: "conteúdo inteiro do contrato" } as never,
    chunks: ["trecho 1", "trecho 2"] as never,
    modelId: "anthropic:claude-sonnet-5-5",
    inputTokens: 1200,
    cacheHit: false,
    nulo: null,
    infinito: Infinity,
    naoNumero: NaN,
    fn: (() => 1) as never,
    indefinido: undefined,
  });
  assert.equal((m.title as string).length, 120);
  assert.ok((m.title as string).endsWith("…"));
  assert.equal((m.nota as string).length, 200);
  assert.deepEqual(Object.keys(m).sort(), ["cacheHit", "inputTokens", "modelId", "nota", "nulo", "title"]);
});

test("privacidade: chaves estranhas são descartadas", () => {
  const m = sanitizeMetadata({ "ok_1": 1, "com espaço": 2, "1inicio": 3, "a.b": 4, "<script>": 5, ["x".repeat(41)]: 6 });
  assert.deepEqual(Object.keys(m), ["ok_1"]);
});

// ── track nunca falha ───────────────────────────────────────────────────────────────

test("track grava o evento já saneado", async () => {
  const gravados: EventData[] = [];
  const track = createTrack(async (d) => void gravados.push(d));
  await track(input({ metadata: { title: "contrato.pdf", costUsd: 0.0123, objeto: { a: 1 } as never } }));
  assert.equal(gravados.length, 1);
  assert.deepEqual(gravados[0].metadata, { title: "contrato.pdf", costUsd: 0.0123 });
});

test("falha ao gravar NÃO quebra: promessa rejeitada, erro síncrono e valor estranho", async () => {
  const falhas: unknown[] = [];
  const onFailure = (e: unknown) => void falhas.push(e);

  const rejeita = createTrack(() => Promise.reject(new Error("banco fora")), onFailure);
  await assert.doesNotReject(rejeita(input()));

  const lanca = createTrack(() => {
    throw new Error("estourou antes de devolver promessa");
  }, onFailure);
  await assert.doesNotReject(lanca(input()));

  const semAwait = createTrack(() => Promise.reject(new Error("sem ninguém esperando")), onFailure);
  semAwait(input()); // contrato das rotas: chamar sem await não gera "unhandled rejection"
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(falhas.length, 3);
  assert.match(String((falhas[0] as Error).message), /banco fora/);
});

// ── mascaramento ──────────────────────────────────────────────────────────────────

test("mascara e-mail, CPF formatado e CPF válido sem pontuação", () => {
  assert.equal(maskPII("Contato: maria.silva+x@empresa.com.br."), "Contato: [e-mail ocultado].");
  assert.equal(maskPII("CPF 529.982.247-25 do contratante"), "CPF [CPF ocultado] do contratante");
  assert.equal(maskPII("CPF 52998224725 do contratante"), "CPF [CPF ocultado] do contratante");
  assert.equal(maskPII("CPF inválido porém formatado 111.222.333-44"), "CPF inválido porém formatado [CPF ocultado]");
});

test("CPF sem pontuação só é mascarado se o dígito verificador conferir", () => {
  assert.equal(maskPII("protocolo 12345678901 aberto"), "protocolo 12345678901 aberto");
  assert.equal(maskPII("11111111111"), "11111111111"); // sequência repetida não é CPF
});

test("mascara telefones brasileiros em formatos comuns", () => {
  for (const t of [
    "(11) 91234-5678",
    "11 91234-5678",
    "+55 11 91234-5678",
    "11912345678",
    "(11) 3333-4444",
    "11 3333-4444",
    "11-3333-4444",
  ]) {
    assert.equal(maskPII(`ligue ${t} agora`), "ligue [telefone ocultado] agora", t);
  }
});

test("não mascara o que não é dado pessoal (valores, leis, datas, CNPJ, processos)", () => {
  for (const t of [
    "Lei 14.133/2021, art. 7º",
    "multa de R$ 1.234.567,89 e 10% do contrato",
    "publicado em 26/10/2026 às 14h30",
    "CNPJ 12.345.678/0001-95",
    "processo 0001234-56.2020.8.26.0100",
    "anos 2024 2025 e 2026",
    "versão 3.8.1 do sistema",
    "sala 1204, andar 12",
  ]) {
    assert.equal(maskPII(t), t, t);
  }
});

test("mascara várias ocorrências no mesmo texto", () => {
  const out = maskPII("a@b.co, c@d.com e (21) 98888-7777; CPF 529.982.247-25");
  assert.equal(out, "[e-mail ocultado], [e-mail ocultado] e [telefone ocultado]; CPF [CPF ocultado]");
});

// ── orçamento ───────────────────────────────────────────────────────────────────────

const gasto = (user = 0, module = 0, global = 0) => ({ user, module, global });
const limite = (user: number | null = null, module: number | null = null, global: number | null = null) => ({ user, module, global });

test("orçamento: sem limites configurados nunca bloqueia", () => {
  assert.equal(checkBudget(gasto(999, 999, 999), limite()), null);
});

test("orçamento: bloqueia quando o gasto alcança o limite (≥), não só quando passa", () => {
  assert.deepEqual(checkBudget(gasto(0.0001), limite(0.0001)), { scope: "user", spent: 0.0001, limit: 0.0001 });
  assert.equal(checkBudget(gasto(0.00009), limite(0.0001)), null);
});

test("orçamento: limite 0 bloqueia mesmo sem gasto (uso desligado)", () => {
  assert.deepEqual(checkBudget(gasto(), limite(0)), { scope: "user", spent: 0, limit: 0 });
});

test("orçamento: ordem usuário → módulo → global e cada escopo é independente", () => {
  assert.equal(checkBudget(gasto(10, 10, 10), limite(5, 5, 5))?.scope, "user");
  assert.equal(checkBudget(gasto(1, 10, 10), limite(5, 5, 5))?.scope, "module");
  assert.equal(checkBudget(gasto(1, 1, 10), limite(5, 5, 5))?.scope, "global");
  assert.equal(checkBudget(gasto(1, 1, 1), limite(5, 5, 5)), null);
  assert.equal(checkBudget(gasto(1, 10, 1), limite(null, 5, null))?.scope, "module");
});

test("orçamento: mensagens amigáveis e códigos estáveis por escopo", () => {
  assert.equal(BUDGET_MESSAGES.user.code, "budget_user");
  assert.equal(BUDGET_MESSAGES.module.code, "budget_module");
  assert.equal(BUDGET_MESSAGES.global.code, "budget_global");
  for (const s of ["user", "module", "global"] as const) assert.match(BUDGET_MESSAGES[s].message, /limite diário/);
});

test("fuso do dia: padrão Brasil; valor inválido não derruba a consulta", () => {
  assert.equal(resolveTimeZone(undefined), DEFAULT_TIME_ZONE);
  assert.equal(resolveTimeZone(""), DEFAULT_TIME_ZONE);
  assert.equal(resolveTimeZone("America/Manaus"), "America/Manaus");
  assert.equal(resolveTimeZone("Marte/Olympus"), DEFAULT_TIME_ZONE);
});

test("log de falha: só a última linha do erro (o Prisma manda um trecho de código antes)", () => {
  const prismaLike = new Error("\nInvalid `prisma.usageEvent.create()` invocation in\n/app/x.ts:37\n\n  36 export\n→ 37 prisma\nForeign key constraint violated\n");
  assert.equal(oneLine(prismaLike), "Foreign key constraint violated");
  assert.equal(oneLine("texto solto"), "texto solto");
  assert.equal(oneLine(new Error("")), "erro desconhecido");
});
