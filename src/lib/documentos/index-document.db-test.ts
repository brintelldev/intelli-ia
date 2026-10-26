// Precisa do Postgres do dev e do modelo de embeddings. Rodar com: npm run test:db
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { embed } from "../embeddings";
import { similaritySearch } from "../vector-store";
import { indexAnalyzedDocument } from "./index-document";
import type { CheckedAnalysis } from "./analysis";

const user = `idx-${randomUUID()}`;
const analysis: CheckedAnalysis = { relevanceBySection: [], taxonomy: ["SLA", "Multas", "A", "B", "C", "D"], keywordMatches: [], summary: "Resumo do contrato.", suggestions: [] };
const pagesV1 = [
  { number: 3, content: "CLÁUSULA QUARTA – DO SLA. A contratada garantirá disponibilidade mensal de 99,5% e atendimento de incidentes críticos em até 2 horas." },
  { number: 4, content: "CLÁUSULA SÉTIMA – DAS PENALIDADES. Multa de 0,5% ao dia sobre a parcela em atraso, limitada a 10%." },
];

after(async () => {
  await prisma.documentSource.deleteMany({ where: { userId: user } });
  await prisma.$executeRaw`DELETE FROM document_chunks WHERE user_id = ${user}`;
  await prisma.$disconnect();
});

test("indexa com o número REAL da página, cria a fonte e a busca do dono encontra o trecho", async () => {
  const r = await indexAnalyzedDocument({ userId: user, filename: "contrato.pdf", pages: pagesV1, analysis });
  assert.ok(r.chunkCount >= 1);
  const src = await prisma.documentSource.findUniqueOrThrow({ where: { id: r.sourceId } });
  assert.deepEqual([src.userId, src.sourceType, src.filename, src.chunkCount, src.collectionId], [user, "demo1_analysis", "contrato.pdf", r.chunkCount, null]);
  assert.deepEqual(src.topics, ["SLA", "Multas", "A", "B", "C"], "no máximo 5 temas");
  assert.equal(src.summary, "Resumo do contrato.");

  const hits = await similaritySearch({ embedding: await embed("Qual a multa por atraso?"), topK: 3, minScore: 0, access: { userId: user, isAdmin: false, collectionIds: [] }, sourceId: r.sourceId });
  assert.ok(hits.length >= 1);
  assert.match(hits[0].content, /Multa de 0,5% ao dia/);
  assert.ok(hits.every((h) => h.metadata.startPage === 3 || h.metadata.startPage === 4), "páginas 3 e 4 do documento, não 1 e 2");
  assert.equal(hits[0].metadata.filename, "contrato.pdf");
  // outra pessoa não enxerga
  assert.equal((await similaritySearch({ embedding: await embed("multa"), topK: 3, minScore: -1, access: { userId: "outra", isAdmin: false, collectionIds: [] }, sourceId: r.sourceId })).length, 0);
});

test("reanalisar o mesmo arquivo SUBSTITUI a fonte anterior (e os trechos antigos somem)", async () => {
  const again = await indexAnalyzedDocument({ userId: user, filename: "contrato.pdf", pages: [{ number: 1, content: "Texto novo e totalmente diferente sobre outro assunto qualquer do contrato revisado." }], analysis });
  const sources = await prisma.documentSource.findMany({ where: { userId: user, filename: "contrato.pdf" } });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, again.sourceId);
  const old = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM document_chunks WHERE user_id = ${user} AND content LIKE '%Multa de 0,5%'`;
  assert.equal(Number(old[0].n), 0);
  // outro arquivo do mesmo usuário não é tocado
  const other = await indexAnalyzedDocument({ userId: user, filename: "outro.pdf", pages: pagesV1, analysis });
  assert.equal(await prisma.documentSource.count({ where: { userId: user } }), 2);
  assert.notEqual(other.sourceId, again.sourceId);
});

test("texto que contém o marcador de página não desloca a numeração", async () => {
  const r = await indexAnalyzedDocument({ userId: user, filename: "marcador.pdf", pages: [{ number: 7, content: "início <!-- PAGE_BREAK --> meio do texto com marcador falso dentro do conteúdo da página sete" }], analysis });
  const rows = await prisma.$queryRaw<{ p: number }[]>`SELECT (metadata->>'startPage')::int AS p FROM document_chunks WHERE source_id = ${r.sourceId}`;
  assert.deepEqual([...new Set(rows.map((x) => x.p))], [7]);
});

test("documento sem texto não cria fonte órfã", async () => {
  await assert.rejects(indexAnalyzedDocument({ userId: user, filename: "vazio.pdf", pages: [{ number: 1, content: "   " }], analysis }));
  assert.equal(await prisma.documentSource.count({ where: { userId: user, filename: "vazio.pdf" } }), 0);
});
