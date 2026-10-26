// Precisa do Postgres do dev (docker compose up -d postgres) e baixa/usa o modelo de embeddings.
// Rodar com: npm run test:db
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { embed, embedBatch, EMBEDDING_DIMS } from "./embeddings";
import { deleteBySource, insertChunks, similaritySearch } from "./vector-store";
import { prisma } from "./prisma";

const run = randomUUID();
const A = `vs-test-a-${run}`;
const B = `vs-test-b-${run}`;
const COL = `vs-test-col-${run}`;
const src = { one: `src1-${run}`, two: `src2-${run}`, col: `src3-${run}` };

after(async () => {
  await prisma.$executeRaw`DELETE FROM document_chunks WHERE user_id IN (${A}, ${B})`;
  await prisma.$disconnect();
});

const texts = [
  "A vigência do contrato é de 12 meses, contados da data da assinatura.",
  "A multa por atraso na entrega é de 0,5% ao dia sobre o valor da parcela.",
  "Receita de bolo de cenoura com cobertura de chocolate.",
];

test("embed: 384 dimensões e a 2ª chamada leva < 100 ms", async () => {
  assert.equal((await embed("olá mundo")).length, EMBEDDING_DIMS);
  const t0 = performance.now();
  await embed("segunda chamada");
  assert.ok(performance.now() - t0 < 100);
});

test("insere 3 chunks e a busca devolve ordenado por score, sem o que fica abaixo do minScore", async () => {
  const vecs = await embedBatch(texts);
  await insertChunks(
    texts.map((content, i) => ({
      sourceId: src.one, sourceType: "chat_upload" as const, userId: A, content, embedding: vecs[i],
      metadata: { index: i, startPage: i + 1, sectionTitle: "Cláusulas" },
    })),
  );
  const access = { userId: A, isAdmin: false, collectionIds: [] };
  const q = await embed("Qual o prazo de vigência do contrato?");

  const all = await similaritySearch({ embedding: q, topK: 10, minScore: -1, access });
  assert.equal(all.length, 3);
  assert.equal(all[0].content, texts[0]);
  assert.equal(all[2].content, texts[2]);
  assert.deepEqual(all.map((h) => h.score), [...all.map((h) => h.score)].sort((a, b) => b - a));
  assert.equal(all[0].metadata.sourceId, src.one);
  assert.equal(all[0].metadata.startPage, 1);
  assert.equal(all[0].metadata.sectionTitle, "Cláusulas");

  const cut = (all[0].score + all[1].score) / 2;
  const some = await similaritySearch({ embedding: q, topK: 10, minScore: cut, access });
  assert.deepEqual(some.map((h) => h.content), [texts[0]]);

  const top1 = await similaritySearch({ embedding: q, topK: 1, minScore: -1, access });
  assert.equal(top1.length, 1);
});

test("acesso: privado só do dono; coleção só de quem a enxerga; Admin vê tudo; filtros de origem", async () => {
  const [v] = await embedBatch([texts[0]]);
  await insertChunks([
    { sourceId: src.two, sourceType: "demo1_analysis", userId: B, content: "privado de B", embedding: v, metadata: { index: 0, startPage: 1 } },
    { sourceId: src.col, sourceType: "base", userId: B, collectionId: COL, content: "da coleção", embedding: v, metadata: { index: 0, startPage: 1 } },
  ]);
  const search = (access: { userId: string; isAdmin: boolean; collectionIds: string[] }, extra = {}) =>
    similaritySearch({ embedding: v, topK: 20, minScore: -1, access, ...extra }).then((h) => h.map((x) => x.content));

  const asA = await search({ userId: A, isAdmin: false, collectionIds: [] });
  assert.ok(!asA.includes("privado de B") && !asA.includes("da coleção"), "A não vê o privado de B nem a coleção");
  const asAcol = await search({ userId: A, isAdmin: false, collectionIds: [COL] });
  assert.ok(asAcol.includes("da coleção") && !asAcol.includes("privado de B"));
  const admin = await search({ userId: "outro", isAdmin: true, collectionIds: [] });
  assert.ok(admin.includes("privado de B") && admin.includes("da coleção"));
  const owner = { userId: A, isAdmin: false, collectionIds: [] };
  assert.equal((await search(owner, { sourceId: src.one })).length, 3);
  assert.deepEqual(await search(owner, { sourceType: "demo1_analysis" }), []);
});

test("deleteBySource remove só os chunks daquela origem", async () => {
  await deleteBySource(src.one);
  const left = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM document_chunks WHERE source_id = ${src.one}`;
  assert.equal(Number(left[0].n), 0);
  const other = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM document_chunks WHERE source_id = ${src.two}`;
  assert.equal(Number(other[0].n), 1);
});
