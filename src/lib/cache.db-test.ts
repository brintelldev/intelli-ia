// Precisa do Postgres do dev. Rodar com: npm run test:db
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cacheKey, getCached, setCached } from "./cache";
import { prisma } from "./prisma";

const mod = `cache-test-${randomUUID()}`;
after(async () => {
  await prisma.responseCache.deleteMany({ where: { module: mod } });
  await prisma.$disconnect();
});

test("escrever e ler devolve o valor (objeto aninhado) e createdAt", async () => {
  const key = cacheKey([mod, "ler"]);
  assert.equal(await getCached(key), null);
  const value = { text: "olá", sources: [{ url: "https://x.gov.br", n: 1 }], flag: true };
  await setCached(key, value, mod);
  const hit = await getCached<typeof value>(key);
  assert.deepEqual(hit?.value, value);
  assert.ok(Date.now() - hit!.createdAt.getTime() < 5000);
});

test("chave expirada devolve null, e a gravação seguinte apaga as expiradas", async () => {
  const old = cacheKey([mod, "velha"]);
  await setCached(old, "x", mod, -1); // TTL negativo = já expirada
  assert.equal(await getCached(old), null);
  assert.equal(await prisma.responseCache.count({ where: { cacheKey: old } }), 1, "ainda está na tabela");
  await setCached(cacheKey([mod, "nova"]), "y", mod);
  assert.equal(await prisma.responseCache.count({ where: { cacheKey: old } }), 0, "foi limpa pela gravação");
});

test("regravar a mesma chave substitui o valor e renova createdAt e validade", async () => {
  const key = cacheKey([mod, "upsert"]);
  await setCached(key, "v1", mod, 1);
  const first = (await getCached(key))!;
  await new Promise((r) => setTimeout(r, 20));
  await setCached(key, "v2", mod, 48);
  const second = (await getCached<string>(key))!;
  assert.equal(second.value, "v2");
  assert.ok(second.createdAt > first.createdAt);
  const row = await prisma.responseCache.findUnique({ where: { cacheKey: key } });
  assert.ok(row!.expiresAt.getTime() - Date.now() > 47 * 3_600_000);
});

test("valores JSON de qualquer forma: null, número, lista", async () => {
  for (const [i, v] of [[1, 42], [2, [1, "a", null]], [3, ""]] as const) {
    const key = cacheKey([mod, "tipo", String(i)]);
    await setCached(key, v, mod);
    assert.deepEqual((await getCached(key))?.value, v);
  }
});
